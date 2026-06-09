import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { shuffle } from '@/lib/games/two-tracks-and-a-trick/logic';
import { TwoTracksGame, Submission } from '@/lib/games/two-tracks-and-a-trick/types';

/**
 * Record a player's set: two truths and one lie. Allowed during `writing`, or
 * mid-pass (`guessing`/`revealed`) for a late joiner who hasn't written a set —
 * in which case they're appended to the subject order so they get a turn.
 *
 * Body: { gameId, playerId, statements: string[3], lieIndex: 0..2 }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId, statements, lieIndex } = await req.json();

  if (!gameId || !playerId || !Array.isArray(statements) || lieIndex === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const room = await getRoom<TwoTracksGame>(gameId);
  if (!room) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (!room.players[playerId]) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  // Writing phase, or a mid-pass late joiner who still owes a set.
  const midPass = room.phase === 'guessing' || room.phase === 'revealed';
  if (room.phase !== 'writing' && !midPass) {
    return NextResponse.json({ error: 'Not accepting sets right now' }, { status: 400 });
  }

  if (room.game.submittedIds.includes(playerId)) {
    return NextResponse.json({ error: 'Already submitted' }, { status: 400 });
  }

  // Validate: exactly three non-empty statements and a lie index pointing at one.
  const trimmed = statements.map((s) => (typeof s === 'string' ? s.trim() : ''));
  if (trimmed.length !== 3 || trimmed.some((s) => !s)) {
    return NextResponse.json({ error: 'Enter three non-empty statements' }, { status: 400 });
  }
  if (typeof lieIndex !== 'number' || lieIndex < 0 || lieIndex > 2) {
    return NextResponse.json({ error: 'Mark exactly one statement as the lie' }, { status: 400 });
  }

  // Shuffle into display order so the lie's slot can't be inferred from input
  // order, tracking where the lie lands.
  const tagged = trimmed.map((text, i) => ({ text, isLie: i === lieIndex }));
  const shuffled = shuffle(tagged);
  const submission: Submission = {
    statements: shuffled.map((s) => s.text) as [string, string, string],
    lieIndex: shuffled.findIndex((s) => s.isLie),
  };

  room.game.submissions[playerId] = submission;
  room.game.submittedIds.push(playerId);

  // Mid-pass joiner: append to the tail of the subject order so their spotlight
  // comes after the already-queued subjects. They guess from the next round on.
  if (midPass && !room.game.order.includes(playerId)) {
    room.game.order.push(playerId);
  }

  await saveRoom(room);
  await broadcastState(gameId);

  return NextResponse.json({ success: true });
}
