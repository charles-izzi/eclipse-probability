import { FirebaseError, getApps, initializeApp } from "firebase/app";
import { collection, doc, getDoc, getDocs, getFirestore, runTransaction, serverTimestamp } from "firebase/firestore/lite";
import type { Firestore } from "firebase/firestore/lite";
import { parseGame } from "./model.ts";
import type { Game, NewGame } from "./model.ts";

function database() {
  // Public web configuration, not admin credentials. Access is enforced by Firestore rules.
  const app = getApps().find((candidate) => candidate.name === "eclipse-stats") ??
    initializeApp({
      projectId: "eclipse-probability",
      apiKey: "AIzaSyBheZPrlDLXoDjhs38oP5aHeoGsb3Iga5c",
      appId: "1:974980928770:web:039867b7c70b6647649e1b",
    }, "eclipse-stats");
  return getFirestore(app);
}

export async function loadGames(): Promise<Game[]> {
  const snapshot = await getDocs(collection(database(), "games"));
  return snapshot.docs.map((document) => parseGame(document.id, document.data()))
    .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
}

export async function saveGame(id: string, entry: NewGame, firestore: Firestore = database()): Promise<Game> {
  const validated = parseGame(id, { ...entry, schemaVersion: 1, sequence: 1 });
  const gameRef = doc(firestore, "games", id);
  const sequenceRef = doc(firestore, "metadata", "gameSequence");
  for (let attempt = 0;;attempt++) {
    let attemptedSequence: number | undefined;
    try {
      return await runTransaction(firestore, async (transaction) => {
        const existing = await transaction.get(gameRef);
        if (existing.exists()) {
          const game = parseGame(id, existing.data());
          // Reuse a submission ID on retry, including when a successful response was lost.
          if (
            game.winnerPlayerId !== validated.winnerPlayerId ||
            game.playerCount !== validated.playerCount ||
            game.playedAt !== validated.playedAt ||
            JSON.stringify(game.participants) !== JSON.stringify(validated.participants)
          ) throw new Error("This submission was already saved with different details. Refresh the game history before adding another result.");
          return game;
        }
        const counter = await transaction.get(sequenceRef);
        const previousSequence: unknown = counter.data()?.sequence;
        if (
          !counter.exists() || typeof previousSequence !== "number" ||
          !Number.isSafeInteger(previousSequence) || previousSequence < 0 ||
          previousSequence >= Number.MAX_SAFE_INTEGER
        ) throw new Error("Game storage is not initialized correctly. An administrator must run the stats import before games can be added.");
        attemptedSequence = previousSequence;
        const game = { ...validated, sequence: previousSequence + 1 };
        transaction.set(gameRef, {
          schemaVersion: game.schemaVersion,
          sequence: game.sequence,
          playedAt: game.playedAt,
          playerCount: game.playerCount,
          winnerPlayerId: game.winnerPlayerId,
          participants: game.participants,
          createdAt: serverTimestamp(),
        });
        transaction.update(sequenceRef, { sequence: game.sequence, gameId: id });
        return game;
      });
    } catch (error) {
      if (
        attempt >= 2 || attemptedSequence === undefined ||
        !(error instanceof FirebaseError) || error.code !== "permission-denied"
      ) throw error;
      // Rules may reject a stale sequence before Firestore checks the transaction version.
      // Only retry when a fresh read proves that another game advanced the counter.
      const latestSequence: unknown = (await getDoc(sequenceRef)).data()?.sequence;
      if (typeof latestSequence !== "number" || latestSequence <= attemptedSequence) throw error;
    }
  }
}
