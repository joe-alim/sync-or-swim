// Cartoon animal mascots for the Foxflame game cards. Each is a small, lightly
// animated SVG. Add a new mascot here and reference it from a game's meta.

import { GameMeta } from '@/lib/games/types';

export function Mascot({ kind, className = '' }: { kind: GameMeta['mascot']; className?: string }) {
  if (kind === 'fox') return <FoxMascot className={className} />;
  if (kind === 'owl') return <OwlMascot className={className} />;
  if (kind === 'bear') return <BearMascot className={className} />;
  if (kind === 'doe') return <DoeMascot className={className} />;
  if (kind === 'skunk') return <SkunkMascot className={className} />;
  return <FishMascot className={className} />;
}

// The Smoke Signals mascot: the flower-crowned Doe Princess (the deck's value-8
// card — see lib/games/smoke-signals/cards.ts) cropped to her head so the hub
// tile previews the game's actual art instead of a generic animal. The portrait
// is the same raster used on the Princess card; backgroundSize zooms in and
// backgroundPosition frames her head (ears/crown down to the chin), which stays
// predictable regardless of the global img sizing. Slow bob matches the others.
export function DoeMascot({ className = '' }: { className?: string }) {
  return (
    <div className={`h-[72px] w-16 overflow-hidden rounded-xl ${className}`} aria-hidden="true">
      <style>{`
        @keyframes doeBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2.5px); } }
        .doe-art { animation: doeBob 3.4s ease-in-out infinite; }
      `}</style>
      <div
        className="doe-art h-full w-full bg-no-repeat"
        style={{
          backgroundImage: 'url(/games/smoke-signals/cards/princess.webp)',
          backgroundSize: '135% auto',
          backgroundPosition: '50% 12%',
        }}
      />
    </div>
  );
}

// The Smoke Signals mascot: the hooded Assassin's animal — a skunk (the deck's
// value-0 card; see lib/games/smoke-signals/cards.ts). A 3/4-turned head in flat
// SVG matching the others, but in the game's cooler slate palette rather than the
// warm browns/oranges: pure-black fur vanishes on the dark hub, so the fur is a
// lighter slate with a soft light rim (the skRim filter) to keep the silhouette
// readable. Simple round eyes like the fox/owl, the signature white blaze (kept
// clear of the nose), and blurred, curling smoke wisps rising behind the head —
// the "smoke signals." Slow bob + blink + smoke-drift in the shared style.
export function SkunkMascot({ className = '' }: { className?: string }) {
  return (
    <svg width="72" height="80" viewBox="17 4 50 56" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <filter id="skRim" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.1" floodColor="#aeb6c4" floodOpacity="0.55" />
        </filter>
        <filter id="skSmokeBlur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.9" />
        </filter>
      </defs>
      <style>{`
        @keyframes skBob   { 0%,100% { transform: translateY(0) rotate(-1.5deg); } 50% { transform: translateY(-2.5px) rotate(1.5deg); } }
        @keyframes skBlink { 0%,93%,100% { transform: scaleY(1); } 96.5% { transform: scaleY(0.12); } }
        @keyframes skSmoke { 0%,100% { transform: translateY(3px); opacity: 0.10; } 50% { transform: translateY(-7px); opacity: 0.38; } }
        .sk-fig { animation: skBob 3.4s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 88%; }
        .sk-eye { animation: skBlink 4.6s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 50%; }
        .sk-s1  { animation: skSmoke 5.6s ease-in-out infinite;      transform-box: fill-box; transform-origin: 50% 100%; }
        .sk-s2  { animation: skSmoke 6.6s ease-in-out 1.3s infinite; transform-box: fill-box; transform-origin: 50% 100%; }
        .sk-s3  { animation: skSmoke 6.0s ease-in-out 2.6s infinite; transform-box: fill-box; transform-origin: 50% 100%; }
      `}</style>

      {/* Puffy, curling smoke wisps rising behind the head */}
      <g filter="url(#skSmokeBlur)" fill="#cbd5e1" stroke="#cbd5e1" strokeLinecap="round" strokeLinejoin="round">
        <g className="sk-s2">
          <path fill="none" strokeWidth="3.2" d="M 23 56 C 18 49 27 44 22 36 C 18 30 25 26 21 20 C 19.5 16.5 23.5 13.5 25.5 16.5 C 27 18.8 23.8 20.5 22.6 18" />
          <circle cx="22.5" cy="48" r="3.1" /><circle cx="23" cy="34" r="2.5" />
        </g>
        <g className="sk-s1">
          <path fill="none" strokeWidth="3.6" d="M 42 58 C 36 50 47 45 41 36 C 36 29 46 24 41 15 C 38.5 10.5 43 6 45.5 9.5 C 47.5 12.4 43.6 14.4 42 11.6" />
          <circle cx="42" cy="42" r="3.4" /><circle cx="42" cy="27" r="2.7" />
        </g>
        <g className="sk-s3">
          <path fill="none" strokeWidth="3.2" d="M 61 56 C 66 49 57 44 62 36 C 66 30 59 26 63 20 C 64.5 16.5 60.5 13.5 58.5 16.5 C 57 18.8 60.2 20.5 61.4 18" />
          <circle cx="61.5" cy="48" r="3.1" /><circle cx="61" cy="34" r="2.5" />
        </g>
      </g>

      <g className="sk-fig" filter="url(#skRim)">
        {/* Rounded ears (near ear larger; far ear smaller for the 3/4 turn) */}
        <path d="M 29 26 C 26 15 31 9 37 11 C 42 12.5 43 17 42.5 23 C 38 21 33 21.5 29 26 Z" fill="#3a414f" />
        <path d="M 49 23 C 48 14 53 10 58 12 C 63 14 63 20 60 25 C 56 21 52 21 49 23 Z" fill="#343b48" />
        <path d="M 32 22.5 C 30 16.5 34 13.5 38 15.5 C 40 16.8 40.3 19.5 39.5 22 C 37 20.5 34 20.5 32 22.5 Z" fill="#525d6f" />
        <path d="M 53 21 C 52 16 55 14 58 16 C 60 17 60 20 59 22 C 57 20.5 55 20.5 53 21 Z" fill="#3f4858" />

        {/* Rounder head with a short muzzle, turned 3/4 to the left */}
        <path d="M 46 18 C 34 18 27 26 26.5 37 C 26.3 41 24.5 44 23 47 C 25.5 49.5 29 49 31.5 47 C 34.8 53.5 40.5 57 46.5 57 C 57 57 64 48 64 37.5 C 64 26.5 57 18.5 46 18 Z" fill="#3a414f" />

        {/* White blaze sweeping forehead -> bridge, stopping short of the nose */}
        <path d="M 44.5 20 C 47 20 45.8 25 43.8 30 C 41.3 36 38 40.5 34.5 43 C 33.3 43.8 32 44 31.4 43.4 C 32.2 42.2 34 40.3 36 36.8 C 38.8 32 40.7 26.5 41.6 23 C 42.1 21 42.8 20 44.5 20 Z" fill="#f1f1ec" />

        {/* Simple round eyes (fox/owl style) */}
        <g className="sk-eye">
          <circle cx="36" cy="34" r="3.4" fill="#15181f" />
          <circle cx="51" cy="32.5" r="3" fill="#15181f" />
          <circle cx="34.9" cy="32.8" r="1.05" fill="#fff" />
          <circle cx="50" cy="31.4" r="0.95" fill="#fff" />
        </g>

        {/* Nose at the muzzle tip */}
        <ellipse cx="24.8" cy="47.3" rx="2.6" ry="2.1" fill="#15181f" />
      </g>
    </svg>
  );
}

export function FishMascot({ className = '' }: { className?: string }) {
  return (
    <svg width="84" height="64" viewBox="0 0 84 64" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <style>{`
        @keyframes fishBob { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-3px) rotate(-2deg); } }
        @keyframes fishTail { 0%,100% { transform: rotate(-10deg); } 50% { transform: rotate(10deg); } }
        .fm-body { animation: fishBob 2.4s ease-in-out infinite; }
        .fm-tail { animation: fishTail 0.5s ease-in-out infinite; transform-box: fill-box; transform-origin: 0% 50%; }
      `}</style>
      <g className="fm-body">
        <polygon className="fm-tail" points="60,32 78,20 78,44" fill="#0ea5e9" />
        <ellipse cx="38" cy="32" rx="30" ry="19" fill="#38bdf8" />
        <path d="M 30 14 Q 40 5 50 14" fill="#0ea5e9" />
        <circle cx="22" cy="27" r="6" fill="white" />
        <circle cx="20.5" cy="27" r="3" fill="#0f172a" />
        <circle cx="19.5" cy="25.5" r="1" fill="white" />
        <path d="M 27 40 Q 38 47 49 40" stroke="#075985" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function FoxMascot({ className = '' }: { className?: string }) {
  return (
    <svg width="80" height="72" viewBox="0 0 80 72" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <style>{`
        @keyframes foxTilt { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
        @keyframes foxWink { 0%,92%,100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
        .fx-head { animation: foxTilt 3s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 80%; }
        .fx-eye  { animation: foxWink 4s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 50%; }
      `}</style>
      <g className="fx-head">
        {/* Ears */}
        <polygon points="14,8 30,26 8,30" fill="#ea580c" />
        <polygon points="66,8 72,30 50,26" fill="#ea580c" />
        <polygon points="17,14 27,25 13,27" fill="#7c2d12" />
        <polygon points="63,14 67,27 53,25" fill="#7c2d12" />
        {/* Face top */}
        <path d="M 12 28 Q 40 14 68 28 L 60 50 Q 40 60 20 50 Z" fill="#f97316" />
        {/* White muzzle */}
        <path d="M 26 42 Q 40 38 54 42 L 46 62 Q 40 66 34 62 Z" fill="#fff7ed" />
        {/* Eyes */}
        <g className="fx-eye">
          <circle cx="29" cy="38" r="4.5" fill="#1c1917" />
          <circle cx="51" cy="38" r="4.5" fill="#1c1917" />
          <circle cx="27.5" cy="36.5" r="1.3" fill="white" />
          <circle cx="49.5" cy="36.5" r="1.3" fill="white" />
        </g>
        {/* Nose */}
        <path d="M 40 52 l -5 -5 h 10 Z" fill="#1c1917" />
      </g>
    </svg>
  );
}

// A warm brown bear head with a Smokey-the-Bear tan ranger hat: the head of the
// bear from the hub's campfire scene (see Campfire.tsx — the "BEAR (far left)"
// group), kept at the exact same geometry/colors so it matches the header image
// (the header bear stays bare). Smoke Signals now uses the Doe Princess portrait
// instead (see DoeMascot above); this stays available for future game cards.
// Slow head-bob + occasional blink in the shared inline-animation style.
export function BearMascot({ className = '' }: { className?: string }) {
  return (
    <svg width="62" height="74" viewBox="33 -8 58 70" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <style>{`
        @keyframes bearBob  { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-2.5px) rotate(2deg); } }
        @keyframes bearBlink { 0%,91%,100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
        .be-head { animation: bearBob 3.4s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 90%; }
        .be-eye  { animation: bearBlink 4.6s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 50%; }
      `}</style>
      <g className="be-head">
        {/* Head */}
        <circle cx="62" cy="34" r="24" fill="#6b4f3a" />
        {/* Ears */}
        <circle cx="48" cy="14" r="9" fill="#6b4f3a" />
        <circle cx="76" cy="14" r="9" fill="#6b4f3a" />
        <circle cx="48" cy="14" r="4" fill="#8a6a4f" />
        <circle cx="76" cy="14" r="4" fill="#8a6a4f" />
        {/* Muzzle + nose */}
        <ellipse cx="66" cy="42" rx="13" ry="10" fill="#cbb291" />
        <circle cx="74" cy="40" r="3.2" fill="#1c1917" />
        {/* Eyes */}
        <g className="be-eye">
          <circle cx="55" cy="30" r="3" fill="#1c1917" />
          <circle cx="69" cy="30" r="3" fill="#1c1917" />
        </g>
        {/* Smokey ranger hat: Montana-peak crown + wide flat brim, across the
            forehead so the ears flank it */}
        <ellipse cx="62" cy="16" rx="29" ry="7" fill="#b07f30" />
        <ellipse cx="62" cy="15" rx="29" ry="6" fill="#cf9d4e" />
        <path d="M 49 15 Q 51 -3 62 -4 Q 73 -3 75 15 Z" fill="#cf9d4e" />
        {/* peak creases */}
        <path d="M 62 -4 L 58 14 M 62 -4 L 66 14 M 62 -4 L 62 14" stroke="#b07f30" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        {/* hat band */}
        <path d="M 49 13 Q 62 18 75 13 L 75 16 Q 62 21 49 16 Z" fill="#6f4e1f" />
      </g>
    </svg>
  );
}

// The Campfire Confessions mascot: a wide-eyed night owl. Front-facing so it
// reads at any size, which is why the same silhouette is reused as the site's
// alternate logo mark (see /public/owl-mark.svg). Slow head-bob + occasional
// blink in the same inline-animation style as the fox and fish.
export function OwlMascot({ className = '' }: { className?: string }) {
  return (
    <svg width="80" height="74" viewBox="0 0 80 74" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <style>{`
        @keyframes owlBob  { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-2.5px) rotate(2deg); } }
        @keyframes owlBlink { 0%,91%,100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
        .ow-body { animation: owlBob 3.2s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 95%; }
        .ow-eye  { animation: owlBlink 4.2s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 50%; }
      `}</style>
      <g className="ow-body">
        {/* Ear tufts */}
        <polygon points="21,16 15,1 33,13" fill="#b45309" />
        <polygon points="59,16 65,1 47,13" fill="#b45309" />
        {/* Body */}
        <ellipse cx="40" cy="42" rx="27" ry="28" fill="#c2710c" />
        {/* Wings */}
        <path d="M 15 36 Q 9 50 18 64 Q 24 60 24 44 Z" fill="#92400e" />
        <path d="M 65 36 Q 71 50 62 64 Q 56 60 56 44 Z" fill="#92400e" />
        {/* Belly */}
        <ellipse cx="40" cy="48" rx="16" ry="20" fill="#f0c987" />
        {/* Eye discs */}
        <circle cx="30" cy="32" r="12" fill="#fff7ed" />
        <circle cx="50" cy="32" r="12" fill="#fff7ed" />
        {/* Eyes */}
        <g className="ow-eye">
          <circle cx="30" cy="33" r="5.5" fill="#1c1917" />
          <circle cx="50" cy="33" r="5.5" fill="#1c1917" />
          <circle cx="32" cy="31" r="1.7" fill="#fff" />
          <circle cx="52" cy="31" r="1.7" fill="#fff" />
        </g>
        {/* Beak */}
        <polygon points="36,38 44,38 40,47" fill="#f59e0b" />
        {/* Feet */}
        <path d="M 33 68 l 0 5 M 47 68 l 0 5" stroke="#f59e0b" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}
