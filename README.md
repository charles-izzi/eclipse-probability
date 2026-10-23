# Eclipse companion

A React + TypeScript app with a battle probability calculator at `/` and an
Eclipse game statistics dashboard at `/stats`.
Both pages share the same dark theme, navigation, and responsive page layout.

## Development

Use Node.js 22.18+ (the import and tests use Node's built-in TypeScript support).

```sh
npm ci
npm run dev
npm test
npm run build
npm run lint
```

The stats page reads real Firestore data, with explicit loading, empty, error,
and retry states. It never falls back to embedded sample games. Use **Refresh**
to read new games without reloading the page.

The public Firebase web SDK configuration is bundled in `src/stats/firebase.ts`.
Development, preview, and production connect directly to Firestore without an
extra Firebase Hosting configuration request or a local proxy. The public API key
identifies the project; it does not grant database access. Firestore rules enforce
permissions. No admin credentials or private keys belong in the browser or build
environment.

## Adding a completed game

On **Game stats**, choose **Add game**, select 2-6 players and their races, mark
the winning player, and optionally enter the winner's points. **Review game**
opens a confirmation dialog with the complete result. Nothing is saved until
**Confirm & save game** is selected. **Back to edit** or Escape returns to the
form without writing anything.

Players and non-Terran races can each be selected only once per game. Assigned
races are disabled in other seats until released; Terran can be used by multiple
players. This restriction is also enforced when validating and saving new games.

After Firebase confirms the save, the dashboard updates immediately. Failed
saves keep the form details; retry the same submission rather than entering it
again. The submission ID is reused on retries to prevent duplicate records.
Games cannot be edited or deleted in the app.

Game entry is intentionally public, without sign-in. Server rules validate new
records and prohibit edits/deletes, but do not establish who submitted a game or
prevent someone from submitting fabricated games or spam. Authentication and
abuse controls should be added before sharing this beyond a trusted group.

## Rankings

- **Win rate:** wins divided by player appearances.
- **Win rating:** wins divided by expected wins. Each appearance contributes
  `1 / playerCount` expected wins, so a 1.00x rating matches an equal-chance
  baseline. Winning your only six-player game rates 6.00x; winning your only
  two-player game rates 2.00x. Mixed table sizes use the sum of their individual
  probabilities, not the reciprocal of their average size.
- **Tie-breaks:** more games played, then alphabetical name. Game counts are
  displayed alongside ratings. This is a descriptive rating, not Elo or a
  confidence-adjusted estimate; small samples can rank highly.

Race statistics count seats rather than distinct games. A game with two Terrans
contributes two Terran appearances but at most one Terran win. Selecting a player
shows their race distribution and race-specific ratings. The first-ranked player
is selected by default; explicit selections persist when switching ranking tabs.

## Firestore storage and import

Project: `eclipse-probability`. Database: `(default)`, region: `us-east1`.
The initial ten games are stored in the `games` collection. The supplied player
and race code dictionaries live in `src/stats/model.ts`.

Each game document has:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Currently `1`; validated when reading |
| `sequence` | Positive import/history order, independent of document ID |
| `playedAt` | ISO date-time or `null` when unknown |
| `playerCount` | Number of participants, between 2 and 6 |
| `winnerPlayerId` | Explicit player code, not a potentially ambiguous race |
| `participants` | Array of `{ playerId, raceId, points }` records |
| `createdAt` | Server timestamp for games added through the form; absent on historical imports |

Player codes are stable IDs. Race colors use the supplied codes, including `tr`
for Terran. Scores from the source table are stored on the winning participant;
all other scores and the missing game dates are `null`, not inferred. The
`import-2026-10-*` document IDs identify the import batch, not game dates.
The importer recognizes reversed player/race pairs, rejects duplicate players,
checks table sizes, and refuses to guess a winner when the winning race occurs
more than once.

New games reserve the next `sequence` in a transaction with
`metadata/gameSequence`, keeping recording order unique across simultaneous
submissions. The counter can advance only alongside a valid new game; it cannot
be edited independently. This recording order and the server timestamp are not
assertions about when the game was played: `playedAt` stays `null` in this form.
Elo and tied winners are not implemented yet.

### Admin setup

For a fresh project database, create it once:

```sh
firebase firestore:databases:create "(default)" --location us-east1 --project eclipse-probability
firebase deploy --only firestore:rules --project eclipse-probability
```

`firestore.rules` permits public reads and validated, create-only game writes.
It checks participant counts, known player/race codes, unique players and
non-Terran races, winner membership, score validity, allowed fields, server timestamps, and atomic
sequence allocation. Existing games cannot be updated or deleted. The sequence
document permits reads and only the paired transaction update; other documents
are denied by default. Admin IAM credentials bypass these rules. Hosting
workflows deploy the application only; deploy rules explicitly when changing them.

To import, authenticate with Google Application Default Credentials (for example
`gcloud auth application-default login`) with Firestore write access, then run:

```sh
npm run seed:stats
```

Alternatively, an authenticated admin tool can supply a short-lived OAuth token
through `FIREBASE_ACCESS_TOKEN`. Never commit tokens or service-account keys.
The import validates all ten source rows before contacting Firestore and writes
missing documents in one atomic, create-only batch. It also initializes the
sequence counter from the highest existing/imported sequence if the counter is
missing. Run it once before enabling game entry on an existing installation,
then deploy the updated rules. Stable IDs make reruns safe: existing records,
including corrections and the existing counter, are left unchanged.

### Storage-rule checks

With Java 21+ and the Firebase CLI installed, run:

```sh
npm run test:rules
```

This starts and stops a local Firestore emulator on `127.0.0.1:8085` using the
isolated `demo-eclipse-stats` project. Tests refuse to run without that emulator
and never write test games to the live project. They cover anonymous creation,
confirmation-save retry idempotency, concurrent recording order, malformed
submissions, and denied edits/deletes.
