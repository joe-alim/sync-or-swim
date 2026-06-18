// Smoke Signals — game-specific state. Carried in `Room<SmokeSignalsGame>.game`;
// the shared shell (players, host, phase) lives on the Room envelope. Rules mirror
// Love Letter Premium — see ./REQUIREMENTS.md.

import { CardId, SmokeSignalsVersion } from './cards';

export type SmokeSignalsPhase = 'lobby' | 'playing' | 'round-end' | 'game-end';

/** Per-player, round-scoped state, keyed by playerId in `SmokeSignalsGame.states`. */
export interface SSPlayerState {
  hand: CardId[]; // 1 card normally; 2 during this player's own turn
  discard: CardId[]; // cards discarded this round, in play order (public memory)
  isOut: boolean; // knocked out of the current round
  protected: boolean; // Handmaid immunity until the start of this player's next turn
}

/** A secondary decision that must be resolved before the turn advances. */
export type SSPending = { kind: 'bishop-redraw'; playerId: string };

/** The move a player submits when playing a card. Extra fields are read per card. */
export interface SSMove {
  card: CardId;
  /** Guard, Priest, Baron, Prince, King, Dowager Queen, Bishop, Sycophant, Jester. */
  targetId?: string;
  /** Guard, Bishop. */
  namedValue?: number;
  /** Cardinal — the two players whose hands swap (may include self). */
  cardinalTargets?: [string, string];
  /** Cardinal — which of the two swapped hands to look at. */
  cardinalPeek?: string;
  /** Baroness — 1 or 2 players to look at. */
  baronessTargets?: string[];
}

export interface SmokeSignalsGame {
  version: SmokeSignalsVersion;
  tokensToWin: number;
  roundNumber: number;

  deck: CardId[]; // hidden draw pile
  removed: CardId | null; // face-down set-aside card (drawn only if the deck empties)
  faceUp: CardId[]; // 2-player Regular only; public

  states: Record<string, SSPlayerState>;
  secrets: Record<string, string>; // playerId -> private token (server only, stripped)

  turnOrder: string[]; // playerIds in seating order
  currentTurn: string | null;
  firstPlayerId: string | null; // who starts the next round (previous winner)

  sycophantTarget: string | null; // forced target for the next targeting card
  jesterBets: Record<string, string>; // bettorId -> chosen playerId
  peeks: Record<string, Record<string, CardId>>; // viewerId -> { targetId: card }
  pending: SSPending | null;

  log: string[]; // public round log (newest last)
  roundWinnerIds: string[]; // set at round end
  gameWinnerId: string | null;
}

/** Per-player view as seen by a client. The viewer's own `hand` is included; other
 *  players' hands are hidden (only `handCount`). */
export interface SSClientPlayer {
  isOut: boolean;
  protected: boolean;
  discard: CardId[];
  handCount: number;
  hand?: CardId[]; // present only for the requesting viewer
}

export interface ClientSmokeSignalsGame {
  version: SmokeSignalsVersion;
  tokensToWin: number;
  roundNumber: number;
  deckCount: number;
  faceUp: CardId[];
  states: Record<string, SSClientPlayer>;
  turnOrder: string[];
  currentTurn: string | null;
  sycophantTarget: string | null;
  jesterBets: Record<string, string>;
  pending: SSPending | null;
  peeks: Record<string, CardId>; // the viewer's own peeks: targetId -> card
  log: string[];
  roundWinnerIds: string[];
  gameWinnerId: string | null;
  viewerId: string | null; // who the server authenticated this request as (or null)
}
