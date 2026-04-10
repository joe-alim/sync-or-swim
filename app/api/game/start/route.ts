import { NextRequest, NextResponse } from 'next/server';
import { getGame, saveGame } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { sanitizeState } from '@/lib/game';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId } = await req.json();

  if (!gameId || !playerId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const state = await getGame(gameId);
  if (!state) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (playerId !== state.hostId) {
    return NextResponse.json({ error: 'Only the host can start the game' }, { status: 403 });
  }

  if (state.phase !== 'lobby') {
    return NextResponse.json({ error: 'Game is not in lobby phase' }, { status: 400 });
  }

  const playerCount = Object.keys(state.players).length;
  if (playerCount < 2) {
    return NextResponse.json({ error: 'Need at least 2 players to start' }, { status: 400 });
  }

  const card = state.deck.pop();
  if (!card) {
    return NextResponse.json({ error: 'No cards remaining' }, { status: 400 });
  }

  state.currentCard = card;
  state.phase = 'answering';
  state.submittedIds = [];
  state.answers = {};

  await saveGame(state);
  await broadcastState(gameId, sanitizeState(state));

  return NextResponse.json({ success: true });
}
