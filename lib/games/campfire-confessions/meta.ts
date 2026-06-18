import { GameMeta } from '../types';

export const campfireConfessionsMeta: GameMeta = {
  slug: 'campfire-confessions',
  title: 'Campfire Confessions',
  description: 'Everyone owns up to an anonymous confession. Read them by the fire — then guess who fessed up.',
  status: 'coming-soon',
  mascot: 'owl',
  players: { min: 3, max: 10 },
  accent: {
    glow: 'hover:border-amber-400/70 hover:shadow-amber-500/20',
    button: 'bg-amber-400 hover:bg-amber-300 text-stone-900',
  },
};
