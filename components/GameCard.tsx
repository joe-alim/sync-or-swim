import { GameMeta } from '@/lib/games/types';
import { Mascot } from './Mascots';
import { ComingSoonBadge } from './ComingSoonBadge';

// A single game tile on the Foxflame hub. Live games render their action
// controls (passed as children); coming-soon games are dimmed, non-interactive,
// and wear the Coming Soon ribbon.
export function GameCard({
  meta,
  headerActions,
  children,
}: {
  meta: GameMeta;
  /** Small controls pinned to the card's top-right (e.g. preview buttons). */
  headerActions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const comingSoon = meta.status === 'coming-soon';

  return (
    <div
      aria-disabled={comingSoon}
      className={[
        'relative overflow-hidden rounded-3xl border bg-stone-900/70 backdrop-blur p-6 text-left transition-all duration-200',
        'border-stone-700/80 shadow-xl',
        comingSoon
          ? 'opacity-60 grayscale-[35%] cursor-not-allowed'
          : `hover:-translate-y-1 hover:shadow-2xl ${meta.accent.glow}`,
      ].join(' ')}
    >
      {comingSoon && <ComingSoonBadge />}

      {headerActions && (
        <div className="absolute right-4 top-4 z-10 flex gap-1.5">{headerActions}</div>
      )}

      <div className={`flex items-center gap-4 mb-3 ${headerActions || comingSoon ? 'pr-20' : ''}`}>
        <div className="shrink-0 rounded-2xl bg-stone-800/80 p-2.5 ring-1 ring-stone-700">
          <Mascot kind={meta.mascot} />
        </div>
        <div>
          <h2 className={`text-2xl font-extrabold text-stone-50 leading-tight ${meta.titleClassName ?? ''}`}>{meta.title}</h2>
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-stone-700 bg-stone-800/80 px-2.5 py-0.5 text-xs font-medium text-stone-300">
            👥 {meta.players.min === meta.players.max
              ? `${meta.players.min} players`
              : `${meta.players.min}–${meta.players.max} players`}
          </span>
        </div>
      </div>

      <p className="text-stone-400 text-sm leading-relaxed mb-5 min-h-[2.5rem]">{meta.description}</p>

      {comingSoon ? (
        <div className="text-orange-300/80 text-sm font-semibold">Gathering kindling…</div>
      ) : (
        children
      )}
    </div>
  );
}
