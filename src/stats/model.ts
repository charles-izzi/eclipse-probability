export const players = {
  bp: "Big Pher",
  ci: "Charles",
  ck: "Chuck",
  cp: "Chris P",
  cg: "Chris G",
  cd: "Christina",
  vi: "Vinnie",
  dl: "Dan",
  jr: "Jordan",
} as const;

export const races = {
  bk: { name: "Black", color: "#303846" },
  yw: { name: "Yellow", color: "#f4cf58" },
  br: { name: "Brown", color: "#a67553" },
  rd: { name: "Red", color: "#ed777b" },
  wt: { name: "White", color: "#e8edf4" },
  gn: { name: "Green", color: "#70bc95" },
  bl: { name: "Blue", color: "#7aa7f5" },
  pk: { name: "Pink", color: "#e9a3cf" },
  or: { name: "Orange", color: "#f1a263" },
  gy: { name: "Gray", color: "#9ca8b9" },
  tr: { name: "Terran", color: "#a797ed" },
} as const;

export type PlayerId = keyof typeof players;
export type RaceId = keyof typeof races;

export interface Participant {
  playerId: PlayerId;
  raceId: RaceId;
  points: number | null;
}

export interface Game {
  id: string;
  schemaVersion: 1;
  // Import order is not a known date. Keep both for a future chronological Elo history.
  sequence: number;
  playedAt: string | null;
  playerCount: number;
  winnerPlayerId: PlayerId;
  participants: Participant[];
}

export interface ImportRow {
  winningRace: string;
  playerCount: number;
  playingRaces: string;
  points: number | null;
}

export interface GameEntry {
  participants: { playerId: string; raceId: string }[];
  winnerPlayerId: string;
  winnerPoints: string;
}

export type NewGame = Pick<Game, "playedAt" | "playerCount" | "winnerPlayerId" | "participants">;

export function prepareGame(entry: GameEntry): NewGame {
  if (entry.participants.some((p) => !isPlayerId(p.playerId) || !isRaceId(p.raceId))) {
    throw new Error("Choose a player and a race for every seat.");
  }
  if (new Set(entry.participants.map((p) => p.playerId)).size !== entry.participants.length) {
    throw new Error("Each player can appear only once in a game.");
  }
  const nonTerranRaces = entry.participants.filter((p) => p.raceId !== "tr").map((p) => p.raceId);
  if (new Set(nonTerranRaces).size !== nonTerranRaces.length) {
    throw new Error("Each race can be assigned only once, except Terran.");
  }
  if (!entry.participants.some((p) => p.playerId === entry.winnerPlayerId)) {
    throw new Error("Choose the winning player.");
  }
  const points = entry.winnerPoints.trim() === "" ? null : Number(entry.winnerPoints);
  if (points !== null && (!Number.isSafeInteger(points) || points < 0)) {
    throw new Error("Winning points must be a nonnegative whole number, or left blank.");
  }
  const game = parseGame("new", {
    schemaVersion: 1,
    sequence: 1,
    playedAt: null,
    playerCount: entry.participants.length,
    winnerPlayerId: entry.winnerPlayerId,
    participants: entry.participants.map((participant) => ({
      ...participant,
      points: participant.playerId === entry.winnerPlayerId ? points : null,
    })),
  });
  return {
    playedAt: game.playedAt,
    playerCount: game.playerCount,
    winnerPlayerId: game.winnerPlayerId,
    participants: game.participants,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPlayerId(value: unknown): value is PlayerId {
  return typeof value === "string" && Object.hasOwn(players, value);
}

export function isRaceId(value: unknown): value is RaceId {
  return typeof value === "string" && Object.hasOwn(races, value);
}

export function parseGame(id: string, value: unknown): Game {
  const invalid = (reason: string): never => {
    throw new Error(`Invalid game "${id}": ${reason}`);
  };
  if (!isRecord(value)) return invalid("expected a game record");
  if (value.schemaVersion !== 1) return invalid("unsupported schema version");
  if (
    typeof value.sequence !== "number" ||
    !Number.isSafeInteger(value.sequence) ||
    value.sequence < 1
  ) return invalid("sequence must be a positive integer");
  if (
    value.playedAt !== null &&
    (typeof value.playedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T/.test(value.playedAt) ||
      !Number.isFinite(Date.parse(value.playedAt)))
  ) return invalid("playedAt must be an ISO timestamp or null");
  if (
    typeof value.playerCount !== "number" ||
    !Number.isSafeInteger(value.playerCount) ||
    value.playerCount < 2 ||
    value.playerCount > 6
  ) return invalid("playerCount must be between 2 and 6");
  if (
    !Array.isArray(value.participants) ||
    value.participants.length !== value.playerCount
  ) return invalid("participant count does not match playerCount");
  const participants = value.participants.map((participant): Participant => {
    if (!isRecord(participant)) return invalid("expected a participant record");
    if (!isPlayerId(participant.playerId)) return invalid("unknown player");
    if (!isRaceId(participant.raceId)) return invalid("unknown race");
    if (
      participant.points !== null &&
      (typeof participant.points !== "number" ||
        !Number.isSafeInteger(participant.points) ||
        participant.points < 0)
    ) return invalid("points must be a nonnegative integer or null");
    return {
      playerId: participant.playerId,
      raceId: participant.raceId,
      points: participant.points,
    };
  });
  if (new Set(participants.map((p) => p.playerId)).size !== participants.length) {
    return invalid("a player cannot occupy multiple seats");
  }
  if (
    !isPlayerId(value.winnerPlayerId) ||
    !participants.some((p) => p.playerId === value.winnerPlayerId)
  ) return invalid("winner must be a participant");
  return {
    id,
    schemaVersion: 1,
    sequence: value.sequence,
    playedAt: value.playedAt,
    playerCount: value.playerCount,
    winnerPlayerId: value.winnerPlayerId,
    participants,
  };
}

export function importGame(row: ImportRow, sequence: number): Game {
  const participants = row.playingRaces.split(",").map((pair): Participant => {
    const codes = pair.trim().toLowerCase().split("-");
    const [first, second] = codes;
    if (codes.length === 2) {
      if (isRaceId(first) && isPlayerId(second)) {
        return { raceId: first, playerId: second, points: null };
      }
      if (isPlayerId(first) && isRaceId(second)) {
        return { raceId: second, playerId: first, points: null };
      }
    }
    throw new Error(`Invalid race/player pair "${pair}" in row ${sequence}`);
  });
  const winners = participants.filter((p) => p.raceId === row.winningRace);
  if (winners.length !== 1) {
    throw new Error(`Row ${sequence} must identify exactly one winning player`);
  }
  winners[0].points = row.points;
  return parseGame(`import-2026-10-${String(sequence).padStart(3, "0")}`, {
    schemaVersion: 1,
    sequence,
    playedAt: null,
    playerCount: row.playerCount,
    winnerPlayerId: winners[0].playerId,
    participants,
  });
}

export interface Standing<Id extends string> {
  id: Id;
  name: string;
  games: number;
  wins: number;
  expectedWins: number;
  winRate: number;
  winRating: number;
}

export type Metric = "winRate" | "winRating";

function recordAppearance<Id extends string>(
  standings: Map<Id, Standing<Id>>,
  id: Id,
  name: string,
  won: boolean,
  playerCount: number,
) {
  const standing = standings.get(id) ?? {
    id, name, games: 0, wins: 0, expectedWins: 0, winRate: 0, winRating: 0,
  };
  standing.games += 1;
  standing.wins += Number(won);
  standing.expectedWins += 1 / playerCount;
  standing.winRate = standing.wins / standing.games;
  standing.winRating = standing.wins / standing.expectedWins;
  standings.set(id, standing);
}

export function rankStandings<Id extends string>(
  standings: readonly Standing<Id>[],
  metric: Metric,
): Standing<Id>[] {
  return [...standings].sort((a, b) => {
    const difference = b[metric] - a[metric];
    // Summed fractions can differ by rounding even for mathematically equal ratings.
    if (Math.abs(difference) > 1e-10) return difference;
    return b.games - a.games || a.name.localeCompare(b.name);
  });
}

export function summarizeGames(games: readonly Game[]) {
  const playerStandings = new Map<PlayerId, Standing<PlayerId>>();
  const raceStandings = new Map<RaceId, Standing<RaceId>>();
  const playerRaces = new Map<PlayerId, Map<RaceId, Standing<RaceId>>>();
  for (const game of games) {
    for (const participant of game.participants) {
      const { playerId, raceId } = participant;
      const won = playerId === game.winnerPlayerId;
      recordAppearance(playerStandings, playerId, players[playerId], won, game.playerCount);
      recordAppearance(raceStandings, raceId, races[raceId].name, won, game.playerCount);
      const raceHistory = playerRaces.get(playerId) ?? new Map<RaceId, Standing<RaceId>>();
      recordAppearance(raceHistory, raceId, races[raceId].name, won, game.playerCount);
      playerRaces.set(playerId, raceHistory);
    }
  }
  return {
    players: [...playerStandings.values()],
    races: [...raceStandings.values()],
    playerRaces,
  };
}
