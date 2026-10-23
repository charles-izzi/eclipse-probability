import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { saveGame } from "./firebase";
import { players, prepareGame, races } from "./model";
import type { Game, GameEntry, NewGame } from "./model";
import "./AddGameForm.css";

function GameConfirmation({
  game, saving, error, onConfirm, onBack,
}: {
  game: NewGame;
  saving: boolean;
  error: string | null;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const winner = game.participants.find((p) => p.playerId === game.winnerPlayerId)!;
  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      className="game-confirmation"
      ref={dialogRef}
      aria-labelledby={headingId}
      aria-busy={saving}
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onBack();
      }}
    >
      <p className="eyebrow">CHECK THE FLIGHT LOG</p>
      <h2 id={headingId}>Confirm completed game</h2>
      <p>This will add one game to the shared history and update everyone's stats.</p>
      <dl className="confirmation-summary">
        <div><dt>Players</dt><dd>{game.playerCount}</dd></div>
        <div><dt>Winner</dt><dd>{players[winner.playerId]} / {races[winner.raceId].name}</dd></div>
        <div><dt>Winning points</dt><dd>{winner.points ?? "Not recorded"}</dd></div>
      </dl>
      <ul className="confirmation-players">
        {game.participants.map((participant) => (
          <li key={participant.playerId}>
            <span>{players[participant.playerId]}</span>
            <span>{races[participant.raceId].name}{participant.playerId === game.winnerPlayerId ? " (winner)" : ""}</span>
          </li>
        ))}
      </ul>
      <p className="entry-help">Games cannot be edited or deleted in the app. Please check these details before confirming.</p>
      {error && <div className="entry-error" role="alert">{error}</div>}
      <div className="entry-actions">
        <button type="button" onClick={onBack} disabled={saving} autoFocus>Back to edit</button>
        <button className="entry-primary" type="button" onClick={onConfirm} disabled={saving}>
          {saving ? "Saving game..." : "Confirm & save game"}
        </button>
      </div>
    </dialog>
  );
}

export default function AddGameForm({
  onSaved, onClose,
}: {
  onSaved: (game: Game) => void;
  onClose: () => void;
}) {
  const [participants, setParticipants] = useState<GameEntry["participants"]>([
    { playerId: "", raceId: "" }, { playerId: "", raceId: "" },
  ]);
  const [winnerPlayerId, setWinnerPlayerId] = useState("");
  const [winnerPoints, setWinnerPoints] = useState("");
  const [confirmation, setConfirmation] = useState<NewGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submissionId] = useState(() => crypto.randomUUID());
  const savingRef = useRef(false);
  const firstField = useRef<HTMLSelectElement>(null);
  const formId = useId();

  useEffect(() => { firstField.current?.focus(); }, []);

  function updateParticipants(next: GameEntry["participants"]) {
    setParticipants(next);
    if (!next.some((p) => p.playerId === winnerPlayerId)) setWinnerPlayerId("");
    setError(null);
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setConfirmation(prepareGame({ participants, winnerPlayerId, winnerPoints }));
      setError(null);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Check the game details before continuing.");
    }
  }

  async function confirm() {
    if (!confirmation || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveGame(submissionId, confirmation);
      onSaved(saved);
    } catch (saveError) {
      console.error("Failed to save completed Eclipse game:", saveError);
      const message = saveError instanceof Error ? saveError.message : "An unexpected error occurred.";
      setError(`The save could not be confirmed. ${message} Retry this submission rather than entering the game again.`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="game-entry page-card" aria-labelledby={`${formId}-heading`}>
      <div className="entry-heading">
        <div><p className="eyebrow">ADD TO THE ARCHIVE</p><h2 id={`${formId}-heading`}>Record a completed game</h2></div>
        <button type="button" onClick={onClose} disabled={saving || confirmation !== null}>Cancel</button>
      </div>
      <p className="entry-help">Choose each player's race, mark the winner, and review the result before saving. No sign-in required.</p>
      <form onSubmit={review}>
        <fieldset disabled={saving || confirmation !== null}>
          <legend className="visually-hidden">Completed game details</legend>
          <label className="entry-count" htmlFor={`${formId}-count`}>Number of players
            <select
              ref={firstField}
              id={`${formId}-count`}
              value={participants.length}
              onChange={(event) => updateParticipants(Array.from(
                { length: Number(event.target.value) },
                (_, index) => participants[index] ?? { playerId: "", raceId: "" },
              ))}
            >
              {[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} players</option>)}
            </select>
          </label>
          <div className="entry-participants">
            {participants.map((participant, index) => (
              <div className="entry-seat" key={index}>
                <span className="entry-seat-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <label htmlFor={`${formId}-player-${index}`}>Player {index + 1}
                  <select
                    id={`${formId}-player-${index}`}
                    required
                    value={participant.playerId}
                    onChange={(event) => updateParticipants(participants.map((p, seat) =>
                      seat === index ? { ...p, playerId: event.target.value } : p,
                    ))}
                  >
                    <option value="">Choose player</option>
                    {Object.entries(players).map(([id, name]) => (
                      <option key={id} value={id} disabled={participants.some((p, seat) => seat !== index && p.playerId === id)}>{name}</option>
                    ))}
                  </select>
                </label>
                <label htmlFor={`${formId}-race-${index}`}>Race {index + 1}
                  <select
                    id={`${formId}-race-${index}`}
                    required
                    value={participant.raceId}
                    onChange={(event) => updateParticipants(participants.map((p, seat) =>
                      seat === index ? { ...p, raceId: event.target.value } : p,
                    ))}
                  >
                    <option value="">Choose race</option>
                    {Object.entries(races).map(([id, race]) => (
                      <option
                        key={id}
                        value={id}
                        disabled={id !== "tr" && participants.some((p, seat) => seat !== index && p.raceId === id)}
                      >{race.name}</option>
                    ))}
                  </select>
                </label>
                <label className="entry-winner">
                  <input
                    type="radio"
                    name={`${formId}-winner`}
                    required
                    disabled={!participant.playerId}
                    checked={Boolean(participant.playerId) && winnerPlayerId === participant.playerId}
                    onChange={() => setWinnerPlayerId(participant.playerId)}
                  />
                  Winner
                  <span className="visually-hidden">: player {index + 1}</span>
                </label>
              </div>
            ))}
          </div>
          <label className="entry-points" htmlFor={`${formId}-points`}>Winning points <span>(optional)</span>
            <input
              id={`${formId}-points`}
              type="number"
              min="0"
              max={Number.MAX_SAFE_INTEGER}
              step="1"
              inputMode="numeric"
              placeholder="Leave blank if unknown"
              value={winnerPoints}
              onChange={(event) => setWinnerPoints(event.target.value)}
            />
          </label>
          {error && !confirmation && <div className="entry-error" role="alert">{error}</div>}
          <div className="entry-actions"><button className="entry-primary" type="submit">Review game</button></div>
        </fieldset>
      </form>
      {confirmation && (
        <GameConfirmation
          game={confirmation}
          saving={saving}
          error={error}
          onConfirm={confirm}
          onBack={() => { setConfirmation(null); setError(null); }}
        />
      )}
    </section>
  );
}
