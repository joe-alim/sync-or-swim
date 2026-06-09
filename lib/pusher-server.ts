import Pusher from 'pusher';

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

/**
 * Notify all clients that the game state changed.
 *
 * We intentionally broadcast only a tiny ping — NOT the full game state.
 * Pusher caps event payloads at ~10KB, and the full state (chiefly the
 * ever-growing `roundHistory`) eventually exceeds that, causing the trigger
 * to reject. Previously that left every non-acting client stuck on a stale
 * screen until they manually refreshed. Each client now fetches the
 * authoritative state from `/api/state/[id]` when it receives this ping.
 *
 * Wrapped in try/catch so a transient Pusher failure never turns an
 * otherwise-successful game action into a 500.
 */
export async function broadcastState(gameId: string): Promise<void> {
  try {
    await pusherServer.trigger(`game-${gameId}`, 'state-update', {});
  } catch (err) {
    console.error(`Pusher broadcast failed for game ${gameId}:`, err);
  }
}

/**
 * Tell everyone currently in a crew's lobby that the host just launched a game,
 * so their clients can follow the host into the room automatically (no room
 * code to type). Broadcast on the same presence channel the lobby subscribes to.
 *
 * Wrapped in try/catch so a transient Pusher failure never turns an otherwise
 * successful room creation into a 500 — members can still join via the link.
 */
export async function broadcastCrewGameStarted(
  crewSlug: string,
  gameSlug: string,
  gameId: string
): Promise<void> {
  try {
    await pusherServer.trigger(`presence-crew-${crewSlug}`, 'game-started', { gameSlug, gameId });
  } catch (err) {
    console.error(`Pusher crew broadcast failed for crew ${crewSlug}:`, err);
  }
}
