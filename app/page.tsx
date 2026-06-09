'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GAMES } from '@/lib/games/registry';
import { GameCard } from '@/components/GameCard';
import { Campfire } from '@/components/Campfire';
import { CrewSetupModal } from '@/components/CrewSetupModal';

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [creatingSlug, setCreatingSlug] = useState<string | null>(null);
  // The crew setup modal (new/existing) — one entry point across all games.
  const [crewModalOpen, setCrewModalOpen] = useState(false);
  // Standalone "jump straight to a crew lobby by code" box.
  const [lobbyCode, setLobbyCode] = useState('');

  function goToLobby() {
    const trimmed = lobbyCode.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setError('Crew code must be 6 characters.');
      return;
    }
    router.push(`/crew/${trimmed}`);
  }

  async function createGame(slug: string) {
    setCreatingSlug(slug);
    setError('');
    try {
      const res = await fetch(`/api/${slug}/create`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create game');
      const { gameId, playerId } = await res.json();
      localStorage.setItem(`player_${gameId}`, playerId);
      router.push(`/${slug}/${gameId}`);
    } catch {
      setError('Failed to create game. Please try again.');
      setCreatingSlug(null);
    }
  }

  // Join routes into the game's own room namespace. Only one game is live today,
  // so a code is assumed to belong to it; when more games ship we can resolve
  // the game type from the code server-side.
  function joinGame(slug: string) {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter a game code.');
      return;
    }
    if (trimmed.length !== 6) {
      setError('Game code must be 6 characters.');
      return;
    }
    router.push(`/${slug}/${trimmed}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="flex justify-center mb-2">
          <Campfire />
        </div>
        <h1 className="text-6xl font-extrabold text-stone-50 tracking-tight">
          Fox<span className="text-orange-400">flame</span> Games
        </h1>
        <p className="text-stone-400 text-lg mt-3">
          Gather round the fire and play. Pick a game to get started.
        </p>
      </div>

      {/* Crew CTA — one entry point across every game. Create/continue a crew to
          keep score over time, or jump straight to an existing crew's lobby. */}
      <div className="w-full max-w-3xl mb-10 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <button
          onClick={() => setCrewModalOpen(true)}
          className="bg-amber-400 hover:bg-amber-300 text-stone-900 font-bold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
        >
          🏆 Play with a crew
        </button>
        <p className="text-stone-400 text-sm flex-1">
          Keep a running record of wins across every game. No account — just a name and a 4-digit
          PIN.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={lobbyCode}
            onChange={(e) => {
              setLobbyCode(e.target.value.toUpperCase().slice(0, 6));
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && goToLobby()}
            placeholder="CREW CODE"
            maxLength={6}
            className="w-32 bg-stone-800 text-white placeholder-stone-500 font-mono text-center tracking-widest px-3 py-2.5 rounded-xl border border-stone-700 focus:outline-none focus:border-amber-400 uppercase"
          />
          <button
            onClick={goToLobby}
            className="bg-stone-700 hover:bg-stone-600 text-white font-bold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            Go to lobby
          </button>
        </div>
      </div>

      {/* Game grid */}
      <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
        {GAMES.map((meta) => (
          <GameCard key={meta.slug} meta={meta}>
            {/* Action controls only render for live games */}
            <div className="space-y-4">
              <button
                onClick={() => createGame(meta.slug)}
                disabled={creatingSlug !== null}
                className={`w-full font-bold text-lg py-3.5 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${meta.accent.button}`}
              >
                {creatingSlug === meta.slug ? 'Creating…' : 'Create Game'}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-stone-700" />
                <span className="text-stone-500 text-xs">or join with a code</span>
                <div className="flex-1 h-px bg-stone-700" />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase().slice(0, 6));
                    setError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && joinGame(meta.slug)}
                  placeholder="ENTER CODE"
                  maxLength={6}
                  className="flex-1 min-w-0 bg-stone-800 text-white placeholder-stone-500 font-mono text-center text-lg tracking-widest px-3 py-2.5 rounded-xl border border-stone-700 focus:outline-none focus:border-amber-400 uppercase"
                />
                <button
                  onClick={() => joinGame(meta.slug)}
                  className="bg-stone-700 hover:bg-stone-600 text-white font-bold px-5 py-2.5 rounded-xl transition-colors"
                >
                  Join
                </button>
              </div>
            </div>
          </GameCard>
        ))}
      </div>

      {error && <p className="mt-6 text-red-400 text-sm">{error}</p>}

      {crewModalOpen && <CrewSetupModal onClose={() => setCrewModalOpen(false)} />}
    </main>
  );
}
