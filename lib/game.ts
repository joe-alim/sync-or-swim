import { GameState, ClientGameState } from './types';
import { CARDS } from './cards';

export const WIN_SCORE = 25;

export function generateId(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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
      playerIds.forEach(id => { scores[id] = 3; });
    } else if (playerIds.length >= 3) {
      playerIds.forEach(id => { scores[id] = 1; });
    }
  }
  return scores;
}

export function sanitizeState(state: GameState): ClientGameState {
  return {
    id: state.id,
    hostId: state.hostId,
    phase: state.phase,
    players: state.players,
    currentCard: state.currentCard,
    submittedIds: state.submittedIds,
    answers: state.phase === 'answering' ? {} : state.answers,
    roundHistory: state.roundHistory,
    winnerId: state.winnerId,
    cardsRemaining: state.deck.length,
  };
}

