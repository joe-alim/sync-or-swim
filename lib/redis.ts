import { Redis } from '@upstash/redis';
import { GameState } from './types';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const GAME_TTL = 60 * 60 * 24; // 24 hours

export async function getGame(id: string): Promise<GameState | null> {
  return redis.get<GameState>(`game:${id}`);
}

export async function saveGame(state: GameState): Promise<void> {
  await redis.set(`game:${state.id}`, state, { ex: GAME_TTL });
}
