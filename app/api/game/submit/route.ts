import { NextRequest, NextResponse } from 'next/server';
import { getGame, saveGame } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { sanitizeState } from '@/lib/game';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId, answer } = await req.json();

  if (!gameId || !playerId || answer === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const state = await getGame(gameId);
  if (!state) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (state.phase !== 'answering') {
    return NextResponse.json({ error: 'Game is not in answering phase' }, { status: 400 });
  }

  if (!state.players[playerId]) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  if (state.submittedIds.includes(playerId)) {
    return NextResponse.json({ error: 'Already submitted' }, { status: 400 });
  }

  state.answers[playerId] = answer.trim();
  state.submittedIds.push(playerId);

  await saveGame(state);
  await broadcastState(gameId, sanitizeState(state));

  return NextResponse.json({ success: true });
}
