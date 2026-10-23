import assert from "node:assert/strict";
import { test } from "node:test";
import { seedGames, rows } from "../scripts/stats-seed.ts";
import { importGame, parseGame, players, prepareGame, races, rankStandings, summarizeGames } from "../src/stats/model.ts";
import type { Game } from "../src/stats/model.ts";
import { loadGames } from "../src/stats/firebase.ts";

test("prepares a completed game with an explicit winner even when both players are Terran", () => {
  const game = prepareGame({
    participants: [{ playerId: "ci", raceId: "tr" }, { playerId: "bp", raceId: "tr" }],
    winnerPlayerId: "bp",
    winnerPoints: "43",
  });
  assert.deepEqual(game, {
    playedAt: null,
    playerCount: 2,
    winnerPlayerId: "bp",
    participants: [
      { playerId: "ci", raceId: "tr", points: null },
      { playerId: "bp", raceId: "tr", points: 43 },
    ],
  });
});

test("validates game-entry selections and scores and keeps blank scores unknown", () => {
  const entry = {
    participants: [{ playerId: "ci", raceId: "bl" }, { playerId: "bp", raceId: "bk" }],
    winnerPlayerId: "ci",
    winnerPoints: "",
  };
  assert.equal(prepareGame(entry).participants[0].points, null);
  assert.equal(prepareGame({ ...entry, winnerPoints: "0" }).participants[0].points, 0);
  for (const points of ["-1", "1.5", "NaN", "Infinity", "9007199254740992"]) {
    assert.throws(() => prepareGame({ ...entry, winnerPoints: points }), /whole number/);
  }
  assert.throws(() => prepareGame({ ...entry, winnerPlayerId: "" }), /winning player/);
  assert.throws(() => prepareGame({ ...entry, winnerPlayerId: "jr" }), /winning player/);
  assert.throws(() => prepareGame({ ...entry, participants: [{ playerId: "", raceId: "bk" }] }), /every seat/);
  assert.throws(() => prepareGame({ ...entry, participants: [entry.participants[0], entry.participants[0]] }), /only once/);
  assert.throws(() => prepareGame({ ...entry, participants: [entry.participants[0]] }), /between 2 and 6/);
});

test("new games reject every duplicate non-Terran race and allow up to six Terrans", () => {
  for (const raceId of Object.keys(races).filter((id) => id !== "tr")) {
    assert.throws(() => prepareGame({
      participants: [{ playerId: "ci", raceId }, { playerId: "bp", raceId }],
      winnerPlayerId: "ci",
      winnerPoints: "",
    }), /Each race can be assigned only once, except Terran/);
  }
  const participants = Object.keys(players).slice(0, 6).map((playerId) => ({ playerId, raceId: "tr" }));
  assert.equal(prepareGame({ participants, winnerPlayerId: participants[0].playerId, winnerPoints: "" }).playerCount, 6);
  participants[0].raceId = "rd";
  participants[5].raceId = "rd";
  assert.throws(() => prepareGame({ participants, winnerPlayerId: participants[0].playerId, winnerPoints: "" }), /Each race/);
});

test("loads games directly from Firestore without depending on Firebase Hosting configuration", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    assert.equal(url.origin, "https://firestore.googleapis.com");
    assert.equal(url.pathname, "/v1/projects/eclipse-probability/databases/(default)/documents:runQuery");
    assert.equal(init?.method, "POST");
    const query = JSON.parse(String(init?.body));
    assert.equal(query.structuredQuery.from[0].collectionId, "games");
    return Response.json([{ readTime: "2026-10-22T20:00:00Z" }]);
  });
  assert.deepEqual(await loadGames(), []);
  assert.deepEqual(await loadGames(), []);
  assert.equal(fetchMock.mock.callCount(), 2);
});

test("imports all ten supplied games with unique players, correct winners, and only known scores", () => {
  assert.equal(seedGames.length, 10);
  assert.equal(new Set(seedGames.map((g) => g.id)).size, 10);
  assert.equal(seedGames.reduce((sum, g) => sum + g.playerCount, 0), 44);
  assert.deepEqual(seedGames.map((g) => g.winnerPlayerId), [
    "bp", "ci", "ci", "ck", "vi", "vi", "vi", "ci", "ci", "ci",
  ]);
  assert.deepEqual(seedGames.map((g) => g.participants.find(
    (p) => p.playerId === g.winnerPlayerId,
  )?.points), [null, null, null, 31, null, 29, 33, 43, 43, 40]);
  for (const game of seedGames) {
    assert.equal(game.playedAt, null);
    assert.equal(game.participants.length, game.playerCount);
    assert.equal(new Set(game.participants.map((p) => p.playerId)).size, game.playerCount);
    assert.ok(game.participants.filter((p) => p.playerId !== game.winnerPlayerId)
      .every((p) => p.points === null));
  }
});

test("corrects reversed player/race pairs and rejects unrecognized or ambiguous winners", () => {
  const original = { ...rows[0], playingRaces: "bp-bk,rd-ci,ck-yw,wt-cp,cg-gy" };
  assert.deepEqual(importGame(original, 1), seedGames[0]);
  assert.throws(() => importGame({ ...original, playingRaces: "zz-bp" }, 1), /Invalid race\/player pair/);
  assert.throws(() => importGame({ ...rows[2], winningRace: "tr" }, 3), /exactly one/);
  assert.throws(() => importGame({ ...rows[0], winningRace: "pk" }, 1), /exactly one/);
});

test("rejects invalid stored games instead of silently corrupting statistics", () => {
  const game = seedGames[0];
  const invalid: [unknown, RegExp][] = [
    [null, /game record/],
    [{ ...game, schemaVersion: 2 }, /schema/],
    [{ ...game, sequence: 0 }, /sequence/],
    [{ ...game, playedAt: "not a date" }, /playedAt/],
    [{ ...game, playerCount: 7 }, /playerCount/],
    [{ ...game, playerCount: 4 }, /participant count/],
    [{ ...game, winnerPlayerId: "vi" }, /winner/],
    [{ ...game, participants: game.participants.map((p) => ({ ...p, playerId: "ci" })) }, /multiple seats/],
    [{ ...game, participants: game.participants.map((p) => ({ ...p, raceId: "unknown" })) }, /unknown race/],
    [{ ...game, participants: game.participants.map((p) => ({ ...p, playerId: "constructor" })) }, /unknown player/],
    [{ ...game, participants: game.participants.map((p) => ({ ...p, points: -1 })) }, /points/],
  ];
  for (const [value, message] of invalid) {
    assert.throws(() => parseGame(game.id, value), message);
  }
});

test("six-player wins outrank two-player wins; average chance performance rates 1x", () => {
  const twoPlayer = summarizeGames([seedGames[4]]).players.find((p) => p.id === "vi")!;
  const sixPlayer = summarizeGames([seedGames[3]]).players.find((p) => p.id === "ck")!;
  assert.equal(twoPlayer.winRate, 1);
  assert.equal(sixPlayer.winRate, 1);
  assert.equal(twoPlayer.winRating, 2);
  assert.equal(sixPlayer.winRating, 6);
  const loss: Game = { ...seedGames[4], id: "loss", winnerPlayerId: "ci" };
  const average = summarizeGames([seedGames[4], loss]).players.find((p) => p.id === "vi")!;
  assert.equal(average.winRating, 1);
});

test("rates mixed table sizes by wins divided by the sum of per-game chances", () => {
  const stats = summarizeGames(seedGames);
  const charles = stats.players.find((p) => p.id === "ci")!;
  assert.equal(stats.players.length, 9);
  assert.equal(stats.races.length, 11);
  assert.equal(charles.games, 10);
  assert.equal(charles.wins, 5);
  assert.equal(charles.winRate, 0.5);
  assert.ok(Math.abs(charles.expectedWins - 2.55) < 1e-10);
  assert.ok(Math.abs(charles.winRating - 100 / 51) < 1e-10);
  assert.equal(rankStandings(stats.players, "winRate")[0].id, "ci");
  assert.equal(rankStandings(stats.players, "winRating")[0].id, "ci");
  assert.equal(stats.players.reduce((sum, p) => sum + p.wins, 0), 10);
  assert.equal(stats.races.reduce((sum, r) => sum + r.wins, 0), 10);
});

test("counts both Terran seats without turning a race appearance into an extra win", () => {
  const stats = summarizeGames(seedGames);
  const terran = stats.races.find((r) => r.id === "tr")!;
  assert.equal(terran.games, 5);
  assert.equal(terran.wins, 1);
  assert.equal(terran.winRate, 0.2);
  const charlesRaces = stats.playerRaces.get("ci")!;
  assert.equal(charlesRaces.get("tr")?.games, 2);
  assert.equal(charlesRaces.get("tr")?.wins, 1);
  assert.equal([...charlesRaces.values()].reduce((sum, r) => sum + r.games, 0), 10);
  const sameRace = importGame({
    winningRace: "bl", playerCount: 3, playingRaces: "bl-ci,tr-dl,tr-bp", points: null,
  }, 1);
  const terranWin: Game = { ...sameRace, winnerPlayerId: "dl" };
  assert.equal(summarizeGames([terranWin]).races.find((r) => r.id === "tr")?.wins, 1);
});

test("breaks equivalent rating and rate ties by games played without mutating the input", () => {
  const two = summarizeGames([seedGames[4], { ...seedGames[4], winnerPlayerId: "ci" }])
    .players.find((p) => p.id === "vi")!;
  const hundred = { ...two, id: "ci", name: "Charles", games: 100, wins: 50, expectedWins: 50 };
  const standings = [two, hundred];
  for (const metric of ["winRate", "winRating"] as const) {
    assert.equal(rankStandings(standings, metric)[0].games, 100);
  }
  assert.equal(standings[0].games, 2);
  assert.equal(rankStandings([two, { ...hundred, winRating: 1 + 1e-14 }], "winRating")[0].games, 100);
});

test("empty data produces empty leaderboards and zero-win players remain visible", () => {
  assert.deepEqual(summarizeGames([]).players, []);
  assert.deepEqual(rankStandings([], "winRating"), []);
  const jordan = summarizeGames(seedGames).players.find((p) => p.id === "jr")!;
  assert.equal(jordan.games, 3);
  assert.equal(jordan.wins, 0);
  assert.equal(jordan.winRating, 0);
});
