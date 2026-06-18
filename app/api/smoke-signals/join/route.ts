import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { addPlayer } from '@/lib/games/smoke-signals/logic';
import { SmokeSignalsGame } from '@/lib/games/smoke-signals/types';

/**
 * Join (or reconnect to) a Smoke Signals room. Returns the player's private
 * `secret` — the client must keep it and present it on state reads/actions so
 * the server can reveal that player's hidden hand and authorize their moves.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId, name } = await req.json();
  if (!gameId || !playerId || !name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const room = await getRoom<SmokeSignalsGame>(gameId);
  if (!room) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const result = addPlayer(room, playerId, name);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await saveRoom(room);
  await broadcastState(gameId);

  return NextResponse.json({ success: true, player: result.player, secret: result.secret });
}
