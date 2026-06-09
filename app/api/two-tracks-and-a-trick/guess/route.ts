import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { scoreRound } from '@/lib/games/two-tracks-and-a-trick/logic';
import { TwoTracksGame } from '@/lib/games/two-tracks-and-a-trick/types';

/**
 * Record a guess at the current subject's lie. Only this round's frozen eligible
 * guessers may guess. When the last eligible guesser locks in, the round scores
 * and auto-flips to `revealed` (mirrors Sync or Swim's submit→reveal).
 *
 * Body: { gameId, playerId, guessIndex: 0..2 }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId, guessIndex } = await req.json();

  if (!gameId || !playerId || guessIndex === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const room = await getRoom<TwoTracksGame>(gameId);
  if (!room) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (room.phase !== 'guessing') {
    return NextResponse.json({ error: 'Game is not in guessing phase' }, { status: 400 });
  }

  if (!room.game.eligibleIds.includes(playerId)) {
    return NextResponse.json({ error: 'You are not guessing this round' }, { status: 403 });
  }

  if (room.game.guessedIds.includes(playerId)) {
    return NextResponse.json({ error: 'Already guessed' }, { status: 400 });
  }

  if (typeof guessIndex !== 'number' || guessIndex < 0 || guessIndex > 2) {
    return NextResponse.json({ error: 'Invalid guess' }, { status: 400 });
  }

  room.game.guesses[playerId] = guessIndex;
  room.game.guessedIds.push(playerId);

  // Auto-reveal once everyone eligible has guessed.
  const allGuessed = room.game.eligibleIds.every((id) => room.game.guessedIds.includes(id));
  if (allGuessed) {
    scoreRound(room);
  }

  await saveRoom(room);
  await broadcastState(gameId);

  return NextResponse.json({ success: true });
}
