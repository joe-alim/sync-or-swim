import { GameMeta } from '../types';

export const smokeSignalsMeta: GameMeta = {
  slug: 'smoke-signals',
  title: 'Smoke Signals',
  description: 'Send your message through the campfire smoke and outlast the circle. A campfire-themed take inspired by Love Letter.',
  status: 'live',
  mascot: 'doe',
  // On-theme engraved display face for the hub title (the in-game UI already
  // uses Cinzel — see app/globals.css).
  titleClassName: 'font-[family-name:var(--font-cinzel)] tracking-wide',
  accent: {
    glow: 'hover:border-slate-400/70 hover:shadow-slate-500/20',
    button: 'bg-red-600 hover:bg-red-500 text-white',
  },
};
