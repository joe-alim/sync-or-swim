import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/lib/redis';
import { getModule } from '@/lib/games/modules';

// Generic, game-agnostic state read. Dispatches sanitization to the game module
// named by the room's `gameType`, so every game shares this one endpoint.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const room = await getRoom(id);
  if (!room) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const gameModule = getModule(room.gameType);
  if (!gameModule) {
    return NextResponse.json({ error: 'Unknown game type' }, { status: 500 });
  }

  // Hidden-information games read the caller's identity from headers to return a
  // per-player view. Sent via headers (not the URL) so secrets don't land in logs.
  // Games without secrets ignore this.
  const playerId = req.headers.get('x-player-id');
  const viewer = playerId
    ? { playerId, secret: req.headers.get('x-player-secret') ?? undefined }
    : undefined;

  return NextResponse.json(gameModule.sanitize(room, viewer));
}
