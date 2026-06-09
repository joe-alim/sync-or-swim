import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
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
    return NextResponse.json({ error: 'Only the host can start the game' }, { status: 403 });
  }

  if (room.phase !== 'lobby') {
    return NextResponse.json({ error: 'Game is not in lobby phase' }, { status: 400 });
  }

  const playerCount = Object.keys(room.players).length;
  if (playerCount < 2) {
    return NextResponse.json({ error: 'Need at least 2 players to start' }, { status: 400 });
  }

  const card = room.game.deck.pop();
  if (!card) {
    return NextResponse.json({ error: 'No cards remaining' }, { status: 400 });
  }

  room.game.currentCard = card;
  room.phase = 'answering';
  room.game.submittedIds = [];
  room.game.answers = {};

  await saveRoom(room);
  await broadcastState(gameId);

  return NextResponse.json({ success: true });
}
