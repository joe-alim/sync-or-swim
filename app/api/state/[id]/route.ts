import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/lib/redis';
import { getModule } from '@/lib/games/modules';

// Generic, game-agnostic state read. Dispatches sanitization to the game module
// named by the room's `gameType`, so every game shares this one endpoint.
export async function GET(
  _req: NextRequest,
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

  return NextResponse.json(gameModule.sanitize(room));
}
