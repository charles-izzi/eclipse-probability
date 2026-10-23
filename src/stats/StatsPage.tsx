import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { loadGames } from "./firebase";
import AddGameForm from "./AddGameForm";
import { races, rankStandings, summarizeGames } from "./model";
import type { Game, Metric, PlayerId, RaceId, Standing } from "./model";
import "./StatsPage.css";

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const rating = (value: number) => `${value.toFixed(2)}x`;
const metricName = (metric: Metric) => metric === "winRate" ? "Win rate" : "Win rating";
const gameCount = (count: number) => `${count} ${count === 1 ? "game" : "games"}`;

function MetricTabs({
  id, label, metric, onChange,
}: {
  id: string;
  label: string;
  metric: Metric;
  onChange: (metric: Metric) => void;
}) {
  const tabs = useRef<HTMLDivElement>(null);
  const metrics: Metric[] = ["winRate", "winRating"];
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === "Home" ? 0 : event.key === "End" ? 1 : metric === "winRate" ? 1 : 0;
    onChange(metrics[index]);
    tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
  }
  return (
    <div className="metric-tabs" role="tablist" aria-label={label} ref={tabs}>
      {metrics.map((value) => (
        <button
          key={value}
          id={`${id}-${value}`}
          type="button"
          role="tab"
          aria-selected={metric === value}
          aria-controls={`${id}-panel`}
          tabIndex={metric === value ? 0 : -1}
          onClick={() => onChange(value)}
          onKeyDown={onKeyDown}
        >{metricName(value)}</button>
      ))}
    </div>
  );
}

function RaceDot({ raceId }: { raceId: RaceId }) {
  return <span className="race-dot" style={{ backgroundColor: races[raceId].color }} aria-hidden="true" />;
}

function RacePie({ standings, name }: { standings: Standing<RaceId>[]; name: string }) {
  const titleId = useId();
  const total = standings.reduce((sum, standing) => sum + standing.games, 0);
  const sorted = [...standings].sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));
  return (
    <div className="race-chart">
      <svg viewBox="0 0 200 200" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{name}'s races played: {sorted.map((r) => `${r.name} ${gameCount(r.games)}`).join(", ")}</title>
        {sorted.map((standing, index) => {
          const fraction = standing.games / total;
          const offset = sorted.slice(0, index).reduce((sum, race) => sum + race.games, 0) / total;
          const start = offset * Math.PI * 2 - Math.PI / 2;
          const end = (offset + fraction) * Math.PI * 2 - Math.PI / 2;
          if (fraction === 1) {
            return <circle key={standing.id} cx="100" cy="100" r="90" fill={races[standing.id].color} />;
          }
          const path = `M 100 100 L ${100 + 90 * Math.cos(start)} ${100 + 90 * Math.sin(start)} A 90 90 0 ${fraction > 0.5 ? 1 : 0} 1 ${100 + 90 * Math.cos(end)} ${100 + 90 * Math.sin(end)} Z`;
          return <path key={standing.id} d={path} fill={races[standing.id].color} stroke="#141e2d" strokeWidth="2" />;
        })}
      </svg>
      <ul className="chart-legend" aria-label="Race appearances">
        {sorted.map((standing) => (
          <li key={standing.id}>
            <span><RaceDot raceId={standing.id} />{standing.name}</span>
            <span>{standing.games} <small>({percent(standing.games / total)})</small></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Dashboard({ games }: { games: Game[] }) {
  const stats = useMemo(() => summarizeGames(games), [games]);
  const [playerMetric, setPlayerMetric] = useState<Metric>("winRating");
  const [raceMetric, setRaceMetric] = useState<Metric>("winRating");
  const [selection, setSelection] = useState<PlayerId | null>(null);
  const playerLeaders = rankStandings(stats.players, playerMetric);
  const raceLeaders = rankStandings(stats.races, raceMetric);
  const selected = playerLeaders.find((p) => p.id === selection) ?? playerLeaders[0];
  const selectedRaces = rankStandings(
    [...(stats.playerRaces.get(selected.id)?.values() ?? [])], "winRating",
  );
  const appearances = games.reduce((sum, game) => sum + game.playerCount, 0);
  const playerTabsId = useId();
  const raceTabsId = useId();

  return (
    <>
      <div className="stats-overview" aria-label="Game history summary">
        <div><span>Games recorded</span><strong>{games.length.toString().padStart(2, "0")}</strong><small>Every game. Every victory.</small></div>
        <div><span>Players at the table</span><strong>{stats.players.length.toString().padStart(2, "0")}</strong><small>Across {appearances} player appearances</small></div>
        <div><span>Races represented</span><strong>{stats.races.length.toString().padStart(2, "0")}</strong><small>A galaxy of different strategies</small></div>
        <div><span>Average table size</span><strong>{(appearances / games.length).toFixed(1)}</strong><small>Players per game</small></div>
      </div>

      <div className="leaderboard-grid">
        <section className="stats-card page-card" aria-labelledby="player-leaders-heading">
          <div className="card-heading">
            <div><p className="eyebrow">THE COMMANDERS</p><h2 id="player-leaders-heading">Player leaderboard</h2></div>
            <span className="count-badge">{stats.players.length} players</span>
          </div>
          <div className="card-toolbar">
            <MetricTabs id={playerTabsId} label="Player ranking" metric={playerMetric} onChange={setPlayerMetric} />
            <span>Select a player to explore</span>
          </div>
          <div className="table-scroll" role="tabpanel" id={`${playerTabsId}-panel`} aria-labelledby={`${playerTabsId}-${playerMetric}`} tabIndex={0}>
            <table className="standings-table">
              <caption className="visually-hidden">Players ranked by {metricName(playerMetric).toLowerCase()}</caption>
              <thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Wins / games</th><th scope="col" aria-sort="descending">{metricName(playerMetric)}</th></tr></thead>
              <tbody>
                {playerLeaders.map((player, index) => (
                  <tr key={player.id} className={selected.id === player.id ? "selected-player" : undefined}>
                    <td><span className={index === 0 ? "rank first-rank" : "rank"}>{String(index + 1).padStart(2, "0")}</span></td>
                    <th scope="row">
                      <button className="player-select" aria-pressed={selected.id === player.id} onClick={() => setSelection(player.id)}>
                        <span className="player-avatar" aria-hidden="true">{player.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                        {player.name}
                        {selected.id === player.id && <span className="selection-dot" aria-label="Selected" />}
                      </button>
                    </th>
                    <td className="record-cell">{player.wins} <span>/ {player.games}</span></td>
                    <td className="metric-cell"><strong>{playerMetric === "winRate" ? percent(player.winRate) : rating(player.winRating)}</strong><small>(out of {gameCount(player.games)} played)</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="card-footnote">Tied scores favor more games played.</p>
        </section>

        <section className="stats-card page-card" aria-labelledby="race-leaders-heading">
          <div className="card-heading">
            <div><p className="eyebrow">THE FACTIONS</p><h2 id="race-leaders-heading">Race leaderboard</h2></div>
            <span className="count-badge">{stats.races.length} races</span>
          </div>
          <div className="card-toolbar">
            <MetricTabs id={raceTabsId} label="Race ranking" metric={raceMetric} onChange={setRaceMetric} />
            <span>Across all players</span>
          </div>
          <div className="table-scroll" role="tabpanel" id={`${raceTabsId}-panel`} aria-labelledby={`${raceTabsId}-${raceMetric}`} tabIndex={0}>
            <table className="standings-table">
              <caption className="visually-hidden">Races ranked by {metricName(raceMetric).toLowerCase()}</caption>
              <thead><tr><th scope="col">Rank</th><th scope="col">Race</th><th scope="col">Wins / appearances</th><th scope="col" aria-sort="descending">{metricName(raceMetric)}</th></tr></thead>
              <tbody>
                {raceLeaders.map((race, index) => (
                  <tr key={race.id}>
                    <td><span className={index === 0 ? "rank first-rank" : "rank"}>{String(index + 1).padStart(2, "0")}</span></td>
                    <th scope="row"><span className="race-name"><RaceDot raceId={race.id} />{race.name}</span></th>
                    <td className="record-cell">{race.wins} <span>/ {race.games}</span></td>
                    <td className="metric-cell"><strong>{raceMetric === "winRate" ? percent(race.winRate) : rating(race.winRating)}</strong><small>({race.games} appearances)</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="card-footnote">Each seat counts once, including games with multiple Terrans.</p>
        </section>
      </div>

      <section className="stats-card page-card player-profile" aria-labelledby="player-profile-heading">
        <div className="profile-heading">
          <div><p className="eyebrow">PLAYER SPOTLIGHT</p><h2 id="player-profile-heading" aria-live="polite">{selected.name}<span>'s flight record</span></h2></div>
          <div className="profile-summary">
            <span><strong>{selected.games}</strong> {selected.games === 1 ? "game" : "games"}</span>
            <span><strong>{selected.wins}</strong> {selected.wins === 1 ? "win" : "wins"}</span>
            <span><strong>{rating(selected.winRating)}</strong> win rating</span>
          </div>
        </div>
        <div className="profile-grid">
          <div className="profile-chart-panel">
            <h3>Races played</h3>
            <p className="section-description">The factions behind the player.</p>
            <RacePie standings={selectedRaces} name={selected.name} />
          </div>
          <div className="profile-races-panel">
            <h3>Performance by race</h3>
            <p className="section-description">Ranked by player-count-adjusted win rating.</p>
            <div className="table-scroll" tabIndex={0} role="region" aria-label={`${selected.name}'s race performance`}>
              <table className="standings-table profile-table">
                <caption className="visually-hidden">{selected.name}'s races ranked by win rating</caption>
                <thead><tr><th scope="col">Race</th><th scope="col">Wins / games</th><th scope="col">Win rate</th><th scope="col" aria-sort="descending">Win rating</th></tr></thead>
                <tbody>
                  {selectedRaces.map((race) => (
                    <tr key={race.id}>
                      <th scope="row"><span className="race-name"><RaceDot raceId={race.id} />{race.name}</span></th>
                      <td className="record-cell">{race.wins} <span>/ {race.games}</span></td>
                      <td>{percent(race.winRate)}</td>
                      <td className="metric-cell"><strong>{rating(race.winRating)}</strong><small>(out of {gameCount(race.games)} played)</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
      <details className="rating-explainer">
        <summary>How are these rankings calculated?</summary>
        <div>
          <p><strong>Win rate</strong> is wins divided by appearances. <strong>Win rating</strong> is wins divided by expected wins: each appearance contributes 1 divided by that game's player count. A 1.00x rating matches an equal-chance baseline; higher is better. One win in one six-player game rates 6.00x, compared with 2.00x for one win in one two-player game.</p>
          <p>Games played break ties, then names provide a stable order. Ratings are descriptive, not confidence-adjusted or Elo: a small sample can still rank highly. Counts are always shown so you can judge the evidence.</p>
          <p>Race stats count player appearances, not unique games. Two Terrans in one game contribute two appearances, but only the winning player's seat earns a win. The supplied points are stored as the winner's score; missing scores and dates remain unknown.</p>
        </div>
      </details>
    </>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; games: Game[] };

export default function StatsPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [showEntry, setShowEntry] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let active = true;
    loadGames().then(
      (games) => { if (active) setState({ status: "ready", games }); },
      (error: unknown) => {
        console.error("Failed to load Eclipse game stats:", error);
        if (active) setState({
          status: "error",
          message: error instanceof Error ? error.message : "An unexpected error occurred while reading games.",
        });
      },
    );
    return () => { active = false; };
  }, [attempt]);

  function retryLoad() {
    setNotice(null);
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  function closeEntry() {
    setShowEntry(false);
    requestAnimationFrame(() => addButtonRef.current?.focus());
  }

  function gameSaved(game: Game) {
    setState((current) => current.status === "ready" ? {
      status: "ready",
      games: [...current.games.filter((existing) => existing.id !== game.id), game]
        .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id)),
    } : current);
    setNotice(`Game #${game.sequence} saved. The leaderboards and player stats are updated.`);
    closeEntry();
  }

  return (
    <div className="stats-page companion-page">
      <div className="stats-container page-container">
        <div className="stats-hero page-hero">
          <div><p className="eyebrow">BEYOND THE BATTLE</p><h1>The galaxy, <span>by the numbers.</span></h1><p>A shared history of Eclipse. Discover who wins, what works, and how you play.</p></div>
          <div className="stats-actions">
            {state.status === "ready" && <button ref={addButtonRef} className="add-game-button" disabled={showEntry} onClick={() => { setShowEntry(true); setNotice(null); }}>Add game</button>}
          </div>
        </div>
        {notice && <p className="save-notice" role="status">{notice}</p>}
        {showEntry && <AddGameForm onSaved={gameSaved} onClose={closeEntry} />}
        {state.status === "loading" && <div className="stats-message" role="status"><span className="loading-orbit" aria-hidden="true" /><h2>Reading the flight logs...</h2><p>Loading game history from Firebase.</p></div>}
        {state.status === "error" && <div className="stats-message" role="alert"><h2>Game stats couldn't be loaded</h2><p>{state.message}</p><p>No sample data is shown in place of your saved games.</p><button onClick={retryLoad}>Try again</button></div>}
        {state.status === "ready" && (state.games.length > 0
          ? <Dashboard games={state.games} />
          : <div className="stats-message"><h2>No games recorded yet</h2><p>Add a completed game to start the leaderboards.</p></div>)}
        <footer className="stats-footer page-footer"><span>ECLIPSE / GAME ARCHIVE</span><span>Every table tells a story.</span></footer>
      </div>
    </div>
  );
}
