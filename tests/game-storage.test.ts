import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, test } from "node:test";
import { initializeApp } from "firebase/app";
import {
  collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, getFirestore,
  serverTimestamp, setDoc, setLogLevel, Timestamp, updateDoc, writeBatch,
} from "firebase/firestore/lite";
import { saveGame } from "../src/stats/firebase.ts";
import { players, prepareGame, races } from "../src/stats/model.ts";

if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8085") {
  throw new Error("Run npm run test:rules. These tests may only write to the local demo Firestore emulator.");
}
const projectId = "demo-eclipse-stats";
const origin = "http://127.0.0.1:8085";
const documents = `${origin}/v1/projects/${projectId}/databases/(default)/documents`;
const firestore = getFirestore(initializeApp({ projectId, apiKey: "demo" }, "game-storage-tests"));
connectFirestoreEmulator(firestore, "127.0.0.1", 8085);
setLogLevel("silent");
const counterRef = doc(firestore, "metadata", "gameSequence");
const entry = prepareGame({
  participants: [{ playerId: "ci", raceId: "tr" }, { playerId: "bp", raceId: "tr" }],
  winnerPlayerId: "bp",
  winnerPoints: "43",
});
const denied = (operation: Promise<unknown>) => assert.rejects(operation, { code: "permission-denied" });

beforeEach(async () => {
  const clear = await fetch(`${origin}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  assert.equal(clear.status, 200);
  const seed = await fetch(`${documents}/metadata/gameSequence`, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { sequence: { integerValue: "10" }, gameId: { nullValue: null } } }),
  });
  assert.equal(seed.status, 200, await seed.text());
});

test("anonymous users can save and read a completed game with a server timestamp", async () => {
  const id = randomUUID();
  const game = await saveGame(id, entry, firestore);
  assert.equal(game.sequence, 11);
  assert.equal(game.winnerPlayerId, "bp");
  const saved = await getDoc(doc(firestore, "games", id));
  assert.deepEqual(saved.data()?.participants, entry.participants);
  assert.ok(saved.data()?.createdAt instanceof Timestamp);
  assert.deepEqual((await getDoc(counterRef)).data(), { sequence: 11, gameId: id });
});

test("retrying a confirmed or uncertain submission does not add a duplicate", async () => {
  const id = randomUUID();
  const first = await saveGame(id, entry, firestore);
  const repeated = await saveGame(id, entry, firestore);
  assert.deepEqual(repeated, first);
  assert.equal((await getDocs(collection(firestore, "games"))).size, 1);
  assert.equal((await getDoc(counterRef)).data()?.sequence, 11);
  await assert.rejects(saveGame(id, { ...entry, winnerPlayerId: "ci" }, firestore), /different details/);
});

test("concurrent games receive distinct consecutive sequence numbers", async () => {
  const games = await Promise.all([
    saveGame(randomUUID(), entry, firestore),
    saveGame(randomUUID(), entry, firestore),
  ]);
  assert.deepEqual(games.map((game) => game.sequence).sort(), [11, 12]);
  assert.equal((await getDocs(collection(firestore, "games"))).size, 2);
  assert.equal((await getDoc(counterRef)).data()?.sequence, 12);
});

test("simultaneous retries of the same submission create only one game", async () => {
  const id = randomUUID();
  const games = await Promise.all([saveGame(id, entry, firestore), saveGame(id, entry, firestore)]);
  assert.deepEqual(games[0], games[1]);
  assert.equal((await getDocs(collection(firestore, "games"))).size, 1);
  assert.equal((await getDoc(counterRef)).data()?.sequence, 11);
});

test("valid six-player games and unknown scores are accepted", async () => {
  const game = prepareGame({
    participants: [
      { playerId: "ci", raceId: "bl" }, { playerId: "bp", raceId: "bk" },
      { playerId: "ck", raceId: "yw" }, { playerId: "vi", raceId: "rd" },
      { playerId: "cg", raceId: "tr" }, { playerId: "jr", raceId: "tr" },
    ],
    winnerPlayerId: "ci",
    winnerPoints: "",
  });
  const saved = await saveGame(randomUUID(), game, firestore);
  assert.equal(saved.participants.length, 6);
  assert.ok(saved.participants.every((p) => p.points === null));
});

test("rules reject duplicate non-Terran races in any seat but allow six Terrans", async () => {
  const allTerrans = prepareGame({
    participants: Object.keys(players).slice(0, 6).map((playerId) => ({ playerId, raceId: "tr" })),
    winnerPlayerId: "bp",
    winnerPoints: "",
  });
  for (const raceId of Object.keys(races).filter((id) => id !== "tr")) {
    for (const participantCount of [2, 6]) {
      const participants = allTerrans.participants.slice(0, participantCount).map((p, index) => ({
        ...p,
        raceId: index === 0 || index === participantCount - 1 ? raceId : p.raceId,
      }));
      const id = randomUUID();
      const batch = writeBatch(firestore);
      batch.set(doc(firestore, "games", id), {
        ...allTerrans, participants, playerCount: participantCount,
        schemaVersion: 1, sequence: 11, createdAt: serverTimestamp(),
      });
      batch.update(counterRef, { sequence: 11, gameId: id });
      await denied(batch.commit());
    }
  }
  assert.equal((await getDocs(collection(firestore, "games"))).size, 0);
  const saved = await saveGame(randomUUID(), allTerrans, firestore);
  assert.equal(saved.sequence, 11);
  assert.equal(saved.participants.filter((p) => p.raceId === "tr").length, 6);
});

test("server rules reject malformed game records even when clients bypass form validation", async () => {
  const valid = { ...entry, schemaVersion: 1, sequence: 11, createdAt: serverTimestamp() };
  const invalid = [
    { ...valid, participants: [entry.participants[0], entry.participants[0]] },
    { ...valid, participants: [{ ...entry.participants[0], playerId: "unknown" }, entry.participants[1]] },
    { ...valid, participants: [{ ...entry.participants[0], raceId: "unknown" }, entry.participants[1]] },
    { ...valid, participants: [{ playerId: "ci", raceId: "tr" }, entry.participants[1]] },
    { ...valid, participants: [{ ...entry.participants[0], points: 9 }, entry.participants[1]] },
    { ...valid, participants: [entry.participants[0], { ...entry.participants[1], points: -1 }] },
    { ...valid, participants: [entry.participants[0], { ...entry.participants[1], points: 1.5 }] },
    { ...valid, participants: [entry.participants[0], { ...entry.participants[1], points: 9007199254740992 }] },
    { ...valid, playerCount: 1 },
    { ...valid, playerCount: 3 },
    { ...valid, playerCount: 7 },
    { ...valid, winnerPlayerId: "jr" },
    { ...valid, schemaVersion: 2 },
    { ...valid, sequence: 12 },
    { ...valid, playedAt: "invalid" },
    { ...valid, createdAt: Timestamp.fromMillis(0) },
    { ...valid, unexpectedField: true },
  ];
  for (const data of invalid) {
    const id = randomUUID();
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, "games", id), data);
    batch.update(counterRef, { sequence: data.sequence, gameId: id });
    await denied(batch.commit());
  }
  assert.equal((await getDocs(collection(firestore, "games"))).size, 0);
  assert.equal((await getDoc(counterRef)).data()?.sequence, 10);
});

test("sequence allocation cannot be skipped, forged, or incremented without a new game", async () => {
  const id = randomUUID();
  await denied(setDoc(doc(firestore, "games", id), {
    ...entry, schemaVersion: 1, sequence: 11, createdAt: serverTimestamp(),
  }));
  await denied(updateDoc(counterRef, { sequence: 11, gameId: id }));
  await denied(updateDoc(counterRef, { sequence: 9, gameId: id }));
  await denied(setDoc(doc(firestore, "metadata", "anotherCounter"), { sequence: 10 }));
});

test("existing games and the counter cannot be deleted and games cannot be edited", async () => {
  const id = randomUUID();
  await saveGame(id, entry, firestore);
  const gameRef = doc(firestore, "games", id);
  await denied(updateDoc(gameRef, { winnerPlayerId: "ci" }));
  await denied(deleteDoc(gameRef));
  await denied(deleteDoc(counterRef));
  await denied(getDoc(doc(firestore, "private", "example")));
});

test("missing sequence metadata is reported without creating a partial game", async () => {
  const response = await fetch(`${documents}/metadata/gameSequence`, {
    method: "DELETE", headers: { Authorization: "Bearer owner" },
  });
  assert.equal(response.status, 200);
  await assert.rejects(saveGame(randomUUID(), entry, firestore), /not initialized correctly/);
  assert.equal((await getDocs(collection(firestore, "games"))).size, 0);
});
