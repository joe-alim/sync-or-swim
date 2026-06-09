// Sync or Swim — game-specific state. This is the payload carried in
// `Room<SyncOrSwimGame>.game`; the shared shell (players, host, phase) lives
// on the Room envelope (see lib/games/types.ts).

export type SyncOrSwimPhase = 'lobby' | 'answering' | 'revealed' | 'ended';

export interface RoundResult {
  card: string;
  answers: { playerId: string; playerName: string; answer: string; points: number }[];
}

export interface SyncOrSwimGame {
  deck: string[];
  currentCard: string | null;
  submittedIds: string[];
  answers: Record<string, string>;
  roundHistory: RoundResult[];
  winnerId: string | null;
}

/** What the client receives — `deck` is hidden, `cardsRemaining` exposed, and
 *  `answers` is blanked while players are still answering. */
export interface ClientSyncOrSwimGame {
  currentCard: string | null;
  submittedIds: string[];
  answers: Record<string, string>; // empty during 'answering' phase
  roundHistory: RoundResult[];
  winnerId: string | null;
  cardsRemaining: number;
}
