// Static card definitions for Smoke Signals — a campfire-themed reskin of Love
// Letter Premium. One entry per character; values, copy-counts, and effects
// mirror the rulebook (see ./REQUIREMENTS.md §6). Character names are kept
// identical to Love Letter; the `animal` is the campfire-themed portrait subject
// (see ./ART-PROMPTS.md). Card art is raster — until the portraits land,
// `artReady` stays false and <SmokeSignalsCard> renders a styled placeholder.

export type CardId =
  | 'assassin'
  | 'jester'
  | 'guard'
  | 'priest'
  | 'cardinal'
  | 'baron'
  | 'baroness'
  | 'handmaid'
  | 'sycophant'
  | 'prince'
  | 'count'
  | 'king'
  | 'constable'
  | 'countess'
  | 'dowager-queen'
  | 'princess'
  | 'bishop';

export interface CardDef {
  id: CardId;
  /** Strength — higher is closer to the Princess. */
  value: number;
  /** Character name, kept identical to Love Letter. */
  name: string;
  /** Campfire-themed portrait subject. */
  animal: string;
  /** Proper name(s) from Love Letter, usable as flavor text. */
  flavor: string;
  /** Short effect text shown on the card face. */
  effect: string;
  /** Copies in the 16-card Regular (2–4 player) deck. */
  regular: number;
  /** Copies in the 32-card Premium (5–8 player) deck. */
  premium: number;
  /** Portrait path under /public. */
  art: string;
  /** Flip true once the raster portrait exists at `art`. */
  artReady: boolean;
}

const art = (id: CardId): string => `/games/smoke-signals/cards/${id}.webp`;

export const CARDS: Record<CardId, CardDef> = {
  assassin: {
    id: 'assassin', value: 0, name: 'Assassin', animal: 'Skunk', flavor: 'the Assassin',
    effect: 'If a Guard targets you while you hold this, the Guard’s player is out instead. Then discard this and draw.',
    regular: 0, premium: 1, art: art('assassin'), artReady: true,
  },
  jester: {
    id: 'jester', value: 0, name: 'Jester', animal: 'Raccoon', flavor: 'Jester Darius',
    effect: 'Pick a player. If they win this round, you also gain a token.',
    regular: 0, premium: 1, art: art('jester'), artReady: true,
  },
  guard: {
    id: 'guard', value: 1, name: 'Guard', animal: 'Badger', flavor: 'Guard Odette & Guard Dougaul',
    effect: 'Pick a player and name a number (not 1). If they hold a card of that number, they’re out.',
    regular: 5, premium: 8, art: art('guard'), artReady: true,
  },
  priest: {
    id: 'priest', value: 2, name: 'Priest', animal: 'Owl', flavor: 'Priest Tomas',
    effect: 'Privately look at another player’s hand.',
    regular: 2, premium: 2, art: art('priest'), artReady: true,
  },
  cardinal: {
    id: 'cardinal', value: 2, name: 'Cardinal', animal: 'Bluejay', flavor: 'Cardinal Vesper',
    effect: 'Pick exactly 2 players to swap hands, then privately look at one of them.',
    regular: 0, premium: 2, art: art('cardinal'), artReady: true,
  },
  baron: {
    id: 'baron', value: 3, name: 'Baron', animal: 'Ram', flavor: 'Baron Talus',
    effect: 'Secretly compare hands with a player; the lower value is out.',
    regular: 2, premium: 2, art: art('baron'), artReady: true,
  },
  baroness: {
    id: 'baroness', value: 3, name: 'Baroness', animal: 'Lynx', flavor: 'Baroness Fiona',
    effect: 'Privately look at the hands of 1 or 2 other players.',
    regular: 0, premium: 2, art: art('baroness'), artReady: true,
  },
  handmaid: {
    id: 'handmaid', value: 4, name: 'Handmaid', animal: 'Hedgehog', flavor: 'Handmaid Susannah',
    effect: 'You are immune to all other players’ effects until your next turn.',
    regular: 2, premium: 2, art: art('handmaid'), artReady: true,
  },
  sycophant: {
    id: 'sycophant', value: 4, name: 'Sycophant', animal: 'Chipmunk', flavor: 'Sycophant Morris',
    effect: 'Pick a player; the next card played that targets someone must include them.',
    regular: 0, premium: 2, art: art('sycophant'), artReady: true,
  },
  prince: {
    id: 'prince', value: 5, name: 'Prince', animal: 'Beaver', flavor: 'Prince Arnaud',
    effect: 'Pick any player to discard their hand and draw a new card.',
    regular: 2, premium: 2, art: art('prince'), artReady: true,
  },
  count: {
    id: 'count', value: 5, name: 'Count', animal: 'Tortoise', flavor: 'Count Guntram',
    effect: 'At round end, add 1 to your hand’s value for each Count in your discard pile.',
    regular: 0, premium: 2, art: art('count'), artReady: true,
  },
  king: {
    id: 'king', value: 6, name: 'King', animal: 'Moose', flavor: 'King Arnaud IV',
    effect: 'Trade hands with another player.',
    regular: 1, premium: 1, art: art('king'), artReady: true,
  },
  constable: {
    id: 'constable', value: 6, name: 'Constable', animal: 'Wolf', flavor: 'Constable Viktor',
    effect: 'If you are knocked out while this is in your discard pile, gain a token.',
    regular: 0, premium: 1, art: art('constable'), artReady: true,
  },
  countess: {
    id: 'countess', value: 7, name: 'Countess', animal: 'Fox', flavor: 'Countess Wilhelmina',
    effect: 'You must discard this if you also hold the King or Prince.',
    regular: 1, premium: 1, art: art('countess'), artReady: true,
  },
  'dowager-queen': {
    id: 'dowager-queen', value: 7, name: 'Dowager Queen', animal: 'Swan', flavor: 'Dowager Queen Tummia',
    effect: 'Secretly compare hands with a player; the higher value is out.',
    regular: 0, premium: 1, art: art('dowager-queen'), artReady: true,
  },
  princess: {
    id: 'princess', value: 8, name: 'Princess', animal: 'Doe', flavor: 'Princess Annette',
    effect: 'If you play or discard this for any reason, you are out of the round.',
    regular: 1, premium: 1, art: art('princess'), artReady: true,
  },
  bishop: {
    id: 'bishop', value: 9, name: 'Bishop', animal: 'Heron', flavor: 'Bishop Vinizio',
    effect: 'Name a player and a number. If correct, gain a token; they may then redraw. (Princess still beats the Bishop.)',
    regular: 0, premium: 1, art: art('bishop'), artReady: true,
  },
};

/** All card ids in ascending value order (the deck/reference display order). */
export const CARD_ORDER: CardId[] = [
  'assassin', 'jester', 'guard', 'priest', 'cardinal', 'baron', 'baroness',
  'handmaid', 'sycophant', 'prince', 'count', 'king', 'constable', 'countess',
  'dowager-queen', 'princess', 'bishop',
];

export type SmokeSignalsVersion = 'regular' | 'premium';

/**
 * Build the unshuffled list of card ids for a version, honoring per-card copy
 * counts. The engine shuffles the result. Regular = 16 cards, Premium = 32.
 */
export function deckFor(version: SmokeSignalsVersion): CardId[] {
  const countKey = version === 'regular' ? 'regular' : 'premium';
  const deck: CardId[] = [];
  for (const id of CARD_ORDER) {
    for (let i = 0; i < CARDS[id][countKey]; i++) deck.push(id);
  }
  return deck;
}
