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
    return NextResponse.json({ error: 'Only the host can advance to the next card' }, { status: 403 });
  }

  if (state.phase !== 'revealed') {
    return NextResponse.json({ error: 'Game is not in revealed phase' }, { status: 400 });
  }

  // If a winner was already determined during reveal, end the game now
  if (state.winnerId) {
    state.phase = 'ended';
  } else if (state.deck.length === 0) {
    return NextResponse.json({ error: 'No cards remaining' }, { status: 400 });
  } else {
    const card = state.deck.pop()!;
    state.currentCard = card;
    state.phase = 'answering';
    state.submittedIds = [];
    state.answers = {};
  }

  await saveGame(state);
  await broadcastState(gameId, sanitizeState(state));

  return NextResponse.json({ success: true });
}
