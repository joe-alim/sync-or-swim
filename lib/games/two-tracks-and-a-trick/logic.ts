import { Room, ClientRoom } from '../types';
import { TwoTracksGame, ClientTwoTracksGame } from './types';

export const SLUG = 'two-tracks-and-a-trick';
export const MIN_PLAYERS = 3;

/** Fisher–Yates shuffle returning a new array. */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build a fresh Two Tracks and a Trick room in the lobby phase. */
export function createRoom(id: string, hostId: string): Room<TwoTracksGame> {
  return {
    id,
    gameType: SLUG,
    hostId,
    phase: 'lobby',
    players: {},
    game: {
      submissions: {},
      submittedIds: [],
      order: [],
      roundIndex: 0,
      eligibleIds: [],
      guesses: {},
      guessedIds: [],
      roundHistory: [],
      winnerIds: [],
    },
  };
}

/**
 * Open the round at `roundIndex` for guessing. Snapshots the eligible guesser
 * pool — everyone who has submitted a set, present now, except the subject — so
 * a player joining mid-round can't disturb the in-flight round's auto-reveal.
 * Mutates `room` in place.
 */
export function openRound(room: Room<TwoTracksGame>): void {
  const g = room.game;
  const subjectId = g.order[g.roundIndex];
  g.eligibleIds = g.submittedIds.filter((id) => id !== subjectId && room.players[id]);
  g.guesses = {};
  g.guessedIds = [];
  room.phase = 'guessing';
}

/**
 * Score the current round and flip to `revealed`. Each eligible guesser earns
 * +1 for spotting the lie; the subject earns +1 for every guesser they fooled
 * (a wrong guess or no guess at all). Mutates `room` in place.
 */
export function scoreRound(room: Room<TwoTracksGame>): void {
  const g = room.game;
  const subjectId = g.order[g.roundIndex];
  const sub = g.submissions[subjectId];
  const lieIndex = sub.lieIndex;

  const points: Record<string, number> = {};
  const guessEntries: TwoTracksGame['roundHistory'][number]['guesses'] = [];
  let fooled = 0;

  for (const gid of g.eligibleIds) {
    const guessIndex = gid in g.guesses ? g.guesses[gid] : -1;
    const correct = guessIndex === lieIndex;
    if (correct) {
      points[gid] = (points[gid] ?? 0) + 1;
    } else {
      fooled += 1;
    }
    guessEntries.push({
      playerId: gid,
      playerName: room.players[gid]?.name ?? 'Unknown',
      guessIndex,
      correct,
    });
  }

  // Author bonus: one point per player fooled.
  points[subjectId] = (points[subjectId] ?? 0) + fooled;

  for (const [pid, pts] of Object.entries(points)) {
    if (room.players[pid]) room.players[pid].score += pts;
  }

  g.roundHistory.push({
    subjectId,
    subjectName: room.players[subjectId]?.name ?? 'Unknown',
    statements: sub.statements,
    lieIndex,
    guesses: guessEntries,
    points,
  });

  room.phase = 'revealed';
}

/** The player id(s) with the highest score. Ties co-win. */
export function computeWinners(room: Room<TwoTracksGame>): string[] {
  const players = Object.values(room.players);
  if (players.length === 0) return [];
  const max = Math.max(...players.map((p) => p.score));
  return players.filter((p) => p.score === max).map((p) => p.id);
}

export function sanitize(room: Room<TwoTracksGame>): ClientRoom<ClientTwoTracksGame> {
  const g = room.game;

  let currentSubject: ClientTwoTracksGame['currentSubject'] = null;
  if (room.phase === 'guessing') {
    const subjectId = g.order[g.roundIndex];
    const sub = g.submissions[subjectId];
    if (sub) {
      currentSubject = {
        subjectId,
        subjectName: room.players[subjectId]?.name ?? 'Unknown',
        statements: sub.statements, // lieIndex deliberately omitted
      };
    }
  }

  return {
    id: room.id,
    gameType: room.gameType,
    hostId: room.hostId,
    phase: room.phase,
    players: room.players,
    crewSlug: room.crewSlug,
    game: {
      submittedIds: g.submittedIds,
      roundIndex: g.roundIndex,
      totalRounds: g.order.length,
      currentSubject,
      eligibleIds: g.eligibleIds,
      guessedIds: g.guessedIds,
      roundHistory: g.roundHistory,
      winnerIds: g.winnerIds,
    },
  };
}
