'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Members } from 'pusher-js';
import { GAMES } from '@/lib/games/registry';
import { getPusherClient } from '@/lib/pusher-client';
import { getCrewIdentity, setCrewIdentity, CrewIdentity } from '@/lib/crew-client';
import { CrewLeaderboard, PresentMember } from '@/components/CrewLeaderboard';
import { Campfire } from '@/components/Campfire';

type View = 'loading' | 'not-found' | 'entry' | 'lobby';

/**
 * The persistent crew lobby — a crew's home between games. It's the shareable
 * link (`/crew/{slug}`): land here to see the standings, who's around right now,
 * and to launch any game tied to the crew. Identity is resolved once (silent
 * rejoin from this device's cache, else a name + 4-digit PIN), then cached.
 */
export default function CrewLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const slug = ((params.slug as string) ?? '').toUpperCase();

  const [view, setView] = useState<View>('loading');
  const [crewName, setCrewName] = useState<string>('');
  const [identity, setIdentity] = useState<CrewIdentity | null>(null);
  const [present, setPresent] = useState<PresentMember[]>([]);
  const [launching, setLaunching] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Entry form
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Validate the crew exists (and grab its display name), then decide whether
  // this device already has a membership for it.
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/crew/leaderboard?slug=${encodeURIComponent(slug)}`);
        if (res.status === 404) {
          if (!cancelled) setView('not-found');
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        setCrewName(data.name);
        const cached = getCrewIdentity(slug);
        if (cached) {
          setIdentity(cached);
          setView('lobby');
        } else {
          setView('entry');
        }
      } catch {
        if (!cancelled) setView('not-found');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Live presence: subscribe once we have an identity, mirror the channel's
  // member set into `present` for the leaderboard's "here now" badges.
  useEffect(() => {
    if (view !== 'lobby' || !identity) return;

    const pusher = getPusherClient();
    const channelName = `presence-crew-${slug}`;
    const channel = pusher.subscribe(channelName);

    const toMember = (m: { id: string; info: { name?: string } }): PresentMember => ({
      memberId: m.id,
      name: m.info?.name ?? 'Guest',
    });

    channel.bind('pusher:subscription_succeeded', (members: Members) => {
      const list: PresentMember[] = [];
      members.each((m: { id: string; info: { name?: string } }) => list.push(toMember(m)));
      setPresent(list);
    });
    channel.bind('pusher:member_added', (m: { id: string; info: { name?: string } }) => {
      setPresent((prev) =>
        prev.some((p) => p.memberId === m.id) ? prev : [...prev, toMember(m)]
      );
    });
    channel.bind('pusher:member_removed', (m: { id: string }) => {
      setPresent((prev) => prev.filter((p) => p.memberId !== m.id));
    });

    // The host launched a game — follow them into the room automatically. The
    // game page resolves this device's cached crew identity and silently joins,
    // so no room code is needed. The host is already navigating via createGame;
    // this drives everyone else in the lobby.
    channel.bind('game-started', (data: { gameSlug: string; gameId: string }) => {
      if (!data?.gameSlug || !data?.gameId) return;
      setLaunching(data.gameSlug);
      router.push(`/${data.gameSlug}/${slug}/${data.gameId}`);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [view, identity, slug, router]);

  async function submitEntry() {
    if (!name.trim()) return setError('Enter your name.');
    if (!/^\d{4}$/.test(pin)) return setError('PIN must be exactly 4 digits.');
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/crew/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, name: name.trim(), pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not join crew');
      const id: CrewIdentity = { memberId: data.memberId, name: data.name };
      setCrewIdentity(slug, id);
      setIdentity(id);
      setView('lobby');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  const createGame = useCallback(
    async (gameSlug: string) => {
      if (!identity) return;
      setLaunching(gameSlug);
      try {
        const res = await fetch(`/api/${gameSlug}/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ crewSlug: slug, memberId: identity.memberId }),
        });
        if (!res.ok) throw new Error('Could not create game');
        const { gameId, playerId } = await res.json();
        localStorage.setItem(`player_${gameId}`, playerId);
        router.push(`/${gameSlug}/${slug}/${gameId}`);
      } catch {
        setLaunching(null);
      }
    },
    [identity, slug, router]
  );

  function copyLink() {
    navigator.clipboard
      .writeText(`${window.location.origin}/crew/${slug}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  const inputClass =
    'w-full bg-stone-700 text-white placeholder-stone-500 text-lg px-4 py-3 rounded-xl border border-stone-600 focus:outline-none focus:border-amber-400';

  if (view === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center text-stone-400">
        Loading crew…
      </main>
    );
  }

  if (view === 'not-found') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-3xl font-bold text-stone-100 mb-2">Crew not found</h1>
        <p className="text-stone-400 mb-6">
          No crew with code <span className="font-mono text-stone-300">{slug}</span>. It may have
          expired, or the code is mistyped.
        </p>
        <button
          onClick={() => router.push('/')}
          className="bg-stone-700 hover:bg-stone-600 text-white font-bold px-5 py-2.5 rounded-xl transition-colors"
        >
          Back to games
        </button>
      </main>
    );
  }

  if (view === 'entry') {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-stone-800 rounded-2xl p-7">
          <h2 className="text-2xl font-bold text-white text-center mb-1">Join {crewName}</h2>
          <p className="text-stone-400 text-sm text-center mb-5">
            Pick your name and a 4-digit PIN. Returning? Use the same name + PIN to pick up your
            wins.
          </p>
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 24))}
              placeholder="Your name"
              className={inputClass}
              autoFocus
            />
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={(e) => e.key === 'Enter' && !busy && submitEntry()}
              placeholder="4-digit PIN"
              inputMode="numeric"
              maxLength={4}
              className={`${inputClass} font-mono tracking-[0.5em] text-center`}
            />
          </div>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          <button
            onClick={submitEntry}
            disabled={busy}
            className="w-full bg-amber-400 hover:bg-amber-300 text-stone-900 font-bold text-lg py-3 rounded-xl transition-colors mt-5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? 'Joining…' : 'Enter lobby'}
          </button>
          <button
            onClick={() => router.push('/')}
            disabled={busy}
            className="w-full text-stone-400 hover:text-stone-200 text-sm py-2 mt-1 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </main>
    );
  }

  // view === 'lobby'
  const liveGames = GAMES.filter((g) => g.status === 'live');

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Campfire />
          <div className="min-w-0">
            <h1 className="text-4xl font-extrabold text-stone-50 tracking-tight truncate">
              {crewName}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-stone-400 text-sm">
                Crew code <span className="font-mono text-amber-300 tracking-widest">{slug}</span>
              </span>
              <button
                onClick={copyLink}
                className="text-amber-300/90 hover:text-amber-200 text-xs font-semibold transition-colors"
              >
                {copied ? '✓ Link copied' : '🔗 Copy lobby link'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Game launchers */}
          <div className="space-y-4">
            <h2 className="text-stone-400 text-sm uppercase tracking-widest">Start a game</h2>
            {liveGames.map((meta) => (
              <button
                key={meta.slug}
                onClick={() => createGame(meta.slug)}
                disabled={launching !== null}
                className={`w-full text-left rounded-2xl border border-stone-700/80 bg-stone-900/70 p-5 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${meta.accent.glow} hover:-translate-y-0.5`}
              >
                <div className="font-extrabold text-lg text-stone-50">{meta.title}</div>
                <div className="text-stone-400 text-sm mt-1">{meta.description}</div>
                <div className={`mt-3 inline-block text-sm font-bold px-3 py-1.5 rounded-lg ${meta.accent.button}`}>
                  {launching === meta.slug ? 'Creating…' : 'Create game →'}
                </div>
              </button>
            ))}
          </div>

          {/* Standings + live presence */}
          <div className="space-y-3">
            <h2 className="text-stone-400 text-sm uppercase tracking-widest">
              Standings &amp; who&apos;s here
            </h2>
            <CrewLeaderboard
              slug={slug}
              highlightMemberId={identity?.memberId}
              presentMembers={present}
            />
            <p className="text-stone-500 text-xs">
              Green dot = in the lobby right now. Start a game and everyone here is pulled in
              automatically.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
