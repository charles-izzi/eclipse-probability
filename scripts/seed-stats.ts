import { GoogleAuth } from "google-auth-library";
import { seedGames } from "./stats-seed.ts";

const projectId = "eclipse-probability";
const database = `projects/${projectId}/databases/(default)`;
const endpoint = `https://firestore.googleapis.com/v1/${database}/documents`;
const accessToken = process.env.FIREBASE_ACCESS_TOKEN ??
  await new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/datastore"],
  }).getAccessToken();
if (!accessToken) throw new Error("No Google credentials available for the stats import.");

async function request(url: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

function firestoreValue(value: unknown): object {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return { integerValue: String(value) };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === "object") return { mapValue: { fields: firestoreFields(value) } };
  throw new Error(`Unsupported Firestore seed value: ${typeof value}`);
}

function firestoreFields(value: object): Record<string, object> {
  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => [key, firestoreValue(field)]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const writes = [];
for (const game of seedGames) {
  const { id, ...data } = game;
  const name = `${database}/documents/games/${id}`;
  const existing = await request(`${endpoint}/games/${id}`);
  if (existing.ok) {
    console.log(`Already exists (left unchanged): ${id}`);
    continue;
  }
  if (existing.status !== 404) {
    throw new Error(`Cannot inspect ${id}: ${existing.status} ${await existing.text()}`);
  }
  writes.push({
    update: { name, fields: firestoreFields(data) },
    currentDocument: { exists: false },
  });
}
const gameWriteCount = writes.length;
const counter = await request(`${endpoint}/metadata/gameSequence`);
if (counter.status === 404) {
  const latest = await request(`${endpoint}:runQuery`, {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "games" }],
        orderBy: [{ field: { fieldPath: "sequence" }, direction: "DESCENDING" }],
        limit: 1,
      },
    }),
  });
  if (!latest.ok) throw new Error(`Cannot initialize game sequence: ${latest.status} ${await latest.text()}`);
  const documents = await latest.json();
  if (!Array.isArray(documents) || documents.length > 1) throw new Error("Unexpected latest-game query response.");
  const row: unknown = documents[0];
  let previousSequence = 0;
  if (isRecord(row) && "document" in row) {
    const document = row.document;
    if (
      !isRecord(document) || !isRecord(document.fields) ||
      !isRecord(document.fields.sequence) || typeof document.fields.sequence.integerValue !== "string"
    ) throw new Error("Existing game sequence is missing or invalid.");
    previousSequence = Number(document.fields.sequence.integerValue);
    if (!Number.isSafeInteger(previousSequence) || previousSequence < 1) throw new Error("Existing game sequence is invalid.");
  } else if (documents.length > 0 && (!isRecord(row) || typeof row.readTime !== "string")) {
    throw new Error("Unexpected empty latest-game query response.");
  }
  const sequence = Math.max(
    ...seedGames.map((game) => game.sequence),
    previousSequence,
  );
  if (!Number.isSafeInteger(sequence)) throw new Error("Existing game sequence is invalid.");
  writes.push({
    update: {
      name: `${database}/documents/metadata/gameSequence`,
      fields: firestoreFields({ sequence, gameId: null }),
    },
    currentDocument: { exists: false },
  });
  console.log(`Initializing game sequence at ${sequence}.`);
} else if (!counter.ok) {
  throw new Error(`Cannot inspect game sequence: ${counter.status} ${await counter.text()}`);
}
if (writes.length > 0) {
  // One atomic, create-only commit: rerunning never overwrites corrections or new games.
  const response = await request(`${endpoint}:commit`, {
    method: "POST",
    body: JSON.stringify({ writes }),
  });
  if (!response.ok) throw new Error(`Import failed: ${response.status} ${await response.text()}`);
}
console.log(`Imported ${gameWriteCount} games into ${projectId}; ${seedGames.length - gameWriteCount} already existed.`);
