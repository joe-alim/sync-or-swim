import { NextRequest, NextResponse } from 'next/server';
import { getGame, saveGame } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { calculateRoundScores, WIN_SCORE } from '@/lib/game';
import { RoundResult } from '@/lib/types';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId } = await req.json();

  if (!gameId || !playerId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const state = await getGame(gameId);
  if (!state) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (playerId !== state.hostId) {
    return NextResponse.json({ error: 'Only the host can reveal answers' }, { status: 403 });
  }

  if (state.phase !== 'answering') {
    return NextResponse.json({ error: 'Game is not in answering phase' }, { status: 400 });
  }

  const roundScores = calculateRoundScores(state.answers);

  // Add round scores to player totals
  for (const [pid, pts] of Object.entries(roundScores)) {
    if (state.players[pid]) {
      state.players[pid].score += pts;
    }
  }

  // Build round history entry
  const roundResult: RoundResult = {
    card: state.currentCard!,
    answers: Object.entries(state.answers).map(([pid, answer]) => ({
      playerId: pid,
      playerName: state.players[pid]?.name ?? 'Unknown',
      answer,
      points: roundScores[pid] ?? 0,
    })),
  };

  state.roundHistory.push(roundResult);

  // Always show round results first, even if someone won
  state.phase = 'revealed';
  // Pick the highest-scoring player among those who crossed the win line —
  // multiple players can cross WIN_SCORE in the same round, and the winner
  // must be the actual leader, not whoever joined first.
  const winner = Object.values(state.players)
    .filter((p) => p.score >= WIN_SCORE)
    .reduce<typeof state.players[string] | null>(
      (best, p) => (best === null || p.score > best.score ? p : best),
      null
    );
  if (winner) {
    state.winnerId = winner.id;
  }

  await saveGame(state);
  await broadcastState(gameId);

  return NextResponse.json({ success: true });
}
