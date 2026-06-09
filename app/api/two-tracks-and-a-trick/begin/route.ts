import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { openRound, shuffle, MIN_PLAYERS } from '@/lib/games/two-tracks-and-a-trick/logic';
import { TwoTracksGame } from '@/lib/games/two-tracks-and-a-trick/types';

// writing → guessing. The host can begin without everyone: any present player
// who hasn't written a set is dropped from the roster (they can rejoin later as
// a late joiner via the catch-up flow). Builds the randomized subject order from
// the players who did submit and opens the first round. Host only.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId } = await req.json();

  if (!gameId || !playerId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const room = await getRoom<TwoTracksGame>(gameId);
  if (!room) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (playerId !== room.hostId) {
    return NextResponse.json({ error: 'Only the host can begin guessing' }, { status: 403 });
  }

  if (room.phase !== 'writing') {
    return NextResponse.json({ error: 'Game is not in writing phase' }, { status: 400 });
  }

  // The host must have written their own set before starting.
  if (!room.game.submittedIds.includes(room.hostId)) {
    return NextResponse.json({ error: 'Submit your own set first' }, { status: 400 });
  }

  // Need enough players who actually submitted to make a game.
  if (room.game.submittedIds.length < MIN_PLAYERS) {
    return NextResponse.json(
      { error: `Need at least ${MIN_PLAYERS} players with a set to start` },
      { status: 400 }
    );
  }

  // Drop anyone who never submitted. They leave the roster but can rejoin
  // mid-pass via the catch-up flow (join → write set → appended to order).
  for (const id of Object.keys(room.players)) {
    if (!room.game.submittedIds.includes(id)) {
      delete room.players[id];
    }
  }

  room.game.order = shuffle([...room.game.submittedIds]);
  room.game.roundIndex = 0;
  openRound(room);

  await saveRoom(room);
  await broadcastState(gameId);

  return NextResponse.json({ success: true });
}
