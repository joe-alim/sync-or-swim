// Shared overlay shell for rules / reference modals across the Foxflame suite.
// One backdrop-blur scrim, click-outside-to-close, and a titled panel with a
// close button. Each game supplies its own themed content as children.
export function RulesModal({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = 'max-w-2xl',
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind max-width for the panel; wider for card galleries. */
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`mx-auto ${maxWidth} rounded-2xl border border-stone-700 bg-stone-900 p-5 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">{title}</h2>
            {subtitle && <p className="text-xs text-stone-400">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg bg-stone-800 px-3 py-1.5 text-sm font-semibold text-stone-200 hover:bg-stone-700"
          >
            ✕ Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// A single labelled rules section. `accent` is the full className for the
// heading so each game can bring its own colour (and font, e.g. Cinzel).
export function RuleSection({
  title,
  accent = 'text-orange-300',
  children,
}: {
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className={`mb-1.5 text-base font-semibold tracking-wide ${accent}`}>{title}</h3>
      {children}
    </section>
  );
}
