import { Redis } from '@upstash/redis';
import { Room } from './games/types';
import { Crew, LeaderboardEntry } from './crew';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ROOM_TTL = 60 * 60 * 24; // 24 hours
const CREW_TTL = 60 * 60 * 24 * 90; // 90-day sliding window, refreshed on activity

export async function getRoom<TGame = unknown>(id: string): Promise<Room<TGame> | null> {
  return redis.get<Room<TGame>>(`game:${id}`);
}

export async function saveRoom<TGame = unknown>(room: Room<TGame>): Promise<void> {
  await redis.set(`game:${room.id}`, room, { ex: ROOM_TTL });
}

// --- Crews -----------------------------------------------------------------
// A crew is three keys that age together as a unit (90-day sliding TTL):
//   crew:{slug}              -> Crew blob (roster + metadata)
//   crew:{slug}:leaderboard  -> ZSET memberId -> total wins
//   crew:{slug}:history      -> LIST of past game results (newest first)

const crewKey = (slug: string) => `crew:${slug}`;
const leaderboardKey = (slug: string) => `crew:${slug}:leaderboard`;
const historyKey = (slug: string) => `crew:${slug}:history`;

/** Re-arm the 90-day window on all three crew keys so they expire as a unit. */
async function refreshCrewTtl(slug: string): Promise<void> {
  await Promise.all([
    redis.expire(crewKey(slug), CREW_TTL),
    redis.expire(leaderboardKey(slug), CREW_TTL),
    redis.expire(historyKey(slug), CREW_TTL),
  ]);
}

export async function getCrew(slug: string): Promise<Crew | null> {
  return redis.get<Crew>(crewKey(slug));
}

export async function saveCrew(crew: Crew): Promise<void> {
  await redis.set(crewKey(crew.slug), crew, { ex: CREW_TTL });
  await refreshCrewTtl(crew.slug);
}

export interface CrewHistoryEntry {
  gameType: string;
  winnerId: string;
  winnerName: string;
  players: string[]; // member names present at game end
  ts: number;
}

/**
 * Record a win: bump the winner's score in the leaderboard ZSET and prepend a
 * history entry. Returns the winner's new total. Refreshes the crew TTL.
 */
export async function recordCrewWin(
  slug: string,
  entry: CrewHistoryEntry
): Promise<number> {
  const newTotal = await redis.zincrby(leaderboardKey(slug), 1, entry.winnerId);
  await redis.lpush(historyKey(slug), entry);
  await refreshCrewTtl(slug);
  return newTotal;
}

/**
 * Full crew standings, highest wins first. Joins the ZSET scores against the
 * roster for display names; members with no recorded win are included at 0.
 */
export async function getLeaderboard(slug: string): Promise<LeaderboardEntry[]> {
  const crew = await getCrew(slug);
  if (!crew) return [];

  // [member, score, member, score, ...] — rev:true gives highest first.
  const flat = await redis.zrange<(string | number)[]>(leaderboardKey(slug), 0, -1, {
    rev: true,
    withScores: true,
  });

  const wins = new Map<string, number>();
  for (let i = 0; i < flat.length; i += 2) {
    wins.set(String(flat[i]), Number(flat[i + 1]));
  }

  const entries: LeaderboardEntry[] = Object.entries(crew.members).map(([memberId, m]) => ({
    memberId,
    name: m.name,
    wins: wins.get(memberId) ?? 0,
  }));

  entries.sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
  await refreshCrewTtl(slug);
  return entries;
}

/**
 * Lightweight brute-force guard on PIN entry, keyed per crew + name. Returns
 * false once attempts exceed the cap within the window; the caller should then
 * reject without checking the PIN. Counts reset after PIN_WINDOW seconds.
 */
const PIN_MAX_ATTEMPTS = 10;
const PIN_WINDOW = 60 * 10; // 10 minutes

export async function registerPinAttempt(slug: string, nameKey: string): Promise<boolean> {
  const key = `crew:${slug}:pinattempts:${nameKey}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) {
    await redis.expire(key, PIN_WINDOW);
  }
  return attempts <= PIN_MAX_ATTEMPTS;
}

/** Clear the attempt counter after a successful PIN verification. */
export async function clearPinAttempts(slug: string, nameKey: string): Promise<void> {
  await redis.del(`crew:${slug}:pinattempts:${nameKey}`);
}
