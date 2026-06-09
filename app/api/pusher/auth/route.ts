import { NextRequest, NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher-server';

/**
 * Authorize a Pusher *presence* subscription for a crew lobby. Presence channels
 * (unlike the plain `game-{id}` channels) must be signed server-side, and the
 * signature embeds the subscriber's identity so every other client in the lobby
 * sees who is present.
 *
 * Identity here is cosmetic — it only drives the "who's in the lobby" badges.
 * The leaderboard write path is still guarded by the crew PIN, so trusting the
 * client-supplied `{ memberId, name }` for presence display is consistent with
 * the crew model's lightweight-security stance (PINs guard bragging rights).
 *
 * Body: { socket_id, channel_name, memberId?, name? }
 * Only `presence-crew-*` channels are authorized; anything else is refused.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { socket_id, channel_name, memberId, name } = await req.json();

  if (!socket_id || !channel_name) {
    return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 });
  }
  if (!String(channel_name).startsWith('presence-crew-')) {
    return NextResponse.json({ error: 'Channel not allowed' }, { status: 403 });
  }

  // A subscriber with no cached crew identity still gets a stable, unique id so
  // the channel authorizes; they simply show up as a guest.
  const presenceData = {
    user_id: memberId || `guest-${socket_id}`,
    user_info: { name: name || 'Guest' },
  };

  const auth = pusherServer.authorizeChannel(socket_id, channel_name, presenceData);
  return NextResponse.json(auth);
}
