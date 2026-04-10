export type GamePhase = 'lobby' | 'answering' | 'revealed' | 'ended';

export interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
}

export interface RoundResult {
  card: string;
  answers: { playerId: string; playerName: string; answer: string; points: number }[];
}

export interface GameState {
  id: string;
  hostId: string;
  phase: GamePhase;
  players: Record<string, Player>;
  deck: string[];
  currentCard: string | null;
  submittedIds: string[];
  answers: Record<string, string>;
  roundHistory: RoundResult[];
  winnerId: string | null;
}

export interface ClientGameState {
  id: string;
  hostId: string;
  phase: GamePhase;
  players: Record<string, Player>;
  currentCard: string | null;
  submittedIds: string[];
  answers: Record<string, string>; // empty during 'answering' phase
  roundHistory: RoundResult[];
  winnerId: string | null;
  cardsRemaining: number;
}
