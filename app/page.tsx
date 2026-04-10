'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  async function createGame() {
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/game/create', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create game');
      const { gameId, playerId } = await res.json();
      localStorage.setItem(`player_${gameId}`, playerId);
      router.push(`/game/${gameId}`);
    } catch {
      setError('Failed to create game. Please try again.');
      setCreating(false);
    }
  }

  function joinGame() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter a game code.');
      return;
    }
    if (trimmed.length !== 6) {
      setError('Game code must be 6 characters.');
      return;
    }
    router.push(`/game/${trimmed}`);
  }

  return (
    <main className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Illustration */}
        <div className="flex justify-center mb-4">
          <svg width="180" height="130" viewBox="0 0 180 130" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes fishSwim {
                0%, 100% { transform: translateY(0px) rotate(0deg); }
                30%       { transform: translateY(-7px) rotate(2deg); }
                70%       { transform: translateY(5px) rotate(-1deg); }
              }
              @keyframes tailWag {
                0%, 100% { transform: rotate(-12deg); }
                50%      { transform: rotate(12deg); }
              }
              @keyframes floatUp {
                0%   { transform: translateY(0px); opacity: 0.9; }
                100% { transform: translateY(-28px); opacity: 0; }
              }
              @keyframes waveShift {
                0%, 100% { transform: translateX(0px); }
                50%      { transform: translateX(6px); }
              }
              .fish-all   { animation: fishSwim 2.5s ease-in-out infinite; }
              .fish-tail  { animation: tailWag 0.45s ease-in-out infinite; transform-box: fill-box; transform-origin: 0% 50%; }
              .bubble-1   { animation: floatUp 2.4s ease-in infinite 0s; }
              .bubble-2   { animation: floatUp 2.4s ease-in infinite 0.8s; }
              .bubble-3   { animation: floatUp 2.4s ease-in infinite 1.6s; }
              .wave-1     { animation: waveShift 2s ease-in-out infinite 0s; }
              .wave-2     { animation: waveShift 2s ease-in-out infinite 0.35s; }
            `}</style>

            {/* Whole fish bobs together */}
            <g className="fish-all">
              {/* Tail renders first so body overlaps the join */}
              <polygon className="fish-tail" points="133,62 158,42 158,82" fill="#f59e0b" />
              {/* Body */}
              <ellipse cx="88" cy="62" rx="45" ry="28" fill="#fbbf24" />
              {/* Top fin */}
              <path d="M 75 34 Q 88 20 101 34" fill="#f59e0b" />
              {/* Eye */}
              <circle cx="58" cy="54" r="9" fill="white" />
              <circle cx="56" cy="54" r="4.5" fill="#1e293b" />
              <circle cx="54" cy="52" r="1.5" fill="white" />
              {/* Smile */}
              <path d="M 65 72 Q 78 82 91 72" stroke="#92400e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </g>

            {/* Bubbles float up independently */}
            <circle className="bubble-1" cx="30" cy="48" r="5" fill="none" stroke="#93c5fd" strokeWidth="2" />
            <circle className="bubble-2" cx="18" cy="36" r="3" fill="none" stroke="#93c5fd" strokeWidth="1.5" />
            <circle className="bubble-3" cx="36" cy="28" r="4" fill="none" stroke="#93c5fd" strokeWidth="1.5" />

            {/* Waves shift subtly */}
            <g className="wave-1">
              <path d="M 10 105 Q 28 96 46 105 Q 64 114 82 105 Q 100 96 118 105 Q 136 114 154 105 Q 165 100 170 103" stroke="#60a5fa" strokeWidth="3" fill="none" strokeLinecap="round" />
            </g>
            <g className="wave-2">
              <path d="M 10 118 Q 28 109 46 118 Q 64 127 82 118 Q 100 109 118 118 Q 136 127 154 118" stroke="#60a5fa" strokeWidth="2" fill="none" strokeLinecap="round" opacity={0.5} />
            </g>
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-6xl font-extrabold text-white mb-3 tracking-tight">
          Sync or Swim
        </h1>
        <p className="text-slate-400 text-lg mb-10">
          Match your team&apos;s answers. First to 25 points wins.
        </p>

        {/* Create Game */}
        <button
          onClick={createGame}
          disabled={creating}
          className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-lg py-4 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-6"
        >
          {creating ? 'Creating...' : 'Create Game'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-slate-500 text-sm">or join with a code</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        {/* Join Game */}
        <div className="flex gap-3">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().slice(0, 6));
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && joinGame()}
            placeholder="ENTER CODE"
            maxLength={6}
            className="flex-1 bg-slate-800 text-white placeholder-slate-500 font-mono text-center text-xl tracking-widest px-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-400 uppercase"
          />
          <button
            onClick={joinGame}
            className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-6 py-3 rounded-xl transition-colors"
          >
            Join
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="mt-4 text-red-400 text-sm">{error}</p>
        )}
      </div>
    </main>
  );
}
