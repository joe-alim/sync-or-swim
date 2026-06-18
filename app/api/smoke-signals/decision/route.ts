import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { resolveBishopRedraw } from '@/lib/games/smoke-signals/logic';
import { authed, recordWinIfEnded } from '@/lib/games/smoke-signals/serverHelpers';
import { SmokeSignalsGame } from '@/lib/games/smoke-signals/types';

/** Resolve a pending secondary decision (currently: the Bishop's optional redraw). */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId, secret, redraw } = await req.json();
  if (!gameId || !playerId || typeof redraw !== 'boolean') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const room = await getRoom<SmokeSignalsGame>(gameId);
  if (!room) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  if (!authed(room, playerId, secret)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const result = resolveBishopRedraw(room, playerId, redraw);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await recordWinIfEnded(room);
  await saveRoom(room);
  await broadcastState(gameId);
  return NextResponse.json({ success: true });
}
