import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { calculateRoundScores, WIN_SCORE } from '@/lib/games/sync-or-swim/logic';
import { RoundResult, SyncOrSwimGame } from '@/lib/games/sync-or-swim/types';

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
    return NextResponse.json({ error: 'Only the host can reveal answers' }, { status: 403 });
  }

  if (room.phase !== 'answering') {
    return NextResponse.json({ error: 'Game is not in answering phase' }, { status: 400 });
  }

  const roundScores = calculateRoundScores(room.game.answers);

  // Add round scores to player totals
  for (const [pid, pts] of Object.entries(roundScores)) {
    if (room.players[pid]) {
      room.players[pid].score += pts;
    }
  }

  // Build round history entry
  const roundResult: RoundResult = {
    card: room.game.currentCard!,
    answers: Object.entries(room.game.answers).map(([pid, answer]) => ({
      playerId: pid,
      playerName: room.players[pid]?.name ?? 'Unknown',
      answer,
      points: roundScores[pid] ?? 0,
    })),
  };

  room.game.roundHistory.push(roundResult);

  // Always show round results first, even if someone won
  room.phase = 'revealed';
  // Pick the highest-scoring player among those who crossed the win line —
  // multiple players can cross WIN_SCORE in the same round, and the winner
  // must be the actual leader, not whoever joined first.
  const winner = Object.values(room.players)
    .filter((p) => p.score >= WIN_SCORE)
    .reduce<typeof room.players[string] | null>(
      (best, p) => (best === null || p.score > best.score ? p : best),
      null
    );
  if (winner) {
    room.game.winnerId = winner.id;
  }

  await saveRoom(room);
  await broadcastState(gameId);

  return NextResponse.json({ success: true });
}
