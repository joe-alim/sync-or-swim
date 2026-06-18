// Server-only helpers shared by the Smoke Signals action routes: validating a
// player's secret, and recording the winner to a crew leaderboard exactly once.

import { Room } from '../types';
import { recordCrewWin } from '@/lib/redis';
import { SmokeSignalsGame } from './types';

type SSRoom = Room<SmokeSignalsGame>;

/** True if `secret` matches the server-issued token for `playerId` in this room. */
export function authed(room: SSRoom, playerId: string, secret: string | undefined): boolean {
  return !!secret && room.game.secrets[playerId] === secret;
}

/**
 * If the game just ended, record the win to the crew leaderboard once. The
 * `winRecorded` guard keeps a retried request idempotent. Mutates `room`.
 */
export async function recordWinIfEnded(room: SSRoom): Promise<void> {
  if (room.phase !== 'game-end' || !room.game.gameWinnerId) return;
  if (!room.crewSlug || room.winRecorded) return;
  const winnerId = room.game.gameWinnerId;
  await recordCrewWin(room.crewSlug, {
    gameType: room.gameType,
    winnerId,
    winnerName: room.players[winnerId]?.name ?? 'Unknown',
    players: Object.values(room.players).map((p) => p.name),
    ts: Date.now(),
  });
  room.winRecorded = true;
}
