// Animated cartoon campfire scene — the Foxflame hub centerpiece. A crew of
// forest friends (a fox tending the fire, plus a bear, a raccoon, and an owl on
// a branch) gathered around a crackling fire. Hand-built SVG in the same
// inline-animation style as the game mascots: flickering flames, drifting
// embers, a soft firelight glow, swaying bodies, twitching ears and blinks.

export function Campfire({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 460 220"
      xmlns="http://www.w3.org/2000/svg"
      className={`w-[460px] max-w-full h-auto ${className}`}
      role="img"
      aria-label="Cartoon forest animals gathered around a crackling campfire"
    >
      <style>{`
        @keyframes cf-flameFlicker {
          0%, 100% { transform: scaleY(1) scaleX(1); }
          25%      { transform: scaleY(1.08) scaleX(0.96); }
          50%      { transform: scaleY(0.94) scaleX(1.04); }
          75%      { transform: scaleY(1.04) scaleX(0.98); }
        }
        @keyframes cf-innerFlicker {
          0%, 100% { transform: scaleY(1); opacity: 1; }
          50%      { transform: scaleY(0.88); opacity: 0.85; }
        }
        @keyframes cf-glowPulse {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.05); }
        }
        @keyframes cf-emberRise {
          0%   { transform: translateY(0); opacity: 0; }
          20%  { opacity: 1; }
          100% { transform: translateY(-60px) translateX(7px); opacity: 0; }
        }
        @keyframes cf-sway {
          0%, 100% { transform: rotate(-2deg); }
          50%      { transform: rotate(2deg); }
        }
        @keyframes cf-tailwag {
          0%, 100% { transform: rotate(-4deg); }
          50%      { transform: rotate(6deg); }
        }
        @keyframes cf-earTwitch {
          0%, 90%, 100% { transform: rotate(0); }
          94%           { transform: rotate(-9deg); }
        }
        @keyframes cf-blink {
          0%, 93%, 100% { transform: scaleY(1); }
          96%           { transform: scaleY(0.1); }
        }
        .cf-flame { animation: cf-flameFlicker 1.1s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
        .cf-inner { animation: cf-innerFlicker 0.7s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
        .cf-glow  { animation: cf-glowPulse 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 50%; }
        .cf-e1    { animation: cf-emberRise 2.2s ease-in infinite; }
        .cf-e2    { animation: cf-emberRise 2.6s ease-in infinite 0.7s; }
        .cf-e3    { animation: cf-emberRise 2.0s ease-in infinite 1.3s; }
        .cf-sway  { animation: cf-sway 3.4s ease-in-out infinite; transform-box: fill-box; }
        .cf-tail  { animation: cf-tailwag 1.6s ease-in-out infinite; transform-box: fill-box; }
        .cf-ear   { animation: cf-earTwitch 5s ease-in-out infinite; transform-box: fill-box; }
        .cf-eye   { animation: cf-blink 4.5s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 50%; }
      `}</style>

      <defs>
        <radialGradient id="cf-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fb923c" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#f97316" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ground shadow + warm firelight glow */}
      <ellipse cx="230" cy="198" rx="195" ry="18" fill="#000" opacity="0.22" />
      <ellipse className="cf-glow" cx="245" cy="140" rx="125" ry="100" fill="url(#cf-glow)" />

      {/* BEAR (far left) */}
      <g transform="translate(14 98)">
        <g className="cf-sway" style={{ transformOrigin: '40px 96px' }}>
          <ellipse cx="40" cy="66" rx="38" ry="34" fill="#6b4f3a" />
          <ellipse cx="40" cy="74" rx="22" ry="20" fill="#8a6a4f" />
          {/* legs */}
          <ellipse cx="24" cy="96" rx="12" ry="9" fill="#5c4332" />
          <ellipse cx="56" cy="96" rx="12" ry="9" fill="#5c4332" />
          {/* head */}
          <circle cx="62" cy="34" r="24" fill="#6b4f3a" />
          <circle cx="48" cy="14" r="9" fill="#6b4f3a" />
          <circle cx="76" cy="14" r="9" fill="#6b4f3a" />
          <circle cx="48" cy="14" r="4" fill="#8a6a4f" />
          <circle cx="76" cy="14" r="4" fill="#8a6a4f" />
          <ellipse cx="66" cy="42" rx="13" ry="10" fill="#cbb291" />
          <circle cx="74" cy="40" r="3.2" fill="#1c1917" />
          <g className="cf-eye">
            <circle cx="55" cy="30" r="3" fill="#1c1917" />
            <circle cx="69" cy="30" r="3" fill="#1c1917" />
          </g>
        </g>
      </g>

      {/* RACCOON (right) */}
      <g transform="translate(292 112)">
        <g className="cf-sway" style={{ transformOrigin: '30px 76px' }}>
          {/* striped tail */}
          <path d="M 50 50 Q 78 54 74 80 Q 60 84 48 66 Z" fill="#9ca3af" />
          <path d="M 60 56 Q 70 60 70 70" stroke="#374151" strokeWidth="6" fill="none" />
          <ellipse cx="30" cy="58" rx="26" ry="26" fill="#9ca3af" />
          <ellipse cx="30" cy="64" rx="15" ry="17" fill="#d1d5db" />
          <ellipse cx="22" cy="82" rx="9" ry="7" fill="#6b7280" />
          <ellipse cx="40" cy="82" rx="9" ry="7" fill="#6b7280" />
          {/* head */}
          <circle cx="30" cy="30" r="20" fill="#9ca3af" />
          <polygon points="14,16 10,2 24,14" fill="#9ca3af" />
          <polygon points="46,16 50,2 36,14" fill="#9ca3af" />
          {/* mask */}
          <path d="M 14 30 Q 22 24 30 30 Q 38 24 46 30 Q 44 40 30 40 Q 16 40 14 30 Z" fill="#374151" />
          <ellipse cx="30" cy="40" rx="11" ry="9" fill="#e5e7eb" />
          <g className="cf-eye">
            <circle cx="22" cy="30" r="3.4" fill="#1c1917" />
            <circle cx="38" cy="30" r="3.4" fill="#1c1917" />
            <circle cx="20.8" cy="28.8" r="1.1" fill="#fff" />
            <circle cx="36.8" cy="28.8" r="1.1" fill="#fff" />
          </g>
          <circle cx="30" cy="40" r="3" fill="#1c1917" />
        </g>
      </g>

      {/* OWL on a branch (top right) */}
      <g transform="translate(346 40)">
        <rect x="-30" y="40" width="70" height="6" rx="3" fill="#6b4423" transform="rotate(-6 5 43)" />
        <g className="cf-sway" style={{ transformOrigin: '18px 40px' }}>
          <ellipse cx="18" cy="24" rx="18" ry="21" fill="#a16207" />
          <ellipse cx="18" cy="29" rx="11" ry="13" fill="#d6a35c" />
          <polygon points="4,6 8,-6 14,4" fill="#a16207" />
          <polygon points="32,6 28,-6 22,4" fill="#a16207" />
          <circle cx="11" cy="20" r="7" fill="#fff7ed" />
          <circle cx="25" cy="20" r="7" fill="#fff7ed" />
          <g className="cf-eye">
            <circle cx="11" cy="21" r="3.2" fill="#1c1917" />
            <circle cx="25" cy="21" r="3.2" fill="#1c1917" />
          </g>
          <polygon points="18,24 15,30 21,30" fill="#f59e0b" />
          <path d="M 13 44 l 0 5 M 23 44 l 0 5" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      </g>

      {/* CAMPFIRE (center) */}
      <g transform="translate(170 64)">
        <rect x="20" y="118" width="80" height="13" rx="6.5" fill="#8b5a2b" transform="rotate(-12 60 124)" />
        <rect x="20" y="118" width="80" height="13" rx="6.5" fill="#8b5a2b" transform="rotate(12 60 124)" />
        <circle className="cf-e1" cx="52" cy="100" r="2.6" fill="#fbbf24" />
        <circle className="cf-e2" cx="68" cy="98" r="2.2" fill="#fb923c" />
        <circle className="cf-e3" cx="60" cy="102" r="1.8" fill="#fde68a" />
        <g className="cf-flame">
          <path d="M 60 26 C 85 52, 93 76, 84 98 C 78 112, 42 112, 37 98 C 28 76, 38 50, 60 26 Z" fill="#f97316" />
          <path d="M 60 46 C 77 65, 82 83, 75 99 C 70 110, 50 110, 45 99 C 38 83, 45 64, 60 46 Z" fill="#fbbf24" />
        </g>
        <g className="cf-inner">
          <path d="M 60 64 C 70 76, 72 89, 67 99 C 64 105, 56 105, 53 99 C 48 89, 51 75, 60 64 Z" fill="#fde68a" />
        </g>
      </g>

      {/* FOX (front-facing hero, seated to the left of the fire — fully visible) */}
      <g transform="translate(120 124)">
        <g className="cf-tail" style={{ transformOrigin: '8px 56px' }}>
          <path d="M 14 58 Q -16 50 -8 22 Q 4 26 18 46 Z" fill="#ea580c" />
          <path d="M -7 26 Q -13 16 -4 14 Q 2 19 2 28 Z" fill="#fff7ed" />
        </g>
        <ellipse cx="34" cy="56" rx="27" ry="23" fill="#f97316" />
        <path d="M 22 46 Q 34 40 46 46 Q 44 70 34 72 Q 24 70 22 46 Z" fill="#fff7ed" />
        <rect x="22" y="60" width="9" height="16" rx="4" fill="#ea580c" />
        <rect x="37" y="60" width="9" height="16" rx="4" fill="#ea580c" />
        <g className="cf-sway" style={{ transformOrigin: '34px 38px' }}>
          <polygon className="cf-ear" points="16,20 12,2 30,16" fill="#ea580c" style={{ transformOrigin: '21px 18px' }} />
          <polygon points="52,20 56,2 38,16" fill="#ea580c" />
          <polygon points="18,17 16,7 26,16" fill="#7c2d12" />
          <polygon points="50,17 52,7 42,16" fill="#7c2d12" />
          <path d="M 14 22 Q 34 12 54 22 L 47 42 Q 34 50 21 42 Z" fill="#f97316" />
          <path d="M 24 36 Q 34 32 44 36 L 39 50 Q 34 54 29 50 Z" fill="#fff7ed" />
          <g className="cf-eye">
            <circle cx="26" cy="30" r="3.4" fill="#1c1917" />
            <circle cx="42" cy="30" r="3.4" fill="#1c1917" />
            <circle cx="24.8" cy="28.8" r="1.1" fill="#fff" />
            <circle cx="40.8" cy="28.8" r="1.1" fill="#fff" />
          </g>
          <path d="M 34 44 l -4 -4 h 8 Z" fill="#1c1917" />
        </g>
      </g>
    </svg>
  );
}
