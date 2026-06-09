// Cartoon animal mascots for the Foxflame game cards. Each is a small, lightly
// animated SVG. Add a new mascot here and reference it from a game's meta.

import { GameMeta } from '@/lib/games/types';

export function Mascot({ kind, className = '' }: { kind: GameMeta['mascot']; className?: string }) {
  if (kind === 'fox') return <FoxMascot className={className} />;
  if (kind === 'owl') return <OwlMascot className={className} />;
  return <FishMascot className={className} />;
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
