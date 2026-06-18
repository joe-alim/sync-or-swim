import { CardId, CARDS, CARD_ORDER } from '@/lib/games/smoke-signals/cards';
import { SmokeSignalsCard } from '@/components/SmokeSignalsCard';
import { RulesModal } from './RulesModal';

// Deck reference, with copy counts. `version` shows a single deck (in-game);
// `'all'` shows every character, sectioned by player count (lobby / hub preview).
export function SmokeSignalsCardReference({
  version,
  onClose,
}: {
  version: 'regular' | 'premium' | 'all';
  onClose: () => void;
}) {
  // A tile is one card face plus its badge: `×N` for a full copy count, or
  // `+N` for the extra copies premium adds on top of the regular deck.
  type Tile = { id: CardId; badge: string };

  // Cards premium adds beyond regular: brand-new characters (badge ×copies) and
  // existing characters that gain copies, e.g. Guard 5→8 (badge +delta).
  const premiumAdds: Tile[] = CARD_ORDER.flatMap((id) => {
    const c = CARDS[id];
    if (c.regular === 0 && c.premium > 0) return [{ id, badge: `×${c.premium}` }];
    if (c.premium > c.regular) return [{ id, badge: `+${c.premium - c.regular}` }];
    return [];
  });

  const sections: { title: string; note: string; tiles: Tile[] }[] =
    version === 'all'
      ? [
          {
            title: '2–4 players · Regular deck',
            note: '16 cards',
            tiles: CARD_ORDER.filter((id) => CARDS[id].regular > 0).map((id) => ({
              id,
              badge: `×${CARDS[id].regular}`,
            })),
          },
          {
            title: '5–8 players · Premium adds',
            note: 'on top of the regular deck',
            tiles: premiumAdds,
          },
        ]
      : [
          {
            title: version === 'regular' ? 'Regular deck' : 'Premium deck',
            note: `${CARD_ORDER.filter((id) => CARDS[id][version] > 0).length} characters`,
            tiles: CARD_ORDER.filter((id) => CARDS[id][version] > 0).map((id) => ({
              id,
              badge: `×${CARDS[id][version]}`,
            })),
          },
        ];

  return (
    <RulesModal title="Card reference" onClose={onClose} maxWidth="max-w-5xl">
      {sections.map((section) => (
        <div key={section.title} className="mb-6 last:mb-0">
          <div className="mb-3 flex items-baseline gap-2 border-b border-stone-700/70 pb-1.5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-red-300">{section.title}</h3>
            <span className="text-xs text-stone-400">{section.note}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {section.tiles.map(({ id, badge }) => (
              <div key={id} className="relative">
                <SmokeSignalsCard card={CARDS[id]} className="w-full" />
                <span className="absolute right-1.5 top-1.5 rounded-full bg-stone-950/70 px-2 py-0.5 text-[10px] font-bold text-red-300 ring-1 ring-red-300/30">
                  {badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </RulesModal>
  );
}
