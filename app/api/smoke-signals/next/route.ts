import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { nextRound } from '@/lib/games/smoke-signals/logic';
import { SmokeSignalsGame } from '@/lib/games/smoke-signals/types';

/** Host deals the next round from the round-end screen. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId } = await req.json();
  if (!gameId || !playerId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const room = await getRoom<SmokeSignalsGame>(gameId);
  if (!room) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  if (playerId !== room.hostId) {
    return NextResponse.json({ error: 'Only the host can deal the next round' }, { status: 403 });
  }

  const result = nextRound(room);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await saveRoom(room);
  await broadcastState(gameId);
  return NextResponse.json({ success: true });
}
