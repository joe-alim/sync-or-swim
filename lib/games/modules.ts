// Server-only registry mapping a game slug to its runtime module. Used by the
// generic state route (and any shared room plumbing) to dispatch by
// `room.gameType`. Only *playable* games appear here; coming-soon games live
// in the meta registry (./registry.ts) but have no module.

import { Room, ClientRoom, ViewerCredential } from './types';
import * as syncOrSwim from './sync-or-swim/logic';
import * as twoTracks from './two-tracks-and-a-trick/logic';
import * as smokeSignals from './smoke-signals/logic';
import * as campfireBluff from './campfire-bluff/logic';

export interface GameModule {
  slug: string;
  createRoom(id: string, hostId: string): Room<unknown>;
  // `viewer` is optional so hidden-information games (e.g. Smoke Signals) can
  // return a per-player view; games without secrets simply ignore it.
  sanitize(room: Room<unknown>, viewer?: ViewerCredential): ClientRoom<unknown>;
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
  [smokeSignals.SLUG]: {
    slug: smokeSignals.SLUG,
    createRoom: smokeSignals.createRoom,
    sanitize: smokeSignals.sanitize as unknown as GameModule['sanitize'],
  },
  [campfireBluff.SLUG]: {
    slug: campfireBluff.SLUG,
    createRoom: campfireBluff.createRoom,
    sanitize: campfireBluff.sanitize as unknown as GameModule['sanitize'],
  },
};

export function getModule(slug: string): GameModule | null {
  return MODULES[slug] ?? null;
}
