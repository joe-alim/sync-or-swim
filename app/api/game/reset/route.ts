import { NextRequest, NextResponse } from 'next/server';
import { getGame, saveGame } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { sanitizeState, shuffleDeck } from '@/lib/game';

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
    return NextResponse.json({ error: 'Only the host can reset the game' }, { status: 403 });
  }

  // Reset all player scores but keep players
  for (const pid of Object.keys(state.players)) {
    state.players[pid].score = 0;
  }

  state.phase = 'lobby';
  state.deck = shuffleDeck();
  state.currentCard = null;
  state.submittedIds = [];
  state.answers = {};
  state.roundHistory = [];
  state.winnerId = null;

  await saveGame(state);
  await broadcastState(gameId, sanitizeState(state));

  return NextResponse.json({ success: true });
}
