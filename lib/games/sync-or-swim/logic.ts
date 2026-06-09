import { Room, ClientRoom } from '../types';
import { SyncOrSwimGame, ClientSyncOrSwimGame } from './types';
import { CARDS } from './cards';

export const SLUG = 'sync-or-swim';
export const WIN_SCORE = 25;

export function shuffleDeck(): string[] {
  const deck = [...CARDS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function calculateRoundScores(answers: Record<string, string>): Record<string, number> {
  const groups: Record<string, string[]> = {};
  for (const [playerId, answer] of Object.entries(answers)) {
    const key = answer.toLowerCase().trim();
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(playerId);
  }
  const scores: Record<string, number> = {};
  for (const playerId of Object.keys(answers)) {
    scores[playerId] = 0;
  }
  for (const playerIds of Object.values(groups)) {
    if (playerIds.length === 2) {
      playerIds.forEach((id) => { scores[id] = 3; });
    } else if (playerIds.length >= 3) {
      playerIds.forEach((id) => { scores[id] = 1; });
    }
  }
  return scores;
}

/** Build a fresh Sync or Swim room in the lobby phase. */
export function createRoom(id: string, hostId: string): Room<SyncOrSwimGame> {
  return {
    id,
    gameType: SLUG,
    hostId,
    phase: 'lobby',
    players: {},
    game: {
      deck: shuffleDeck(),
      currentCard: null,
      submittedIds: [],
      answers: {},
      roundHistory: [],
      winnerId: null,
    },
  };
}

export function sanitize(room: Room<SyncOrSwimGame>): ClientRoom<ClientSyncOrSwimGame> {
  return {
    id: room.id,
    gameType: room.gameType,
    hostId: room.hostId,
    phase: room.phase,
    players: room.players,
    crewSlug: room.crewSlug,
    game: {
      currentCard: room.game.currentCard,
      submittedIds: room.game.submittedIds,
      answers: room.phase === 'answering' ? {} : room.game.answers,
      roundHistory: room.game.roundHistory,
      winnerId: room.game.winnerId,
      cardsRemaining: room.game.deck.length,
    },
  };
}
