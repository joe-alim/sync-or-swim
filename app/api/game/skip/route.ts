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
    return NextResponse.json({ error: 'Only the host can skip cards' }, { status: 403 });
  }

  if (state.phase !== 'answering') {
    return NextResponse.json({ error: 'Game is not in answering phase' }, { status: 400 });
  }

  if (state.deck.length === 0) {
    return NextResponse.json({ error: 'No cards remaining' }, { status: 400 });
  }

  const card = state.deck.pop()!;
  state.currentCard = card;
  // Keep phase = 'answering', just replace the card without adding to history
  state.submittedIds = [];
  state.answers = {};

  await saveGame(state);
  await broadcastState(gameId, sanitizeState(state));

  return NextResponse.json({ success: true });
}
