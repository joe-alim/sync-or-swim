import Image from 'next/image';
import { CardDef } from '@/lib/games/smoke-signals/cards';

// A single Smoke Signals playing card: a raster animal portrait (when available)
// under SVG/CSS "chrome" — value badge, name banner, effect box, and a campfire
// glow. The number and name are rendered as crisp text on top of the art so they
// stay sharp at any size (see lib/games/smoke-signals/REQUIREMENTS.md §6.1).
//
// Until a card's portrait exists (`artReady`), a styled placeholder stands in, so
// the UI renders cleanly before the generated art lands.

export function SmokeSignalsCard({
  card,
  faceDown = false,
  showEffect = true,
  className = '',
}: {
  card: CardDef;
  faceDown?: boolean;
  showEffect?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        'relative aspect-[5/7] overflow-hidden rounded-2xl select-none',
        'border border-red-800/50 ring-1 ring-stone-950/60 shadow-xl',
        'bg-stone-900',
        className,
      ].join(' ')}
      role="img"
      aria-label={faceDown ? 'Smoke Signals card, face down' : `${card.name} (value ${card.value})`}
    >
      {faceDown ? (
        <CardBack />
      ) : (
        <>
          {/* Portrait (or placeholder) */}
          <div className="absolute inset-0">
            {card.artReady ? (
              <Image
                src={card.art}
                alt=""
                fill
                sizes="(max-width: 640px) 40vw, 220px"
                className="object-cover"
              />
            ) : (
              <PortraitPlaceholder animal={card.animal} />
            )}
          </div>

          {/* Top scrim for value legibility + campfire glow rising from the base */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-stone-950/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-stone-950 via-stone-950/80 to-transparent" />
          <div className="pointer-events-none absolute -bottom-10 left-1/2 h-28 w-40 -translate-x-1/2 rounded-full bg-red-600/25 blur-2xl" />

          {/* Value badge (top-left) — translucent glass disc with an engraved
              serif numeral, kept subtle so it sits over the art rather than fighting it */}
          <div className="absolute left-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-stone-950/30 ring-1 ring-red-300/40 backdrop-blur-[2px]">
            <span className="font-[family-name:var(--font-cinzel)] text-xl font-semibold leading-none text-red-50 [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
              {card.value}
            </span>
          </div>

          {/* Name + animal + effect (bottom) */}
          <div className="absolute inset-x-0 bottom-0 p-3">
            <h3 className="text-center font-[family-name:var(--font-cinzel)] text-lg font-semibold leading-tight tracking-wide text-stone-50 drop-shadow">
              {card.name}
            </h3>
            <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-red-300/90">
              {card.animal}
            </p>
            {showEffect && (
              <p className="mt-1.5 text-center text-[11px] leading-snug text-stone-300">
                {card.effect}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Stand-in shown until the real portrait is generated: a warm firelit gradient
// with the animal name, so each card is still distinguishable.
function PortraitPlaceholder({ animal }: { animal: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-stone-800 via-stone-900 to-red-950">
      <div className="px-2 text-center">
        <div className="text-2xl font-black uppercase tracking-widest text-stone-100/15">
          {animal}
        </div>
        <div className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-red-300/30">
          portrait coming
        </div>
      </div>
    </div>
  );
}

// Shared card back — a woodland royal crest by firelight (placeholder until the
// `card-back` art lands; see ART-PROMPTS.md §5).
function CardBack() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-900 via-stone-950 to-teal-950">
      <div className="flex flex-col items-center gap-2 text-red-300/70">
        <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
          {/* simple crossed quill + flame mark */}
          <path d="M20 6 C 23 12 23 16 20 20 C 17 16 17 12 20 6 Z" fill="currentColor" opacity="0.8" />
          <path d="M10 30 L 30 14 M 30 30 L 10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <circle cx="20" cy="30" r="3" fill="currentColor" />
        </svg>
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-red-300/40">
          Smoke Signals
        </span>
      </div>
    </div>
  );
}
