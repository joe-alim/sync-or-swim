// Two Tracks and a Trick — game-specific state. This is the payload carried in
// `Room<TwoTracksGame>.game`; the shared shell (players, host, phase) lives on
// the Room envelope (see lib/games/types.ts).
//
// Every player writes two truths and one lie ("two tracks and a trick"); the
// group then takes turns guessing which statement is the lie in each other's
// sets. See docs/two-tracks-and-a-trick-plan.md for the full design.

export type TwoTracksPhase = 'lobby' | 'writing' | 'guessing' | 'revealed' | 'ended';

/**
 * One player's set. Statements are stored already shuffled into display order so
 * the lie's slot can't be inferred from input order; `lieIndex` points at the
 * lie within that displayed array.
 */
export interface Submission {
  statements: [string, string, string];
  lieIndex: number; // 0..2
}

export interface RoundResult {
  subjectId: string;
  subjectName: string;
  statements: string[];
  lieIndex: number;
  guesses: {
    playerId: string;
    playerName: string;
    guessIndex: number; // -1 if the player never locked a guess
    correct: boolean;
  }[];
  points: Record<string, number>; // playerId -> points earned this round
}

export interface TwoTracksGame {
  submissions: Record<string, Submission>; // playerId -> set
  submittedIds: string[]; // who has written their set
  order: string[]; // randomized subject order (can grow if players join mid-pass)
  roundIndex: number; // index into `order`
  eligibleIds: string[]; // guessers frozen when the current round opened
  guesses: Record<string, number>; // current round: guesserId -> chosen index
  guessedIds: string[]; // who has guessed this round
  roundHistory: RoundResult[];
  winnerIds: string[]; // co-winners, set at `ended`
}

/**
 * What the client receives. The whole point is hiding the lie until reveal:
 * the full `submissions` map, the current round's `lieIndex`, and individual
 * `guesses` never leave the server before their reveal. The current subject's
 * statements are exposed during `guessing` with the lie's position stripped;
 * the answer arrives only once the round is pushed to `roundHistory`.
 */
export interface ClientTwoTracksGame {
  submittedIds: string[];
  roundIndex: number;
  totalRounds: number; // order.length — drives "Round X of Y"
  /** The set being guessed, lie position NOT marked. Present only in `guessing`. */
  currentSubject: { subjectId: string; subjectName: string; statements: string[] } | null;
  eligibleIds: string[]; // this round's frozen guesser pool
  guessedIds: string[]; // who has locked a guess (not what they guessed)
  roundHistory: RoundResult[]; // fully revealed past rounds (incl. the just-revealed one)
  winnerIds: string[];
}
