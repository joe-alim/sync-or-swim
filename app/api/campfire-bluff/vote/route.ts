import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { scoreRound } from '@/lib/games/campfire-bluff/logic';
import { CampfireBluffGame } from '@/lib/games/campfire-bluff/types';

/**
 * Record a vote for the option believed to be the true answer. Only this
 * round's frozen eligible voters may vote, and no one may vote for their own
 * bluff. When the last eligible voter locks in, the round scores and
 * auto-flips to `revealed` (mirrors Two Tracks' guess→reveal).
 *
 * Body: { gameId, playerId, optionId: string }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId, optionId } = await req.json();

  if (!gameId || !playerId || typeof optionId !== 'string') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const room = await getRoom<CampfireBluffGame>(gameId);
  if (!room) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (room.phase !== 'voting') {
    return NextResponse.json({ error: 'Game is not in voting phase' }, { status: 400 });
  }

  if (!room.game.eligibleVoterIds.includes(playerId)) {
    return NextResponse.json({ error: 'You are not voting this round' }, { status: 403 });
  }

  if (room.game.votedIds.includes(playerId)) {
    return NextResponse.json({ error: 'Already voted' }, { status: 400 });
  }

  const option = room.game.options.find((o) => o.id === optionId);
  if (!option) {
    return NextResponse.json({ error: 'Invalid option' }, { status: 400 });
  }

  if (option.authorId === playerId) {
    return NextResponse.json({ error: "You can't vote for your own bluff" }, { status: 400 });
  }

  room.game.votes[playerId] = optionId;
  room.game.votedIds.push(playerId);

  // Auto-reveal once everyone eligible has voted.
  const allVoted = room.game.eligibleVoterIds.every((id) => room.game.votedIds.includes(id));
  if (allVoted) {
    scoreRound(room);
  }

  await saveRoom(room);
  await broadcastState(gameId);

  return NextResponse.json({ success: true });
}
