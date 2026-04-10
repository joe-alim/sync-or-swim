import { NextResponse } from 'next/server';
import { generateId, shuffleDeck } from '@/lib/game';
import { saveGame } from '@/lib/redis';
import { GameState } from '@/lib/types';

export async function POST(): Promise<NextResponse> {
  const gameId = generateId(6);
  const hostPlayerId = generateId(6);

  const initialState: GameState = {
    id: gameId,
    hostId: hostPlayerId,
    phase: 'lobby',
    players: {},
    deck: shuffleDeck(),
    currentCard: null,
    submittedIds: [],
    answers: {},
    roundHistory: [],
    winnerId: null,
  };

  await saveGame(initialState);

  return NextResponse.json({ gameId, playerId: hostPlayerId });
}
