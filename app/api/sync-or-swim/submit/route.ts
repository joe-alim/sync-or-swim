import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { SyncOrSwimGame } from '@/lib/games/sync-or-swim/types';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId, answer } = await req.json();

  if (!gameId || !playerId || answer === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const room = await getRoom<SyncOrSwimGame>(gameId);
  if (!room) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (room.phase !== 'answering') {
    return NextResponse.json({ error: 'Game is not in answering phase' }, { status: 400 });
  }

  if (!room.players[playerId]) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  if (room.game.submittedIds.includes(playerId)) {
    return NextResponse.json({ error: 'Already submitted' }, { status: 400 });
  }

  room.game.answers[playerId] = answer.trim();
  room.game.submittedIds.push(playerId);

  await saveRoom(room);
  await broadcastState(gameId);

  return NextResponse.json({ success: true });
}
