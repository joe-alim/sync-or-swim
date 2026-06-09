import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { shuffleDeck } from '@/lib/games/sync-or-swim/logic';
import { SyncOrSwimGame } from '@/lib/games/sync-or-swim/types';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId } = await req.json();

  if (!gameId || !playerId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const room = await getRoom<SyncOrSwimGame>(gameId);
  if (!room) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (playerId !== room.hostId) {
    return NextResponse.json({ error: 'Only the host can reset the game' }, { status: 403 });
  }

  // Reset all player scores but keep players
  for (const pid of Object.keys(room.players)) {
    room.players[pid].score = 0;
  }

  room.phase = 'lobby';
  room.game.deck = shuffleDeck();
  room.game.currentCard = null;
  room.game.submittedIds = [];
  room.game.answers = {};
  room.game.roundHistory = [];
  room.game.winnerId = null;

  await saveRoom(room);
  await broadcastState(gameId);

  return NextResponse.json({ success: true });
}
