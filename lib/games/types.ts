// Game-agnostic core types shared by every game in the Foxflame suite.
//
// A `Room` is the generic envelope persisted in Redis and broadcast over
// Pusher. Everything common to all games (id, host, players, phase) lives at
// the top level; each game stows its own state in the `game` payload.

export interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
}

export interface Room<TGame> {
  id: string;
  gameType: string; // registry slug, e.g. 'sync-or-swim'
  hostId: string;
  phase: string; // game-specific phase values
  players: Record<string, Player>;
  game: TGame; // game-specific payload
  /**
   * When set, this room belongs to a crew: player ids are crew memberIds and
   * the winner's victory is recorded to the crew leaderboard at game end.
   * Absent for plain anonymous one-off rooms.
   */
  crewSlug?: string;
  /**
   * Guards the crew win write-back so a retried end-of-game request can't
   * double-count. Set true the first time a win is recorded.
   */
  winRecorded?: boolean;
}

/**
 * Client-facing view of a room. The shared shell is identical to `Room`; the
 * `game` payload is whatever the game's `sanitize` function chooses to expose
 * (e.g. with secret fields stripped during play).
 */
export interface ClientRoom<TClientGame> {
  id: string;
  gameType: string;
  hostId: string;
  phase: string;
  players: Record<string, Player>;
  game: TClientGame;
  /** Present when this room belongs to a crew; drives the crew join flow and
   *  leaderboard on the client. Mirrors `Room.crewSlug`. */
  crewSlug?: string;
}

export type GameStatus = 'live' | 'coming-soon';

/**
 * Client-safe metadata describing a game. Lives in the registry and drives the
 * hub's game cards. Contains NO server logic, so it is safe to import into
 * client components.
 */
export interface GameMeta {
  slug: string;
  title: string;
  description: string; // one or two short lines shown on the hub card
  status: GameStatus;
  mascot: 'fish' | 'fox' | 'owl';
  /** Tailwind classes for the card's accent (border/glow + button). */
  accent: {
    glow: string;
    button: string;
  };
}
