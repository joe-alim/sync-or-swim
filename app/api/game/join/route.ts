import { NextRequest, NextResponse } from 'next/server';
import { getGame, saveGame } from '@/lib/redis';
import { broadcastState } from '@/lib/pusher-server';
import { sanitizeState } from '@/lib/game';
import { Player } from '@/lib/types';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { gameId, playerId, name } = await req.json();

  if (!gameId || !playerId || !name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const state = await getGame(gameId);
  if (!state) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  // Reconnect: player already exists
  if (state.players[playerId]) {
    return NextResponse.json({ success: true, player: state.players[playerId] });
  }

  if (state.phase === 'ended') {
    return NextResponse.json({ error: 'This game has already ended' }, { status: 400 });
  }

  if (Object.keys(state.players).length >= 12) {
    return NextResponse.json({ error: 'Game is full (max 12 players)' }, { status: 400 });
  }

  const trimmedName = name.trim();

  // Check if name is taken by another player
  const nameTaken = Object.values(state.players).some(
    (p) => p.name.toLowerCase() === trimmedName.toLowerCase() && p.id !== playerId
  );
  if (nameTaken) {
    return NextResponse.json({ error: 'Name already taken' }, { status: 400 });
  }

  const newPlayer: Player = {
    id: playerId,
    name: trimmedName,
    score: 0,
    isHost: playerId === state.hostId,
  };

  state.players[playerId] = newPlayer;

  await saveGame(state);
  await broadcastState(gameId, sanitizeState(state));

  return NextResponse.json({ success: true, player: newPlayer });
}
