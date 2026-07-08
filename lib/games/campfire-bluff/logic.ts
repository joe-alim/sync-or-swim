import { Room, ClientRoom } from '../types';
import { CampfireBluffGame, ClientCampfireBluffGame, Option, Question, RoundResult } from './types';
import { QUESTIONS } from './questions';

export const SLUG = 'campfire-bluff';
export const MIN_PLAYERS = 3;
export const ROUNDS_PER_GAME = 8;

/** Fisher–Yates shuffle returning a new array. */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build a fresh Campfire Bluff room in the lobby phase. */
export function createRoom(id: string, hostId: string): Room<CampfireBluffGame> {
  return {
    id,
    gameType: SLUG,
    hostId,
    phase: 'lobby',
    players: {},
    game: {
      deck: shuffle(QUESTIONS),
      totalRounds: 0,
      roundIndex: 0,
      currentQuestion: null,
      bluffs: {},
      submittedIds: [],
      options: [],
      eligibleVoterIds: [],
      votes: {},
      votedIds: [],
      roundHistory: [],
      winnerIds: [],
    },
  };
}

/** Draw the next question and reset per-round bluffing state. Mutates `room`. */
export function openBluffing(room: Room<CampfireBluffGame>, question: Question): void {
  const g = room.game;
  g.currentQuestion = question;
  g.bluffs = {};
  g.submittedIds = [];
  g.options = [];
  g.eligibleVoterIds = [];
  g.votes = {};
  g.votedIds = [];
  room.phase = 'bluffing';
}

/**
 * Shuffle the submitted bluffs together with the true answer into anonymous
 * options, and snapshot the eligible voter pool. Mutates `room` in place.
 */
export function openVoting(room: Room<CampfireBluffGame>): void {
  const g = room.game;
  const bluffOptions: Option[] = Object.entries(g.bluffs).map(([authorId, text]) => ({
    id: '',
    text,
    authorId,
  }));
  const trueOption: Option = { id: '', text: g.currentQuestion!.answer, authorId: null };
  const shuffled = shuffle([trueOption, ...bluffOptions]);
  g.options = shuffled.map((opt, i) => ({ ...opt, id: String(i) }));

  g.eligibleVoterIds = Object.keys(room.players);
  g.votes = {};
  g.votedIds = [];
  room.phase = 'voting';
}

/**
 * Score the current round and flip to `revealed`. Voters who find the truth
 * earn +2; each bluff's author earns +1 per player fooled by it. Mutates
 * `room` in place.
 */
export function scoreRound(room: Room<CampfireBluffGame>): void {
  const g = room.game;
  const points: Record<string, number> = {};
  const voterIdsByOption: Record<string, string[]> = {};
  for (const opt of g.options) voterIdsByOption[opt.id] = [];

  for (const voterId of g.eligibleVoterIds) {
    const optionId = g.votes[voterId];
    if (optionId === undefined || !voterIdsByOption[optionId]) continue;
    voterIdsByOption[optionId].push(voterId);

    const option = g.options.find((o) => o.id === optionId)!;
    if (option.authorId === null) {
      points[voterId] = (points[voterId] ?? 0) + 2;
    } else {
      points[option.authorId] = (points[option.authorId] ?? 0) + 1;
    }
  }

  for (const [pid, pts] of Object.entries(points)) {
    if (room.players[pid]) room.players[pid].score += pts;
  }

  const roundResult: RoundResult = {
    prompt: g.currentQuestion!.prompt,
    trueAnswer: g.currentQuestion!.answer,
    options: g.options.map((opt) => ({
      text: opt.text,
      isTrue: opt.authorId === null,
      authorId: opt.authorId,
      authorName: opt.authorId ? room.players[opt.authorId]?.name ?? 'Unknown' : null,
      voterIds: voterIdsByOption[opt.id],
    })),
    points,
  };

  g.roundHistory.push(roundResult);
  room.phase = 'revealed';
}

/** The player id(s) with the highest score. Ties co-win. */
export function computeWinners(room: Room<CampfireBluffGame>): string[] {
  const players = Object.values(room.players);
  if (players.length === 0) return [];
  const max = Math.max(...players.map((p) => p.score));
  return players.filter((p) => p.score === max).map((p) => p.id);
}

export function sanitize(room: Room<CampfireBluffGame>): ClientRoom<ClientCampfireBluffGame> {
  const g = room.game;

  return {
    id: room.id,
    gameType: room.gameType,
    hostId: room.hostId,
    phase: room.phase,
    players: room.players,
    crewSlug: room.crewSlug,
    game: {
      roundIndex: g.roundIndex,
      totalRounds: g.totalRounds,
      currentPrompt: g.currentQuestion?.prompt ?? null,
      submittedIds: g.submittedIds,
      options:
        room.phase === 'voting' || room.phase === 'revealed'
          ? g.options.map((o) => ({ id: o.id, text: o.text }))
          : [],
      eligibleVoterIds: g.eligibleVoterIds,
      votedIds: g.votedIds,
      roundHistory: g.roundHistory,
      winnerIds: g.winnerIds,
    },
  };
}
