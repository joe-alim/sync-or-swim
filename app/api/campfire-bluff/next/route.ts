import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom, recordCrewWin } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { openBluffing, computeWinners } from '@/lib/games/campfire-bluff/logic';
import { CampfireBluffGame } from '@/lib/games/campfire-bluff/types';

/**
 * revealed → bluffing (next question), or revealed → ended once
 * `totalRounds` is reached. End-of-game crew write-back happens here, once
 * per winner, guarded by `winRecorded`. Host only.
 */
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
    return NextResponse.json({ error: 'Only the host can advance' }, { status: 403 });
  }

  if (room.phase !== 'revealed') {
    return NextResponse.json({ error: 'Game is not in revealed phase' }, { status: 400 });
  }

  if (room.game.roundIndex + 1 < room.game.totalRounds) {
    room.game.roundIndex += 1;
    const question = room.game.deck.pop()!;
    openBluffing(room, question);
  } else {
    room.phase = 'ended';
    room.game.winnerIds = computeWinners(room);

    if (room.crewSlug && !room.winRecorded && room.game.winnerIds.length > 0) {
      const players = Object.values(room.players).map((p) => p.name);
      for (const winnerId of room.game.winnerIds) {
        await recordCrewWin(room.crewSlug, {
          gameType: room.gameType,
          winnerId,
          winnerName: room.players[winnerId]?.name ?? 'Unknown',
          players,
          ts: Date.now(),
        });
      }
      room.winRecorded = true;
    }
  }

  await saveRoom(room);
  await broadcastState(gameId);

  return NextResponse.json({ success: true });
}
