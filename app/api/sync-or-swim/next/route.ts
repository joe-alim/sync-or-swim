import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom, recordCrewWin } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { SyncOrSwimGame } from '@/lib/games/sync-or-swim/types';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId } = await req.json();

  if (!gameId || !playerId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const room = await getRoom<SyncOrSwimGame>(gameId);
  if (!room) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (playerId !== room.hostId) {
    return NextResponse.json({ error: 'Only the host can advance to the next card' }, { status: 403 });
  }

  if (room.phase !== 'revealed') {
    return NextResponse.json({ error: 'Game is not in revealed phase' }, { status: 400 });
  }

  // If a winner was already determined during reveal, end the game now
  if (room.game.winnerId) {
    room.phase = 'ended';

    // Record the win to the crew leaderboard exactly once. The winRecorded
    // guard makes a retried end-of-game request idempotent.
    if (room.crewSlug && !room.winRecorded) {
      const winnerId = room.game.winnerId;
      await recordCrewWin(room.crewSlug, {
        gameType: room.gameType,
        winnerId,
        winnerName: room.players[winnerId]?.name ?? 'Unknown',
        players: Object.values(room.players).map((p) => p.name),
        ts: Date.now(),
      });
      room.winRecorded = true;
    }
  } else if (room.game.deck.length === 0) {
    return NextResponse.json({ error: 'No cards remaining' }, { status: 400 });
  } else {
    const card = room.game.deck.pop()!;
    room.game.currentCard = card;
    room.phase = 'answering';
    room.game.submittedIds = [];
    room.game.answers = {};
  }

  await saveRoom(room);
  await broadcastState(gameId);

  return NextResponse.json({ success: true });
}
