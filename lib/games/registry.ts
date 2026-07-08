// Client-safe registry of every game in the Foxflame suite. Contains only
// metadata (no server logic), so it is safe to import into client components
// such as the hub. Add a new game by appending its meta here — the hub renders
// cards automatically. For a *playable* game, also register its server module
// in ./modules.ts.

import { GameMeta } from './types';
import { syncOrSwimMeta } from './sync-or-swim/meta';
import { twoTracksAndATrickMeta } from './two-tracks-and-a-trick/meta';
import { campfireConfessionsMeta } from './campfire-confessions/meta';
import { smokeSignalsMeta } from './smoke-signals/meta';
import { campfireBluffMeta } from './campfire-bluff/meta';

export const GAMES: GameMeta[] = [
  syncOrSwimMeta,
  twoTracksAndATrickMeta,
  smokeSignalsMeta,
  campfireConfessionsMeta,
  campfireBluffMeta,
];

export function getGameMeta(slug: string): GameMeta | null {
  return GAMES.find((g) => g.slug === slug) ?? null;
}
