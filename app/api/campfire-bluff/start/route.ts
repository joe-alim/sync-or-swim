import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { openBluffing, MIN_PLAYERS, ROUNDS_PER_GAME } from '@/lib/games/campfire-bluff/logic';
import { CampfireBluffGame } from '@/lib/games/campfire-bluff/types';

// lobby → bluffing. Sets the round count for this game and draws the first
// question. Host only.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId } = await req.json();

  if (!gameId || !playerId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const room = await getRoom<CampfireBluffGame>(gameId);
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

  room.game.totalRounds = Math.min(ROUNDS_PER_GAME, room.game.deck.length);
  room.game.roundIndex = 0;
  const question = room.game.deck.pop()!;
  openBluffing(room, question);

  await saveRoom(room);
  await broadcastState(gameId);

  return NextResponse.json({ success: true });
}
