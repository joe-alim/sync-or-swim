import { RulesModal, RuleSection } from './RulesModal';

// How-to-play summary for Smoke Signals, grounded in the engine
// (see lib/games/smoke-signals/logic.ts). Shown from the hub preview, the
// lobby, and the in-game header.
export function SmokeSignalsRules({
  version,
  playerCount,
  tokensToWin,
  onClose,
}: {
  version: 'regular' | 'premium';
  /** 0 when previewed from the hub (no active game) — highlights the 2-player row. */
  playerCount: number;
  tokensToWin?: number;
  onClose: () => void;
}) {
  // Mirrors tokensToWin() in logic.ts; used to highlight this table's active row.
  const target = tokensToWin ?? (playerCount <= 2 ? 7 : playerCount === 3 ? 5 : 4);
  const targets: { label: string; tokens: number; lo: number; hi: number }[] = [
    { label: '2 players', tokens: 7, lo: 2, hi: 2 },
    { label: '3 players', tokens: 5, lo: 3, hi: 3 },
    { label: '4–8 players', tokens: 4, lo: 4, hi: 8 },
  ];

  const cinzelRed = 'font-[family-name:var(--font-cinzel)] text-red-300';

  return (
    <RulesModal
      title="How to play"
      subtitle={`${version === 'regular' ? 'Regular' : 'Premium'} deck · send your message through the smoke and outlast the circle`}
      onClose={onClose}
    >
      <div className="space-y-5 text-sm leading-relaxed text-stone-300">
        <RuleSection title="🎯 Goal" accent={cinzelRed}>
          <p>
            Win rounds to collect <Token>♥</Token> tokens. The first player to reach the
            target wins the game:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {targets.map((t) => {
              const active = playerCount >= t.lo && playerCount <= t.hi
                ? true
                : playerCount === 0 && t.tokens === target;
              return (
                <span
                  key={t.label}
                  className={[
                    'rounded-lg px-2.5 py-1 text-xs font-semibold ring-1',
                    active
                      ? 'bg-red-600 text-white ring-red-400/60'
                      : 'bg-stone-800 text-stone-300 ring-stone-700',
                  ].join(' ')}
                >
                  {t.label}: {t.tokens} ♥
                </span>
              );
            })}
          </div>
        </RuleSection>

        <RuleSection title="🔥 On your turn" accent={cinzelRed}>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Draw the top card, so you’re holding two.</li>
            <li>Play one of the two and resolve its effect — some let you target an opponent, peek, compare hands, or guess a card.</li>
            <li>
              <span className="font-semibold text-stone-100">Countess rule:</span> you must play
              the Countess if your other card is the King or Prince.
            </li>
          </ol>
        </RuleSection>

        <RuleSection title="💨 Getting knocked out" accent={cinzelRed}>
          <ul className="list-disc space-y-1 pl-5">
            <li>Many cards can eliminate you for the round — e.g. losing a Baron comparison, or a Guard correctly naming your card.</li>
            <li>
              Playing or discarding the <span className="font-semibold text-stone-100">Princess</span> knocks
              you out instantly.
            </li>
            <li>Knocked-out players sit out until the next round.</li>
          </ul>
        </RuleSection>

        <RuleSection title="🌙 How a round ends" accent={cinzelRed}>
          <ul className="list-disc space-y-1 pl-5">
            <li>Everyone else is knocked out — the last player standing wins, <span className="italic">or</span></li>
            <li>The deck runs out: all survivors reveal, and the highest card value wins.</li>
            <li className="text-stone-400">Each Count in your discard adds +1 · the Princess beats the Bishop · ties go to the largest discard pile.</li>
          </ul>
        </RuleSection>

        <RuleSection title="♥ Earning tokens" accent={cinzelRed}>
          <ul className="list-disc space-y-1 pl-5">
            <li>Win a round → 1 token.</li>
            <li>Some characters grant bonus tokens: the Jester (if your pick wins), Bishop (a correct guess), Constable, and Assassin.</li>
          </ul>
        </RuleSection>

        <RuleSection title="🃏 The deck" accent={cinzelRed}>
          <ul className="list-disc space-y-1 pl-5">
            <li><span className="font-semibold text-stone-100">2–4 players:</span> Regular deck (16 cards). <span className="font-semibold text-stone-100">5–8 players:</span> Premium deck (32 cards, extra characters).</li>
            <li>Each round, one card is set aside face-down (and in 2-player Regular, three more are revealed face-up).</li>
          </ul>
        </RuleSection>
      </div>

      <p className="mt-5 border-t border-stone-800 pt-3 text-xs text-stone-500">
        Tap <span className="font-semibold text-stone-300">📖 Cards</span> for exactly what each character does.
      </p>
    </RulesModal>
  );
}

function Token({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-red-300">{children}</span>;
}
