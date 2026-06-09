import { NextRequest, NextResponse } from 'next/server';
import { generateId } from '@/lib/ids';
import { createRoom } from '@/lib/games/sync-or-swim/logic';
import { saveRoom } from '@/lib/redis';
import { broadcastCrewGameStarted } from '@/lib/pusher-server';

/**
 * Create a Sync or Swim room. Optionally tie it to a crew so the winner's
 * victory is recorded to that crew's leaderboard at game end.
 *
 * Body (optional): { crewSlug, memberId } — when present, the room belongs to
 * the crew and the host's player id IS their crew memberId.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let crewSlug: string | undefined;
  let memberId: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body === 'object') {
      crewSlug = body.crewSlug || undefined;
      memberId = body.memberId || undefined;
    }
  } catch {
    // No body — a plain anonymous room.
  }

  const gameId = generateId(6);
  // In a crew, the host's room player id is their durable crew memberId so that
  // end-of-game write-back needs no id mapping.
  const hostPlayerId = crewSlug && memberId ? memberId : generateId(6);

  const room = createRoom(gameId, hostPlayerId);
  if (crewSlug && memberId) {
    room.crewSlug = crewSlug;
  }
  await saveRoom(room);

  // Pull everyone in the crew lobby into the room the host just made.
  if (crewSlug && memberId) {
    await broadcastCrewGameStarted(crewSlug, 'sync-or-swim', gameId);
  }

  return NextResponse.json({ gameId, playerId: hostPlayerId });
}
