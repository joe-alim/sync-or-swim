import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { openVoting } from '@/lib/games/campfire-bluff/logic';
import { CampfireBluffGame } from '@/lib/games/campfire-bluff/types';

// bluffing → voting. Shuffles the submitted bluffs with the true answer into
// anonymous options and freezes the eligible voter pool. A straggler who
// hasn't bluffed by now simply isn't an option this round — no penalty, no
// roster change. Host only.
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
    return NextResponse.json({ error: 'Only the host can open voting' }, { status: 403 });
  }

  if (room.phase !== 'bluffing') {
    return NextResponse.json({ error: 'Game is not in bluffing phase' }, { status: 400 });
  }

  if (room.game.submittedIds.length < 1) {
    return NextResponse.json({ error: 'Need at least one bluff to open voting' }, { status: 400 });
  }

  openVoting(room);

  await saveRoom(room);
  await broadcastState(gameId);

  return NextResponse.json({ success: true });
}
