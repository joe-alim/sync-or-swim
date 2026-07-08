import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { CampfireBluffGame } from '@/lib/games/campfire-bluff/types';

/**
 * Record a player's bluff answer for the current question.
 *
 * Body: { gameId, playerId, bluff: string }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId, bluff } = await req.json();

  if (!gameId || !playerId || typeof bluff !== 'string') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const room = await getRoom<CampfireBluffGame>(gameId);
  if (!room) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (!room.players[playerId]) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  if (room.phase !== 'bluffing') {
    return NextResponse.json({ error: 'Not accepting bluffs right now' }, { status: 400 });
  }

  if (room.game.submittedIds.includes(playerId)) {
    return NextResponse.json({ error: 'Already submitted' }, { status: 400 });
  }

  const trimmed = bluff.trim();
  if (!trimmed) {
    return NextResponse.json({ error: 'Bluff cannot be empty' }, { status: 400 });
  }

  room.game.bluffs[playerId] = trimmed;
  room.game.submittedIds.push(playerId);

  await saveRoom(room);
  await broadcastState(gameId);

  return NextResponse.json({ success: true });
}
