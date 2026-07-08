// Campfire Bluff — game-specific state. Carried in
// `Room<CampfireBluffGame>.game`; the shared shell (players, host, phase)
// lives on the Room envelope (see lib/games/types.ts).
//
// Every round shows a true-but-surprising trivia prompt with the answer
// hidden. Every player writes a bluff; the bluffs plus the real answer are
// shuffled together and everyone votes for the one they think is true. See
// docs/campfire-bluff-plan.md for the full design.

export type CampfireBluffPhase = 'lobby' | 'bluffing' | 'voting' | 'revealed' | 'ended';

export interface Question {
  prompt: string;
  answer: string;
}

/**
 * One shuffled option shown during voting. `authorId` is null for the real
 * answer. Never sent to the client until reveal — see `sanitize`.
 */
export interface Option {
  id: string;
  text: string;
  authorId: string | null;
}

export interface RoundResult {
  prompt: string;
  trueAnswer: string;
  options: {
    text: string;
    isTrue: boolean;
    authorId: string | null;
    authorName: string | null;
    voterIds: string[];
  }[];
  points: Record<string, number>; // playerId -> points earned this round
}

export interface CampfireBluffGame {
  deck: Question[]; // remaining questions, shuffled
  totalRounds: number; // min(ROUNDS_PER_GAME, initial deck size), set at `start`
  roundIndex: number; // 0-based, current round
  currentQuestion: Question | null;
  bluffs: Record<string, string>; // playerId -> bluff text (cleared each round)
  submittedIds: string[]; // who has bluffed this round
  options: Option[]; // set when voting opens; authorship hidden from client
  eligibleVoterIds: string[]; // frozen when voting opened
  votes: Record<string, string>; // voterId -> optionId
  votedIds: string[];
  roundHistory: RoundResult[];
  winnerIds: string[]; // co-winners, set at `ended`
}

/**
 * What the client receives. The true answer and every option's authorship /
 * correctness stay hidden until `revealed` — see docs/campfire-bluff-plan.md's
 * sanitization table.
 */
export interface ClientCampfireBluffGame {
  roundIndex: number;
  totalRounds: number;
  currentPrompt: string | null;
  submittedIds: string[];
  /** Present only during `voting` / `revealed`: id + text, no authorship. */
  options: { id: string; text: string }[];
  eligibleVoterIds: string[];
  votedIds: string[];
  roundHistory: RoundResult[];
  winnerIds: string[];
}
