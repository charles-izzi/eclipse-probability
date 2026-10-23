import { importGame } from "../src/stats/model.ts";
import type { ImportRow } from "../src/stats/model.ts";

export const rows: ImportRow[] = [
  { winningRace: "bk", playerCount: 5, playingRaces: "bk-bp,rd-ci,yw-ck,wt-cp,gy-cg", points: null },
  { winningRace: "bk", playerCount: 3, playingRaces: "bk-ci,yw-vi,gn-cd", points: null },
  { winningRace: "bl", playerCount: 4, playingRaces: "bk-vi,bl-ci,tr-dl,tr-bp", points: null },
  { winningRace: "bk", playerCount: 6, playingRaces: "bk-ck,br-ci,or-vi,rd-bp,wt-cg,gn-jr", points: 31 },
  { winningRace: "yw", playerCount: 2, playingRaces: "yw-vi,pk-ci", points: null },
  { winningRace: "rd", playerCount: 5, playingRaces: "rd-vi,pk-bp,bk-ck,br-ci,yw-jr", points: 29 },
  { winningRace: "bk", playerCount: 6, playingRaces: "bk-vi,tr-ci,yw-bp,br-ck,bl-cg,pk-jr", points: 33 },
  { winningRace: "tr", playerCount: 5, playingRaces: "tr-ci,yw-vi,br-bp,bk-ck,bl-cg", points: 43 },
  { winningRace: "yw", playerCount: 5, playingRaces: "yw-ci,tr-dl,or-bp,rd-vi,br-ck", points: 43 },
  { winningRace: "br", playerCount: 3, playingRaces: "br-ci,gn-vi,or-bp", points: 40 },
];

export const seedGames = rows.map((row, index) => importGame(row, index + 1));
