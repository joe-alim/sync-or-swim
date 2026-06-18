import { SmokeSignalsCard } from '@/components/SmokeSignalsCard';
import { CARDS, CARD_ORDER } from '@/lib/games/smoke-signals/cards';

// Dev-only visual harness for the Smoke Signals card design. Renders every card
// (real portrait where `artReady`, placeholder otherwise) plus a card back, so we
// can eyeball the chrome + art as portraits land. Not linked from the hub.
export default function SmokeSignalsPreview() {
  return (
    <main className="min-h-screen bg-stone-950 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-1 text-3xl font-extrabold text-stone-50">Smoke Signals — card preview</h1>
        <p className="mb-8 text-sm text-stone-400">
          {CARD_ORDER.filter((id) => CARDS[id].artReady).length}/{CARD_ORDER.length} portraits in.
          Cards without art show a placeholder.
        </p>

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {CARD_ORDER.map((id) => (
            <SmokeSignalsCard key={id} card={CARDS[id]} className="w-full" />
          ))}
          <SmokeSignalsCard card={CARDS.princess} faceDown className="w-full" />
        </div>
      </div>
    </main>
  );
}
