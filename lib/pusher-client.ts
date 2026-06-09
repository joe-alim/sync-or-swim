import PusherClient from 'pusher-js';
import { getCrewIdentity } from './crew-client';

let instance: PusherClient | null = null;

export function getPusherClient(): PusherClient {
  if (!instance) {
    instance = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      // Plain `game-{id}` channels are public and never hit this; only presence
      // channels (the crew lobby) are authorized. We derive the subscriber's
      // identity from the crew slug baked into the channel name so a single
      // client instance can authorize any crew this device has joined.
      channelAuthorization: {
        transport: 'ajax',
        endpoint: '/api/pusher/auth',
        customHandler: ({ socketId, channelName }, callback) => {
          const slug = channelName.replace(/^presence-crew-/, '');
          const identity = getCrewIdentity(slug);
          fetch('/api/pusher/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              socket_id: socketId,
              channel_name: channelName,
              memberId: identity?.memberId,
              name: identity?.name,
            }),
          })
            .then((res) => {
              if (!res.ok) throw new Error('Presence auth failed');
              return res.json();
            })
            .then((data) => callback(null, data))
            .catch((err) => callback(err as Error, null));
        },
      },
    });
  }
  return instance;
}
