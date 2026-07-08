import { GameMeta } from '../types';

export const campfireBluffMeta: GameMeta = {
  slug: 'campfire-bluff',
  title: 'Campfire Bluff',
  description: 'A true (weird) fact loses its answer. Write a convincing fake — then vote for the real one. Inspired by Fibbage.',
  status: 'live',
  mascot: 'skunk',
  players: { min: 3, max: 10 },
  accent: {
    glow: 'hover:border-purple-400/70 hover:shadow-purple-500/20',
    button: 'bg-purple-400 hover:bg-purple-300 text-stone-900',
  },
};
