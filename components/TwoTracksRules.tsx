import { RulesModal, RuleSection } from './RulesModal';

// How-to-play summary for Two Tracks and a Trick, grounded in the engine
// (see lib/games/two-tracks-and-a-trick/logic.ts: guesser +1 for catching the
// lie, author +1 per player fooled, one round per player, highest score wins).
export function TwoTracksRules({ onClose }: { onClose: () => void }) {
  const accent = 'text-orange-300';
  return (
    <RulesModal
      title="How to play"
      subtitle="Tell two true tracks and one convincing trick — then sniff out everyone else’s"
      onClose={onClose}
    >
      <div className="space-y-5 text-sm leading-relaxed text-stone-300">
        <RuleSection title="🎯 Goal" accent={accent}>
          <p>
            Fool the table with a believable lie, and catch the lies others tell. The highest score
            when everyone’s had a turn wins (ties share the crown).
          </p>
        </RuleSection>

        <RuleSection title="✍️ Setup" accent={accent}>
          <p>
            Each player writes three statements about themselves —{' '}
            <span className="font-semibold text-stone-100">two true “tracks”</span> and{' '}
            <span className="font-semibold text-stone-100">one convincing “trick”</span> (the lie).
          </p>
        </RuleSection>

        <RuleSection title="🦊 Each round" accent={accent}>
          <ol className="list-decimal space-y-1 pl-5">
            <li>One player is the subject — their three statements are shown to everyone.</li>
            <li>Everyone else secretly guesses which statement is the trick.</li>
            <li>The lie is revealed and points are scored.</li>
            <li>Play continues until every player has been the subject once.</li>
          </ol>
        </RuleSection>

        <RuleSection title="🏆 Scoring" accent={accent}>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Spot the trick → <span className="font-semibold text-orange-300">+1</span> for you.
            </li>
            <li>
              As the subject → <span className="font-semibold text-orange-300">+1</span> for every
              player you fooled (a wrong guess, or no guess at all).
            </li>
          </ul>
        </RuleSection>
      </div>
    </RulesModal>
  );
}
