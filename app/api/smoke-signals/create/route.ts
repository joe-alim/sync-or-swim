import { NextRequest, NextResponse } from 'next/server';
import { generateId } from '@/lib/ids';
import { createRoom } from '@/lib/games/smoke-signals/logic';
import { saveRoom } from '@/lib/redis';
import { broadcastCrewGameStarted } from '@/lib/pusher-server';

/**
 * Create a Smoke Signals room. Optionally tie it to a crew so the winner's
 * victory is recorded to that crew's leaderboard at game end. The host is added
 * to the table via a follow-up /join call (which issues their secret).
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
  if (crewSlug && memberId) room.crewSlug = crewSlug;
  await saveRoom(room);

  if (crewSlug && memberId) {
    await broadcastCrewGameStarted(crewSlug, 'smoke-signals', gameId);
  }

  return NextResponse.json({ gameId, playerId: hostPlayerId });
}
