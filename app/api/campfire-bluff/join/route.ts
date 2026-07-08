import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { Player } from '@/lib/games/types';
import { CampfireBluffGame } from '@/lib/games/campfire-bluff/types';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId, name } = await req.json();

  if (!gameId || !playerId || !name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const room = await getRoom<CampfireBluffGame>(gameId);
  if (!room) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  // Reconnect: player already exists
  if (room.players[playerId]) {
    return NextResponse.json({ success: true, player: room.players[playerId] });
  }

  if (room.phase === 'ended') {
    return NextResponse.json({ error: 'This game has already ended' }, { status: 400 });
  }

  if (Object.keys(room.players).length >= 10) {
    return NextResponse.json({ error: 'Game is full (max 10 players)' }, { status: 400 });
  }

  const trimmedName = name.trim();

  const nameTaken = Object.values(room.players).some(
    (p) => p.name.toLowerCase() === trimmedName.toLowerCase() && p.id !== playerId
  );
  if (nameTaken) {
    return NextResponse.json({ error: 'Name already taken' }, { status: 400 });
  }

  const newPlayer: Player = {
    id: playerId,
    name: trimmedName,
    score: 0,
    isHost: playerId === room.hostId,
  };

  room.players[playerId] = newPlayer;

  await saveRoom(room);
  await broadcastState(gameId);

  return NextResponse.json({ success: true, player: newPlayer });
}
