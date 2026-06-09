import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { scoreRound } from '@/lib/games/two-tracks-and-a-trick/logic';
import { TwoTracksGame } from '@/lib/games/two-tracks-and-a-trick/types';

// guessing → revealed. Lets the host reveal early (e.g. someone is idle);
// missing guesses count as incorrect. Host only.
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
    return NextResponse.json({ error: 'Only the host can reveal' }, { status: 403 });
  }

  if (room.phase !== 'guessing') {
    return NextResponse.json({ error: 'Game is not in guessing phase' }, { status: 400 });
  }

  scoreRound(room);

  await saveRoom(room);
  await broadcastState(gameId);

  return NextResponse.json({ success: true });
}
