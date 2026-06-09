import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { MIN_PLAYERS } from '@/lib/games/two-tracks-and-a-trick/logic';
import { TwoTracksGame } from '@/lib/games/two-tracks-and-a-trick/types';

// lobby → writing. Opens the simultaneous "write your two truths and a lie"
// phase. Host only.
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
    return NextResponse.json({ error: 'Only the host can start the game' }, { status: 403 });
  }

  if (room.phase !== 'lobby') {
    return NextResponse.json({ error: 'Game is not in lobby phase' }, { status: 400 });
  }

  if (Object.keys(room.players).length < MIN_PLAYERS) {
    return NextResponse.json(
      { error: `Need at least ${MIN_PLAYERS} players to start` },
      { status: 400 }
    );
  }

  room.phase = 'writing';
  room.game.submissions = {};
  room.game.submittedIds = [];

  await saveRoom(room);
  await broadcastState(gameId);

  return NextResponse.json({ success: true });
}
