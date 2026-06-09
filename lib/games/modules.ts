// Server-only registry mapping a game slug to its runtime module. Used by the
// generic state route (and any shared room plumbing) to dispatch by
// `room.gameType`. Only *playable* games appear here; coming-soon games live
// in the meta registry (./registry.ts) but have no module.

import { Room, ClientRoom } from './types';
import * as syncOrSwim from './sync-or-swim/logic';
import * as twoTracks from './two-tracks-and-a-trick/logic';

export interface GameModule {
  slug: string;
  createRoom(id: string, hostId: string): Room<unknown>;
  sanitize(room: Room<unknown>): ClientRoom<unknown>;
}

const MODULES: Record<string, GameModule> = {
  // Each game's functions are strongly typed over its own state; the cast
  // bridges that to the registry's erased `unknown` payload at the one
  // dispatch boundary.
  [syncOrSwim.SLUG]: {
    slug: syncOrSwim.SLUG,
    createRoom: syncOrSwim.createRoom,
    sanitize: syncOrSwim.sanitize as unknown as GameModule['sanitize'],
  },
  [twoTracks.SLUG]: {
    slug: twoTracks.SLUG,
    createRoom: twoTracks.createRoom,
    sanitize: twoTracks.sanitize as unknown as GameModule['sanitize'],
  },
};

export function getModule(slug: string): GameModule | null {
  return MODULES[slug] ?? null;
}
