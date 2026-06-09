import { NextRequest, NextResponse } from 'next/server';
import { generateId } from '@/lib/ids';
import { createRoom } from '@/lib/games/two-tracks-and-a-trick/logic';
import { saveRoom } from '@/lib/redis';
import { broadcastCrewGameStarted } from '@/lib/pusher-server';

/**
 * Create a Two Tracks and a Trick room. Optionally tie it to a crew so the
 * winner's victory is recorded to that crew's leaderboard at game end.
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
  const hostPlayerId = crewSlug && memberId ? memberId : generateId(6);

  const room = createRoom(gameId, hostPlayerId);
  if (crewSlug && memberId) {
    room.crewSlug = crewSlug;
  }
  await saveRoom(room);

  // Pull everyone in the crew lobby into the room the host just made.
  if (crewSlug && memberId) {
    await broadcastCrewGameStarted(crewSlug, 'two-tracks-and-a-trick', gameId);
  }

  return NextResponse.json({ gameId, playerId: hostPlayerId });
}
