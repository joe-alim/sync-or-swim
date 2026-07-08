import { RulesModal, RuleSection } from './RulesModal';

// How-to-play summary for Campfire Bluff, grounded in the engine (see
// lib/games/campfire-bluff/logic.ts: truth-finders +2, a bluff's author +1
// per player fooled, 8 rounds, highest score wins).
export function CampfireBluffRules({ onClose }: { onClose: () => void }) {
  const accent = 'text-purple-300';
  return (
    <RulesModal
      title="How to play"
      subtitle="A true fact loses its answer. Bluff convincingly, then sniff out the truth."
      onClose={onClose}
    >
      <div className="space-y-5 text-sm leading-relaxed text-stone-300">
        <RuleSection title="🎯 Goal" accent={accent}>
          <p>
            Fool the table with a believable fake answer, and find the real one hiding among
            everyone else&apos;s bluffs. Highest score after 8 rounds wins (ties share the crown).
          </p>
        </RuleSection>

        <RuleSection title="🔥 Each round" accent={accent}>
          <ol className="list-decimal space-y-1 pl-5">
            <li>A true, surprising trivia prompt appears — the real answer stays hidden.</li>
            <li>Everyone secretly writes one fake answer meant to pass as true.</li>
            <li>All the bluffs plus the real answer are shuffled together anonymously.</li>
            <li>Everyone votes for the one they believe is true (you can&apos;t vote your own).</li>
            <li>The truth is revealed along with who wrote what and who voted for what.</li>
          </ol>
        </RuleSection>

        <RuleSection title="🏆 Scoring" accent={accent}>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Find the truth → <span className="font-semibold text-purple-300">+2</span> for you.
            </li>
            <li>
              Wrote a bluff → <span className="font-semibold text-purple-300">+1</span> for every
              player who fell for it.
            </li>
          </ul>
        </RuleSection>
      </div>
    </RulesModal>
  );
}
