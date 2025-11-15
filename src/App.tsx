import { useState } from "react";
import "./App.css";

interface Weapon {
  damage: number;
}

interface Ship {
  healthPoints: number;
  initiative: number;
  shield: number;
  attackModifier: number;
  guns: Weapon[];
  missiles: Weapon[];
}

interface Player {
  ships: Ship[];
}

function App() {
  const [player1, setPlayer1] = useState<Player>({
    ships: [
      {
        healthPoints: 1,
        initiative: 1,
        shield: 0,
        attackModifier: 0,
        guns: [{ damage: 1 }],
        missiles: [],
      },
    ],
  });

  const [player2, setPlayer2] = useState<Player>({
    ships: [
      {
        healthPoints: 1,
        initiative: 1,
        shield: 0,
        attackModifier: 0,
        guns: [{ damage: 1 }],
        missiles: [],
      },
    ],
  });

  const [result, setResult] = useState<{
    player1WinChance: number;
    player2WinChance: number;
    player1ShipSurvival: number[];
    player2ShipSurvival: number[];
  } | null>(null);

  const addShip = (playerNum: 1 | 2) => {
    const newShip: Ship = {
      healthPoints: 1,
      initiative: 1,
      shield: 0,
      attackModifier: 0,
      guns: [{ damage: 1 }],
      missiles: [],
    };

    if (playerNum === 1) {
      setPlayer1({ ships: [...player1.ships, newShip] });
    } else {
      setPlayer2({ ships: [...player2.ships, newShip] });
    }
  };

  const removeShip = (playerNum: 1 | 2, shipIndex: number) => {
    if (playerNum === 1 && player1.ships.length > 1) {
      setPlayer1({ ships: player1.ships.filter((_, i) => i !== shipIndex) });
    } else if (playerNum === 2 && player2.ships.length > 1) {
      setPlayer2({ ships: player2.ships.filter((_, i) => i !== shipIndex) });
    }
  };

  const copyShip = (playerNum: 1 | 2, shipIndex: number) => {
    const player = playerNum === 1 ? player1 : player2;
    const shipToCopy = player.ships[shipIndex];

    // Deep copy the ship with all its weapons
    const copiedShip: Ship = {
      healthPoints: shipToCopy.healthPoints,
      initiative: shipToCopy.initiative,
      shield: shipToCopy.shield,
      attackModifier: shipToCopy.attackModifier,
      guns: shipToCopy.guns.map((gun) => ({ damage: gun.damage })),
      missiles: shipToCopy.missiles.map((missile) => ({
        damage: missile.damage,
      })),
    };

    if (playerNum === 1) {
      setPlayer1({ ships: [...player1.ships, copiedShip] });
    } else {
      setPlayer2({ ships: [...player2.ships, copiedShip] });
    }
  };

  const updateShip = (
    playerNum: 1 | 2,
    shipIndex: number,
    field: keyof Ship,
    value: unknown
  ) => {
    const updatePlayer = (player: Player) => ({
      ships: player.ships.map((ship, i) =>
        i === shipIndex ? { ...ship, [field]: value } : ship
      ),
    });

    if (playerNum === 1) {
      setPlayer1(updatePlayer(player1));
    } else {
      setPlayer2(updatePlayer(player2));
    }
  };

  const addWeapon = (
    playerNum: 1 | 2,
    shipIndex: number,
    weaponType: "guns" | "missiles"
  ) => {
    const updatePlayer = (player: Player) => ({
      ships: player.ships.map((ship, i) =>
        i === shipIndex
          ? { ...ship, [weaponType]: [...ship[weaponType], { damage: 1 }] }
          : ship
      ),
    });

    if (playerNum === 1) {
      setPlayer1(updatePlayer(player1));
    } else {
      setPlayer2(updatePlayer(player2));
    }
  };

  const removeWeapon = (
    playerNum: 1 | 2,
    shipIndex: number,
    weaponType: "guns" | "missiles",
    weaponIndex: number
  ) => {
    const updatePlayer = (player: Player) => ({
      ships: player.ships.map((ship, i) =>
        i === shipIndex
          ? {
              ...ship,
              [weaponType]: ship[weaponType].filter(
                (_, wi) => wi !== weaponIndex
              ),
            }
          : ship
      ),
    });

    if (playerNum === 1) {
      setPlayer1(updatePlayer(player1));
    } else {
      setPlayer2(updatePlayer(player2));
    }
  };

  const updateWeapon = (
    playerNum: 1 | 2,
    shipIndex: number,
    weaponType: "guns" | "missiles",
    weaponIndex: number,
    damage: unknown
  ) => {
    const updatePlayer = (player: Player) => ({
      ships: player.ships.map((ship, i) =>
        i === shipIndex
          ? {
              ...ship,
              [weaponType]: ship[weaponType].map((w, wi) =>
                wi === weaponIndex ? { damage } : w
              ),
            }
          : ship
      ),
    });

    if (playerNum === 1) {
      setPlayer1(updatePlayer(player1));
    } else {
      setPlayer2(updatePlayer(player2));
    }
  };

  const validateAndNormalizePlayers = (): boolean => {
    let hasErrors = false;
    const errorMessages: string[] = [];

    const validatePlayer = (player: Player, playerNum: number): Player => {
      return {
        ships: player.ships.map((ship, shipIndex) => {
          const shipLabel = `Player ${playerNum} Ship ${shipIndex + 1}`;

          // Parse string values to numbers
          const healthPointsNum =
            typeof ship.healthPoints === "string"
              ? parseInt(ship.healthPoints) || 1
              : ship.healthPoints || 1;
          if (!Number.isInteger(healthPointsNum) || healthPointsNum < 1) {
            hasErrors = true;
            errorMessages.push(
              `${shipLabel}: Health Points must be a positive integer`
            );
          }

          const initiativeNum =
            typeof ship.initiative === "string"
              ? parseInt(ship.initiative) || 1
              : ship.initiative ?? 1;
          if (!Number.isInteger(initiativeNum) || initiativeNum < 0) {
            hasErrors = true;
            errorMessages.push(
              `${shipLabel}: Initiative must be a non-negative integer`
            );
          }

          const shieldNum =
            typeof ship.shield === "string"
              ? parseInt(ship.shield) || 0
              : ship.shield ?? 0;
          if (!Number.isInteger(shieldNum) || shieldNum > 0) {
            hasErrors = true;
            errorMessages.push(
              `${shipLabel}: Shield must be a non-positive integer`
            );
          }

          const attackModifierNum =
            typeof ship.attackModifier === "string"
              ? parseInt(ship.attackModifier) || 0
              : ship.attackModifier ?? 0;
          if (!Number.isInteger(attackModifierNum) || attackModifierNum < 0) {
            hasErrors = true;
            errorMessages.push(
              `${shipLabel}: Attack Modifier must be a non-negative integer`
            );
          }

          const guns = ship.guns.map((gun, gunIndex) => {
            const damageNum =
              typeof gun.damage === "string"
                ? parseInt(gun.damage) || 1
                : gun.damage || 1;
            if (!Number.isInteger(damageNum) || damageNum < 1) {
              hasErrors = true;
              errorMessages.push(
                `${shipLabel} Gun ${
                  gunIndex + 1
                }: Damage must be a positive integer`
              );
            }
            return { damage: Math.max(1, Math.floor(damageNum)) };
          });

          const missiles = ship.missiles.map((missile, missileIndex) => {
            const damageNum =
              typeof missile.damage === "string"
                ? parseInt(missile.damage) || 1
                : missile.damage || 1;
            if (!Number.isInteger(damageNum) || damageNum < 1) {
              hasErrors = true;
              errorMessages.push(
                `${shipLabel} Missile ${
                  missileIndex + 1
                }: Damage must be a positive integer`
              );
            }
            return { damage: Math.max(1, Math.floor(damageNum)) };
          });

          return {
            healthPoints: Math.max(1, Math.floor(healthPointsNum)),
            initiative: Math.max(0, Math.floor(initiativeNum)),
            shield: Math.min(0, Math.floor(shieldNum)),
            attackModifier: Math.max(0, Math.floor(attackModifierNum)),
            guns,
            missiles,
          };
        }),
      };
    };

    const normalizedPlayer1 = validatePlayer(player1, 1);
    const normalizedPlayer2 = validatePlayer(player2, 2);

    if (hasErrors) {
      alert("Validation errors:\n\n" + errorMessages.join("\n"));
      return false;
    }

    setPlayer1(normalizedPlayer1);
    setPlayer2(normalizedPlayer2);
    return true;
  };

  const calculateBattle = () => {
    if (!validateAndNormalizePlayers()) {
      return;
    }
    const result = simulateBattle(player1, player2);
    setResult(result);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      <h1 style={{ textAlign: "center" }}>Battle Probability Calculator</h1>

      <div
        style={{
          display: "flex",
          gap: "20px",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <PlayerConfig
          player={player1}
          playerNum={1}
          onAddShip={() => addShip(1)}
          onRemoveShip={(shipIndex) => removeShip(1, shipIndex)}
          onCopyShip={(shipIndex) => copyShip(1, shipIndex)}
          onUpdateShip={(shipIndex, field, value) =>
            updateShip(1, shipIndex, field, value)
          }
          onAddWeapon={(shipIndex, weaponType) =>
            addWeapon(1, shipIndex, weaponType)
          }
          onRemoveWeapon={(shipIndex, weaponType, weaponIndex) =>
            removeWeapon(1, shipIndex, weaponType, weaponIndex)
          }
          onUpdateWeapon={(shipIndex, weaponType, weaponIndex, damage) =>
            updateWeapon(1, shipIndex, weaponType, weaponIndex, damage)
          }
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            minWidth: "200px",
            flexBasis: "100%",
            order: 3,
          }}
        >
          <button
            onClick={calculateBattle}
            style={{
              padding: "20px 40px",
              fontSize: "24px",
              fontWeight: "bold",
              cursor: "pointer",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            BATTLE
          </button>

          {result && (
            <div
              style={{
                textAlign: "center",
                padding: "20px",
                backgroundColor: "var(--vscode-editor-background, white)",
                color: "var(--vscode-editor-foreground, black)",
                borderRadius: "8px",
                minWidth: "250px",
                maxWidth: "400px",
              }}
            >
              <h3>Results</h3>
              <div style={{ marginTop: "10px" }}>
                <strong>Player 1 Win Rate:</strong>{" "}
                {(result.player1WinChance * 100).toFixed(2)}%
              </div>
              {result.player1ShipSurvival.length > 0 && (
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "14px",
                    textAlign: "left",
                    marginLeft: "40px",
                  }}
                >
                  <strong>Ship survival rates:</strong>
                  {result.player1ShipSurvival.map((survival, idx) => (
                    <div
                      key={idx}
                      style={{ marginTop: "4px", marginLeft: "10px" }}
                    >
                      Ship {idx + 1}: {(survival * 100).toFixed(1)}%
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: "15px" }}>
                <strong>Player 2 Win Rate:</strong>{" "}
                {(result.player2WinChance * 100).toFixed(2)}%
              </div>
              {result.player2ShipSurvival.length > 0 && (
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "14px",
                    textAlign: "left",
                    marginLeft: "40px",
                  }}
                >
                  <strong>Ship survival rates:</strong>
                  {result.player2ShipSurvival.map((survival, idx) => (
                    <div
                      key={idx}
                      style={{ marginTop: "4px", marginLeft: "10px" }}
                    >
                      Ship {idx + 1}: {(survival * 100).toFixed(1)}%
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <PlayerConfig
          player={player2}
          playerNum={2}
          onAddShip={() => addShip(2)}
          onRemoveShip={(shipIndex) => removeShip(2, shipIndex)}
          onCopyShip={(shipIndex) => copyShip(2, shipIndex)}
          onUpdateShip={(shipIndex, field, value) =>
            updateShip(2, shipIndex, field, value)
          }
          onAddWeapon={(shipIndex, weaponType) =>
            addWeapon(2, shipIndex, weaponType)
          }
          onRemoveWeapon={(shipIndex, weaponType, weaponIndex) =>
            removeWeapon(2, shipIndex, weaponType, weaponIndex)
          }
          onUpdateWeapon={(shipIndex, weaponType, weaponIndex, damage) =>
            updateWeapon(2, shipIndex, weaponType, weaponIndex, damage)
          }
        />
      </div>
    </div>
  );
}

interface PlayerConfigProps {
  player: Player;
  playerNum: number;
  onAddShip: () => void;
  onRemoveShip: (shipIndex: number) => void;
  onCopyShip: (shipIndex: number) => void;
  onUpdateShip: (shipIndex: number, field: keyof Ship, value: unknown) => void;
  onAddWeapon: (shipIndex: number, weaponType: "guns" | "missiles") => void;
  onRemoveWeapon: (
    shipIndex: number,
    weaponType: "guns" | "missiles",
    weaponIndex: number
  ) => void;
  onUpdateWeapon: (
    shipIndex: number,
    weaponType: "guns" | "missiles",
    weaponIndex: number,
    damage: unknown
  ) => void;
}

function PlayerConfig({
  player,
  playerNum,
  onAddShip,
  onRemoveShip,
  onCopyShip,
  onUpdateShip,
  onAddWeapon,
  onRemoveWeapon,
  onUpdateWeapon,
}: PlayerConfigProps) {
  return (
    <div
      style={{
        flex: "1 1 130px",
        border: "2px solid #333",
        borderRadius: "8px",
        padding: "15px",
      }}
    >
      <h2>Player {playerNum}</h2>
      <button
        onClick={onAddShip}
        style={{
          marginBottom: "15px",
          padding: "8px 16px",
          cursor: "pointer",
          backgroundColor: "var(--vscode-editor-background, white)",
          color: "var(--vscode-editor-foreground, black)",
        }}
      >
        Add Ship
      </button>

      {player.ships.map((ship, shipIndex) => (
        <div
          key={shipIndex}
          style={{
            border: "1px solid #666",
            borderRadius: "4px",
            padding: "10px",
            marginBottom: "15px",
            backgroundColor: "var(--vscode-editor-background, white)",
            color: "var(--vscode-editor-foreground, black)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <h3 style={{ margin: 0 }}>Ship {shipIndex + 1}</h3>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => onCopyShip(shipIndex)}
                style={{
                  padding: "4px 8px",
                  cursor: "pointer",
                  backgroundColor: "var(--vscode-editor-background, white)",
                  color: "var(--vscode-editor-foreground, black)",
                }}
              >
                Copy
              </button>
              {player.ships.length > 1 && (
                <button
                  onClick={() => onRemoveShip(shipIndex)}
                  style={{
                    padding: "4px 8px",
                    cursor: "pointer",
                    backgroundColor: "var(--vscode-editor-background, white)",
                    color: "var(--vscode-editor-foreground, black)",
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            <label>
              Health Points:
              <input
                type="text"
                inputMode="numeric"
                value={ship.healthPoints}
                onFocus={(e) => e.target.select()}
                onChange={(e) =>
                  onUpdateShip(shipIndex, "healthPoints", e.target.value)
                }
                style={{ marginLeft: "10px", width: "80px" }}
              />
            </label>

            <label>
              Initiative:
              <input
                type="text"
                inputMode="numeric"
                value={ship.initiative}
                onFocus={(e) => e.target.select()}
                onChange={(e) =>
                  onUpdateShip(shipIndex, "initiative", e.target.value)
                }
                style={{ marginLeft: "10px", width: "80px" }}
              />
            </label>

            <label>
              Shield (negative):
              <input
                type="text"
                inputMode="numeric"
                value={ship.shield}
                onFocus={(e) => e.target.select()}
                onChange={(e) =>
                  onUpdateShip(shipIndex, "shield", e.target.value)
                }
                style={{ marginLeft: "10px", width: "80px" }}
              />
            </label>

            <label>
              Attack Modifier:
              <input
                type="text"
                inputMode="numeric"
                value={ship.attackModifier}
                onFocus={(e) => e.target.select()}
                onChange={(e) =>
                  onUpdateShip(shipIndex, "attackModifier", e.target.value)
                }
                style={{ marginLeft: "10px", width: "80px" }}
              />
            </label>
          </div>

          <div style={{ marginTop: "15px" }}>
            <div style={{ marginBottom: "10px" }}>
              <strong>Missiles ({ship.missiles.length})</strong>
              <button
                onClick={() => onAddWeapon(shipIndex, "missiles")}
                style={{
                  marginLeft: "10px",
                  padding: "2px 8px",
                  cursor: "pointer",
                  backgroundColor: "var(--vscode-editor-background, white)",
                  color: "var(--vscode-editor-foreground, black)",
                }}
              >
                +
              </button>
              {ship.missiles.map((missile, mIndex) => (
                <div
                  key={mIndex}
                  style={{ marginLeft: "20px", marginTop: "5px" }}
                >
                  Missile {mIndex + 1} Damage:
                  <input
                    type="text"
                    inputMode="numeric"
                    value={missile.damage}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      onUpdateWeapon(
                        shipIndex,
                        "missiles",
                        mIndex,
                        e.target.value
                      )
                    }
                    style={{ marginLeft: "10px", width: "60px" }}
                  />
                  {ship.missiles.length > 0 && (
                    <button
                      onClick={() =>
                        onRemoveWeapon(shipIndex, "missiles", mIndex)
                      }
                      style={{
                        marginLeft: "10px",
                        padding: "2px 8px",
                        cursor: "pointer",
                        backgroundColor:
                          "var(--vscode-editor-background, white)",
                        color: "var(--vscode-editor-foreground, black)",
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div>
              <strong>Guns ({ship.guns.length})</strong>
              <button
                onClick={() => onAddWeapon(shipIndex, "guns")}
                style={{
                  marginLeft: "10px",
                  padding: "2px 8px",
                  cursor: "pointer",
                  backgroundColor: "var(--vscode-editor-background, white)",
                  color: "var(--vscode-editor-foreground, black)",
                }}
              >
                +
              </button>
              {ship.guns.map((gun, gIndex) => (
                <div
                  key={gIndex}
                  style={{ marginLeft: "20px", marginTop: "5px" }}
                >
                  Gun {gIndex + 1} Damage:
                  <input
                    type="text"
                    inputMode="numeric"
                    value={gun.damage}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      onUpdateWeapon(shipIndex, "guns", gIndex, e.target.value)
                    }
                    style={{ marginLeft: "10px", width: "60px" }}
                  />
                  {ship.guns.length > 0 && (
                    <button
                      onClick={() => onRemoveWeapon(shipIndex, "guns", gIndex)}
                      style={{
                        marginLeft: "10px",
                        padding: "2px 8px",
                        cursor: "pointer",
                        backgroundColor:
                          "var(--vscode-editor-background, white)",
                        color: "var(--vscode-editor-foreground, black)",
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
// Create all possible outcomes from dice rolls
interface BattleState {
  p1Ships: number[]; // HP for each ship
  p2Ships: number[]; // HP for each ship
  probability: number;
}

function simulateBattle(
  player1: Player,
  player2: Player
): {
  player1WinChance: number;
  player2WinChance: number;
  player1ShipSurvival: number[];
  player2ShipSurvival: number[];
} {
  const initialState: BattleState = {
    p1Ships: player1.ships.map((s) => s.healthPoints),
    p2Ships: player2.ships.map((s) => s.healthPoints),
    probability: 1.0,
  };

  let states: BattleState[] = [initialState];
  let player1Wins = 0;
  let player2Wins = 0;
  const player1ShipSurvival: number[] = new Array(player1.ships.length).fill(0);
  const player2ShipSurvival: number[] = new Array(player2.ships.length).fill(0);

  // Limit iterations to prevent infinite loops
  const maxRounds = 100;
  let round = 0;

  while (states.length > 0 && round < maxRounds) {
    round++;
    const newStates: BattleState[] = [];

    for (const state of states) {
      // Check win conditions
      const p1Alive = state.p1Ships.some((hp) => hp > 0);
      const p2Alive = state.p2Ships.some((hp) => hp > 0);

      if (!p1Alive && !p2Alive) {
        // Both dead (shouldn't happen, but handle it)
        player1Wins += state.probability * 0.5;
        player2Wins += state.probability * 0.5;
        continue;
      }

      if (!p1Alive) {
        player2Wins += state.probability;
        // Track which player 2 ships survived
        state.p2Ships.forEach((hp, idx) => {
          if (hp > 0) {
            player2ShipSurvival[idx] += state.probability;
          }
        });
        continue;
      }

      if (!p2Alive) {
        player1Wins += state.probability;
        // Track which player 1 ships survived
        state.p1Ships.forEach((hp, idx) => {
          if (hp > 0) {
            player1ShipSurvival[idx] += state.probability;
          }
        });
        continue;
      }

      // Continue battle - execute one complete round
      const roundResults = executeRound(state, player1, player2);
      newStates.push(...roundResults);
    }

    // Merge states with same ship HP to reduce state space
    const mergedStates = new Map<string, BattleState>();
    for (const state of newStates) {
      const key = JSON.stringify({ p1: state.p1Ships, p2: state.p2Ships });
      if (mergedStates.has(key)) {
        const existing = mergedStates.get(key)!;
        existing.probability += state.probability;
      } else {
        mergedStates.set(key, state);
      }
    }

    states = Array.from(mergedStates.values());
  }

  // Any remaining states count as draws or timeout
  for (const state of states) {
    player1Wins += state.probability * 0.5;
    player2Wins += state.probability * 0.5;
  }

  return {
    player1WinChance: player1Wins,
    player2WinChance: player2Wins,
    player1ShipSurvival,
    player2ShipSurvival,
  };
}

function executeRound(
  state: BattleState,
  player1: Player,
  player2: Player
): BattleState[] {
  // Get all ships with their initiative
  interface ShipInfo {
    playerNum: 1 | 2;
    shipIndex: number;
    initiative: number;
  }

  const allShips: ShipInfo[] = [];

  player1.ships.forEach((ship, i) => {
    if (state.p1Ships[i] > 0) {
      allShips.push({
        playerNum: 1,
        shipIndex: i,
        initiative: ship.initiative,
      });
    }
  });

  player2.ships.forEach((ship, i) => {
    if (state.p2Ships[i] > 0) {
      allShips.push({
        playerNum: 2,
        shipIndex: i,
        initiative: ship.initiative,
      });
    }
  });

  // Sort by initiative (higher first), player 1 wins ties
  allShips.sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative;
    return a.playerNum - b.playerNum;
  });

  // Execute each ship's turn in order
  let currentStates: BattleState[] = [state];

  for (const shipInfo of allShips) {
    const newStates: BattleState[] = [];

    for (const currentState of currentStates) {
      // Check if this ship is still alive
      const isAlive =
        shipInfo.playerNum === 1
          ? currentState.p1Ships[shipInfo.shipIndex] > 0
          : currentState.p2Ships[shipInfo.shipIndex] > 0;

      if (!isAlive) {
        newStates.push(currentState);
        continue;
      }

      const ship =
        shipInfo.playerNum === 1
          ? player1.ships[shipInfo.shipIndex]
          : player2.ships[shipInfo.shipIndex];

      // Missiles phase
      const afterMissiles = executeMissilePhase(
        currentState,
        ship,
        shipInfo.playerNum === 1 ? player2 : player1,
        shipInfo.playerNum
      );

      // Guns phase for each resulting state
      for (const missileState of afterMissiles) {
        const afterGuns = executeGunsPhase(
          missileState,
          ship,
          shipInfo.playerNum === 1 ? player2 : player1,
          shipInfo.playerNum
        );
        newStates.push(...afterGuns);
      }
    }

    currentStates = newStates;
  }

  return currentStates;
}

function executeMissilePhase(
  state: BattleState,
  attackingShip: Ship,
  defendingPlayer: Player,
  attackerNum: 1 | 2
): BattleState[] {
  if (attackingShip.missiles.length === 0) return [state];

  let states: BattleState[] = [state];

  // Missiles fire once
  for (const missile of attackingShip.missiles) {
    states = fireWeapon(
      states,
      attackingShip,
      missile.damage,
      defendingPlayer,
      attackerNum
    );
  }

  return states;
}

function executeGunsPhase(
  state: BattleState,
  attackingShip: Ship,
  defendingPlayer: Player,
  attackerNum: 1 | 2
): BattleState[] {
  if (attackingShip.guns.length === 0) return [state];

  let states: BattleState[] = [state];

  for (const gun of attackingShip.guns) {
    states = fireWeapon(
      states,
      attackingShip,
      gun.damage,
      defendingPlayer,
      attackerNum
    );
  }

  return states;
}

function fireWeapon(
  states: BattleState[],
  attackingShip: Ship,
  damage: number,
  defendingPlayer: Player,
  attackerNum: 1 | 2
): BattleState[] {
  const results: BattleState[] = [];

  for (const state of states) {
    const defenderShips = attackerNum === 1 ? state.p2Ships : state.p1Ships;

    // Check if any defenders are alive
    if (!defenderShips.some((hp) => hp > 0)) {
      results.push(state);
      continue;
    }

    // Find the biggest ship (by starting HP)
    let biggestShipIndex = -1;
    let biggestStartingHP = 0;

    defendingPlayer.ships.forEach((ship, i) => {
      if (defenderShips[i] > 0 && ship.healthPoints > biggestStartingHP) {
        biggestStartingHP = ship.healthPoints;
        biggestShipIndex = i;
      }
    });

    if (biggestShipIndex === -1) {
      results.push(state);
      continue;
    }

    const targetShip = defendingPlayer.ships[biggestShipIndex];

    // Calculate hit probability
    // Hit when: d6 + attackModifier + shield >= 6
    // So: d6 >= 6 - attackModifier - shield
    const threshold = Math.max(
      2,
      Math.min(6, 6 - attackingShip.attackModifier - targetShip.shield)
    );

    let hitProbability = 0;
    for (let roll = 1; roll <= 6; roll++) {
      if (roll >= threshold) {
        hitProbability += 1 / 6;
      }
    }

    // Hit state
    if (hitProbability > 0) {
      const hitState: BattleState = {
        p1Ships: [...state.p1Ships],
        p2Ships: [...state.p2Ships],
        probability: state.probability * hitProbability,
      };

      if (attackerNum === 1) {
        hitState.p2Ships[biggestShipIndex] = Math.max(
          0,
          hitState.p2Ships[biggestShipIndex] - damage
        );
      } else {
        hitState.p1Ships[biggestShipIndex] = Math.max(
          0,
          hitState.p1Ships[biggestShipIndex] - damage
        );
      }

      results.push(hitState);
    }

    // Miss state
    const missProbability = 1 - hitProbability;
    if (missProbability > 0) {
      results.push({
        p1Ships: [...state.p1Ships],
        p2Ships: [...state.p2Ships],
        probability: state.probability * missProbability,
      });
    }
  }

  return results;
}

export default App;
