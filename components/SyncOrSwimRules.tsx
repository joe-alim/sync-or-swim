import { RulesModal, RuleSection } from './RulesModal';

// How-to-play summary for Sync or Swim, grounded in the engine
// (see lib/games/sync-or-swim/logic.ts: 2 matchers → 3 pts, 3+ → 1 pt, first to 25).
export function SyncOrSwimRules({ onClose }: { onClose: () => void }) {
  const accent = 'text-sky-300';
  return (
    <RulesModal
      title="How to play"
      subtitle="Think alike — match your crew’s answers and ride the wave to 25"
      onClose={onClose}
    >
      <div className="space-y-5 text-sm leading-relaxed text-stone-300">
        <RuleSection title="🎯 Goal" accent={accent}>
          <p>
            Match the answers your teammates give to the same prompt. The first player to reach{' '}
            <span className="font-semibold text-stone-100">25 points</span> wins.
          </p>
        </RuleSection>

        <RuleSection title="🐟 Each round" accent={accent}>
          <ol className="list-decimal space-y-1 pl-5">
            <li>A prompt card is flipped for everyone to see.</li>
            <li>Secretly write the one short answer you think others will also write.</li>
            <li>When everyone’s in, all answers are revealed and grouped.</li>
          </ol>
        </RuleSection>

        <RuleSection title="🌊 Scoring" accent={accent}>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-semibold text-stone-100">Exactly two</span> players match →{' '}
              <span className="font-semibold text-sky-300">3 points</span> each.
            </li>
            <li>
              <span className="font-semibold text-stone-100">Three or more</span> match →{' '}
              <span className="font-semibold text-sky-300">1 point</span> each.
            </li>
            <li>A unique answer that no one else wrote scores nothing.</li>
          </ul>
          <p className="mt-2 text-stone-400">
            The trick: a perfect pair beats a big crowd. Aim to think like exactly one other person.
          </p>
        </RuleSection>

        <RuleSection title="🏁 Winning" accent={accent}>
          <p>Keep playing rounds until someone crosses 25 points — they win the day.</p>
        </RuleSection>
      </div>

      <p className="mt-5 border-t border-stone-800 pt-3 text-xs text-stone-500">
        Inspired by Blank Slate.
      </p>
    </RulesModal>
  );
}
