import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { createRoom } from '@/lib/games/two-tracks-and-a-trick/logic';
import { TwoTracksGame } from '@/lib/games/two-tracks-and-a-trick/types';

// Back to a fresh lobby, keeping the roster (scores zeroed). Host only.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId } = await req.json();

  if (!gameId || !playerId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const room = await getRoom<TwoTracksGame>(gameId);
  if (!room) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (playerId !== room.hostId) {
    return NextResponse.json({ error: 'Only the host can reset the game' }, { status: 403 });
  }

  const fresh = createRoom(room.id, room.hostId);
  fresh.crewSlug = room.crewSlug;
  fresh.players = room.players;
  for (const p of Object.values(fresh.players)) {
    p.score = 0;
  }
  // `winRecorded` is intentionally left unset so the next game records its win.

  await saveRoom(fresh);
  await broadcastState(gameId);

  return NextResponse.json({ success: true });
}
