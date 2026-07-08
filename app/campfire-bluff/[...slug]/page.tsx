'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPusherClient } from '@/lib/pusher-client';
import { generateId } from '@/lib/ids';
import { ClientRoom } from '@/lib/games/types';
import { ClientCampfireBluffGame } from '@/lib/games/campfire-bluff/types';
import { getCrewIdentity, setCrewIdentity } from '@/lib/crew-client';
import { CrewLeaderboard } from '@/components/CrewLeaderboard';

const SLUG = 'campfire-bluff';
const MIN_PLAYERS = 3;

type RoomState = ClientRoom<ClientCampfireBluffGame>;
type ViewState =
  | 'loading'
  | 'not-found'
  | 'name-entry'
  | 'crew-entry'
  | 'lobby'
  | 'bluffing'
  | 'voting'
  | 'revealed'
  | 'ended';

export default function CampfireBluffGamePage() {
  const params = useParams();
  const router = useRouter();

  // Catch-all route serves both URL shapes; the gameId is always the last
  // segment, a leading segment is the crew code.
  const slugParts = (params.slug as string[]) ?? [];
  const gameId = slugParts[slugParts.length - 1];
  const pathTail = slugParts.join('/');

  const [gameState, setGameState] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>('loading');
  const [nameInput, setNameInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isActing, setIsActing] = useState(false);

  // Bluff-writing form. Kept (not cleared) through voting/revealed so the
  // voting screen can grey out the option matching what the viewer wrote,
  // without needing a server-issued secret for a fact only they'd know anyway.
  const [bluffInput, setBluffInput] = useState('');
  const [formError, setFormError] = useState('');
  const [voteError, setVoteError] = useState('');
  const prevPhaseRef = useRef<string | null>(null);

  const apiPost = useCallback(
    async (endpoint: string, extraBody: Record<string, unknown> = {}) => {
      const res = await fetch(`/api/${SLUG}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId, ...extraBody }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Request failed');
      }
      return res.json();
    },
    [gameId, playerId]
  );

  const refreshGameState = useCallback(async () => {
    if (!playerId) return;
    try {
      const res = await fetch(`/api/state/${gameId}`);
      if (!res.ok) return;
      const state: RoomState = await res.json();
      const prevPhase = prevPhaseRef.current;
      prevPhaseRef.current = state.phase;
      setGameState(state);
      if (!state.players[playerId]) {
        setView(state.crewSlug ? 'crew-entry' : 'name-entry');
      } else {
        setView(state.phase as ViewState);
        // A fresh round opened — clear the previous round's bluff.
        if (state.phase === 'bluffing' && prevPhase !== 'bluffing') {
          setBluffInput('');
          setFormError('');
          setVoteError('');
        }
      }
    } catch {
      // silently ignore — Pusher may still deliver the update
    }
  }, [gameId, playerId]);

  const joinRoom = useCallback(
    async (pid: string, name: string) => {
      const res = await fetch(`/api/${SLUG}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId: pid, name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to join');
      }
      return res.json();
    },
    [gameId]
  );

  // Resolve identity and fetch initial state. State first, because a room's
  // crewSlug decides how identity works (silent crew rejoin vs per-room id).
  useEffect(() => {
    if (!gameId) return;

    async function init() {
      let state: RoomState;
      try {
        const res = await fetch(`/api/state/${gameId}`);
        if (res.status === 404) {
          setView('not-found');
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch state');
        state = await res.json();
      } catch {
        setView('not-found');
        return;
      }
      setGameState(state);
      prevPhaseRef.current = state.phase;

      if (state.crewSlug) {
        const identity = getCrewIdentity(state.crewSlug);
        if (!identity) {
          setView('crew-entry');
          return;
        }
        const pid = identity.memberId;
        localStorage.setItem(`player_${gameId}`, pid);
        setPlayerId(pid);

        if (state.players[pid]) {
          setView(state.phase as ViewState);
        } else {
          try {
            await joinRoom(pid, identity.name);
            setView(state.phase as ViewState);
          } catch {
            setView('crew-entry');
          }
        }
        return;
      }

      let pid = localStorage.getItem(`player_${gameId}`);
      if (!pid) {
        pid = generateId(6);
        localStorage.setItem(`player_${gameId}`, pid);
      }
      setPlayerId(pid);

      if (!state.players[pid]) {
        setView('name-entry');
      } else {
        setView(state.phase as ViewState);
      }
    }

    init();
  }, [gameId, joinRoom]);

  // Keep the URL canonical once we know the room's crew.
  useEffect(() => {
    if (!gameState) return;
    const desiredTail = gameState.crewSlug ? `${gameState.crewSlug}/${gameId}` : gameId;
    if (pathTail !== desiredTail) {
      router.replace(`/${SLUG}/${desiredTail}`);
    }
  }, [gameState, gameId, pathTail, router]);

  // Pusher subscription
  useEffect(() => {
    if (!gameId || !playerId) return;

    const pusher = getPusherClient();
    const channel = pusher.subscribe(`game-${gameId}`);

    pusher.connection.bind('connected', refreshGameState);
    channel.bind('state-update', refreshGameState);

    return () => {
      pusher.connection.unbind('connected', refreshGameState);
      channel.unbind_all();
      pusher.unsubscribe(`game-${gameId}`);
    };
  }, [gameId, playerId, refreshGameState]);

  async function handleJoin() {
    if (!nameInput.trim()) {
      setJoinError('Please enter a name.');
      return;
    }
    setJoinError('');
    try {
      await apiPost('join', { name: nameInput.trim() });
      setView((gameState?.phase as ViewState) ?? 'lobby');
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join');
    }
  }

  async function handleCrewJoin() {
    const crewSlug = gameState?.crewSlug;
    if (!crewSlug) return;
    if (!nameInput.trim()) return setJoinError('Please enter a name.');
    if (!/^\d{4}$/.test(pinInput)) return setJoinError('PIN must be exactly 4 digits.');
    setJoinError('');
    try {
      const res = await fetch('/api/crew/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: crewSlug, name: nameInput.trim(), pin: pinInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not join crew');

      const { memberId, name: confirmedName } = data;
      setCrewIdentity(crewSlug, { memberId, name: confirmedName });
      localStorage.setItem(`player_${gameId}`, memberId);
      setPlayerId(memberId);

      await joinRoom(memberId, confirmedName);
      setView((gameState?.phase as ViewState) ?? 'lobby');
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join');
    }
  }

  // Host / control actions share the isActing guard.
  async function act(endpoint: string, extra: Record<string, unknown> = {}) {
    if (isActing) return;
    setIsActing(true);
    try {
      await apiPost(endpoint, extra);
      await refreshGameState();
    } catch (err) {
      console.error(`${endpoint} failed:`, err);
      await refreshGameState();
    } finally {
      setIsActing(false);
    }
  }

  async function handleSubmitBluff() {
    const cleaned = bluffInput.trim();
    if (!cleaned) return setFormError('Write a bluff answer.');
    setFormError('');
    if (isActing) return;
    setIsActing(true);
    try {
      await apiPost('submit', { bluff: cleaned });
      await refreshGameState();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setIsActing(false);
    }
  }

  async function handleVote(optionId: string) {
    if (isActing) return;
    setIsActing(true);
    try {
      await apiPost('vote', { optionId });
      setVoteError('');
      await refreshGameState();
    } catch (err) {
      // Most commonly hit if a page reload wiped the local memory of which
      // option is the viewer's own bluff and they tapped it anyway — the
      // server always enforces the rule regardless of what the UI greyed out.
      setVoteError(err instanceof Error ? err.message : 'Failed to vote');
    } finally {
      setIsActing(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isHost = playerId === gameState?.hostId;
  const players = gameState ? Object.values(gameState.players) : [];
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-stone-400">Loading game...</p>
        </div>
      </div>
    );
  }

  // ─── Not Found ─────────────────────────────────────────────────────────────
  if (view === 'not-found') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-3">Game not found</h1>
          <p className="text-stone-400 mb-6">This game doesn&apos;t exist or has expired.</p>
          <a
            href="/"
            className="bg-purple-400 hover:bg-purple-300 text-stone-900 font-bold px-6 py-3 rounded-xl transition-colors"
          >
            Back to Foxflame
          </a>
        </div>
      </div>
    );
  }

  // ─── Name Entry ────────────────────────────────────────────────────────────
  if (view === 'name-entry') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-stone-800 rounded-2xl p-8">
          <p className="text-stone-400 text-sm text-center mb-1 font-mono tracking-widest uppercase">
            Game Code
          </p>
          <p className="text-purple-400 font-mono text-3xl font-bold text-center mb-6 tracking-widest">
            {gameId}
          </p>
          <h2 className="text-2xl font-bold text-white text-center mb-6">Join Game</h2>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value.slice(0, 20));
              setJoinError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="Your name"
            autoFocus
            className="w-full bg-stone-700 text-white placeholder-stone-500 text-lg px-4 py-3 rounded-xl border border-stone-600 focus:outline-none focus:border-purple-400 mb-4"
          />
          {joinError && <p className="text-red-400 text-sm mb-3">{joinError}</p>}
          <button
            onClick={handleJoin}
            className="w-full bg-purple-400 hover:bg-purple-300 text-stone-900 font-bold text-lg py-3 rounded-xl transition-colors"
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  // ─── Crew Entry ────────────────────────────────────────────────────────────
  if (view === 'crew-entry' && gameState?.crewSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-stone-800 rounded-2xl p-8">
          <p className="text-stone-400 text-sm text-center mb-1 font-mono tracking-widest uppercase">
            Crew Game
          </p>
          <p className="text-purple-400 font-mono text-2xl font-bold text-center mb-2 tracking-widest">
            {gameState.crewSlug}
          </p>
          <p className="text-stone-400 text-sm text-center mb-6">
            Wins in this game count toward your crew record. New name? Pick a PIN.
            Returning? Enter your PIN to claim your name.
          </p>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value.slice(0, 24));
              setJoinError('');
            }}
            placeholder="Your name"
            autoFocus
            className="w-full bg-stone-700 text-white placeholder-stone-500 text-lg px-4 py-3 rounded-xl border border-stone-600 focus:outline-none focus:border-purple-400 mb-3"
          />
          <input
            type="text"
            value={pinInput}
            onChange={(e) => {
              setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
              setJoinError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleCrewJoin()}
            placeholder="4-digit PIN"
            inputMode="numeric"
            maxLength={4}
            className="w-full bg-stone-700 text-white placeholder-stone-500 text-lg px-4 py-3 rounded-xl border border-stone-600 focus:outline-none focus:border-purple-400 font-mono tracking-[0.5em] text-center mb-4"
          />
          {joinError && <p className="text-red-400 text-sm mb-3">{joinError}</p>}
          <button
            onClick={handleCrewJoin}
            className="w-full bg-purple-400 hover:bg-purple-300 text-stone-900 font-bold text-lg py-3 rounded-xl transition-colors"
          >
            Join crew game
          </button>
        </div>
      </div>
    );
  }

  // ─── Lobby ─────────────────────────────────────────────────────────────────
  if (view === 'lobby' && gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <h1 className="text-4xl font-extrabold text-white text-center mb-2">Campfire Bluff</h1>
          <p className="text-stone-400 text-center mb-8">Waiting for players...</p>

          <div className="bg-stone-800 rounded-2xl p-6 mb-6 text-center">
            <p className="text-stone-400 text-sm mb-2">Share this code to invite players</p>
            <p className="text-purple-400 font-mono text-5xl font-bold tracking-widest mb-4">
              {gameId}
            </p>
            <button
              onClick={copyLink}
              className="bg-stone-700 hover:bg-stone-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {copied ? '✓ Copied!' : 'Copy invite link'}
            </button>
          </div>

          <div className="bg-stone-800 rounded-2xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-4">Players ({players.length})</h2>
            <ul className="space-y-2">
              {players.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full" />
                  <span className="text-white">{p.name}</span>
                  {p.id === playerId && <span className="text-stone-400 text-sm">(you)</span>}
                  {p.isHost && (
                    <span className="text-purple-400 text-xs font-semibold ml-1">(host)</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {gameState.crewSlug && (
            <div className="mb-6">
              <CrewLeaderboard slug={gameState.crewSlug} highlightMemberId={playerId} />
            </div>
          )}

          {isHost ? (
            <button
              onClick={() => act('start')}
              disabled={players.length < MIN_PLAYERS || isActing}
              className="w-full bg-purple-400 hover:bg-purple-300 text-stone-900 font-bold text-lg py-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {players.length < MIN_PLAYERS
                ? `Need ${MIN_PLAYERS - players.length} more player${
                    MIN_PLAYERS - players.length === 1 ? '' : 's'
                  }...`
                : 'Start Game'}
            </button>
          ) : (
            <p className="text-center text-stone-400">Waiting for host to start...</p>
          )}
        </div>
      </div>
    );
  }

  const hasBluffed = gameState ? gameState.game.submittedIds.includes(playerId ?? '') : false;

  // ─── Bluffing ────────────────────────────────────────────────────────────
  if (view === 'bluffing' && gameState) {
    const submittedCount = players.filter((p) =>
      gameState.game.submittedIds.includes(p.id)
    ).length;
    const waitingCount = players.length - submittedCount;
    const allSubmitted = players.length > 0 && waitingCount === 0;
    const canOpenVoting = submittedCount >= 1;
    const roundNum = gameState.game.roundIndex + 1;
    const totalRounds = gameState.game.totalRounds;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="flex justify-between items-center mb-4">
            <span className="text-stone-400 text-sm">
              Round {roundNum} of {totalRounds}
            </span>
            <span className="text-stone-500 text-sm">Bluff your way to points 🦨</span>
          </div>

          <div className="bg-stone-800 rounded-2xl p-6 mb-6 text-center">
            <p className="text-stone-400 text-xs uppercase tracking-widest mb-2">The prompt</p>
            <p className="text-white text-2xl font-bold leading-snug">{gameState.game.currentPrompt}</p>
          </div>

          {!hasBluffed ? (
            <>
              <textarea
                value={bluffInput}
                onChange={(e) => {
                  setBluffInput(e.target.value.slice(0, 140));
                  setFormError('');
                }}
                placeholder="Write a convincing fake answer..."
                rows={3}
                autoFocus
                className="w-full bg-stone-800 text-white placeholder-stone-500 text-lg px-4 py-3 rounded-xl border border-stone-700 focus:outline-none focus:border-purple-400 resize-none mb-3"
              />
              {formError && <p className="text-red-400 text-sm mb-3">{formError}</p>}
              <button
                onClick={handleSubmitBluff}
                disabled={isActing}
                className="w-full bg-purple-400 hover:bg-purple-300 text-stone-900 font-bold text-lg py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isActing ? 'Locking in...' : 'Lock in my bluff'}
              </button>
            </>
          ) : (
            <>
              <div className="bg-green-900/50 border border-green-600 text-green-300 text-center py-4 rounded-xl mb-6">
                Your bluff is locked in! Waiting for everyone to finish...
              </div>

              <div className="bg-stone-800 rounded-xl p-4 mb-6">
                <p className="text-stone-400 text-xs uppercase tracking-widest mb-3">Waiting on</p>
                <div className="flex flex-wrap gap-2">
                  {players.map((p) => {
                    const done = gameState.game.submittedIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
                          done ? 'bg-green-900/40 text-green-300' : 'bg-stone-700 text-stone-400'
                        }`}
                      >
                        <span>{done ? '✓' : '⏳'}</span>
                        <span>{p.name}</span>
                        {p.id === playerId && <span className="text-xs opacity-60">(you)</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {isHost ? (
                <>
                  <button
                    onClick={() => act('begin-voting')}
                    disabled={!canOpenVoting || isActing}
                    className="w-full bg-purple-400 hover:bg-purple-300 text-stone-900 font-bold text-lg py-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {allSubmitted ? 'Open voting →' : `Open voting without ${waitingCount} waiting →`}
                  </button>
                  {!allSubmitted && (
                    <p className="text-center text-stone-500 text-xs mt-2">
                      Players who haven&apos;t bluffed just won&apos;t have an option in play this
                      round.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-center text-stone-400">Waiting for host to open voting...</p>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── Voting ──────────────────────────────────────────────────────────────
  if (view === 'voting' && gameState) {
    const hasVoted = gameState.game.votedIds.includes(playerId ?? '');
    const roundNum = gameState.game.roundIndex + 1;
    const totalRounds = gameState.game.totalRounds;
    const waitingNames = gameState.game.eligibleVoterIds
      .filter((id) => !gameState.game.votedIds.includes(id))
      .map((id) => gameState.players[id]?.name ?? '?');

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="flex justify-between items-center mb-4">
            <span className="text-stone-400 text-sm">
              Round {roundNum} of {totalRounds}
            </span>
            <span className="text-stone-500 text-sm">Which one is true? 🔥</span>
          </div>

          <div className="bg-stone-800 rounded-2xl p-6 mb-6 text-center">
            <p className="text-white text-xl font-bold leading-snug">{gameState.game.currentPrompt}</p>
          </div>

          <div className="space-y-3 mb-6">
            {gameState.game.options.map((opt) => {
              // The option matching what the viewer typed is their own bluff —
              // no need to ask the server which id that is, they already know
              // the text. The server still enforces this rule either way.
              const isOwn = bluffInput.trim().length > 0 && opt.text === bluffInput.trim();
              const tappable = !hasVoted && !isOwn;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!tappable || isActing}
                  onClick={() => tappable && handleVote(opt.id)}
                  className={`w-full text-left rounded-xl border px-5 py-4 transition-colors ${
                    isOwn
                      ? 'border-stone-800 bg-stone-800/50 cursor-default opacity-50'
                      : tappable
                      ? 'border-stone-700 bg-stone-800 hover:border-purple-400 hover:bg-stone-700 cursor-pointer'
                      : 'border-stone-700 bg-stone-800 cursor-default'
                  }`}
                >
                  <span className="text-white text-lg">{opt.text}</span>
                  {isOwn && <span className="text-stone-500 text-xs ml-2">(your bluff)</span>}
                </button>
              );
            })}
          </div>

          {voteError && <p className="text-red-400 text-sm text-center mb-4">{voteError}</p>}

          {hasVoted ? (
            <div className="bg-green-900/50 border border-green-600 text-green-300 text-center py-3 rounded-xl mb-4">
              Vote locked in! Waiting for others...
            </div>
          ) : (
            <p className="text-center text-stone-400 mb-4">Tap the answer you think is real.</p>
          )}

          {waitingNames.length > 0 && (
            <p className="text-center text-stone-500 text-sm mb-4">
              Waiting on: {waitingNames.join(', ')}
            </p>
          )}

          {isHost && (
            <button
              onClick={() => act('reveal')}
              disabled={isActing}
              className="w-full bg-stone-700 hover:bg-stone-600 text-stone-200 font-medium py-2.5 rounded-lg transition-colors text-sm border border-stone-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isActing ? 'Revealing...' : 'Reveal now'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Revealed ────────────────────────────────────────────────────────────
  if (view === 'revealed' && gameState) {
    const lastRound = gameState.game.roundHistory[gameState.game.roundHistory.length - 1];
    const isLastRound = gameState.game.roundIndex + 1 >= gameState.game.totalRounds;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {lastRound && (
            <>
              <h2 className="text-2xl font-extrabold text-white text-center mb-1">
                {lastRound.prompt}
              </h2>
              <p className="text-stone-400 text-center mb-6">
                The truth: <span className="text-green-400 font-semibold">{lastRound.trueAnswer}</span>
              </p>

              <div className="space-y-3 mb-6">
                {lastRound.options.map((opt, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border px-5 py-4 ${
                      opt.isTrue
                        ? 'border-green-600/60 bg-green-950/20'
                        : 'border-stone-700 bg-stone-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-white text-lg">{opt.text}</p>
                      <span
                        className={`shrink-0 text-xs font-bold uppercase tracking-wide px-2 py-1 rounded ${
                          opt.isTrue ? 'bg-green-600/70 text-white' : 'bg-stone-700 text-stone-300'
                        }`}
                      >
                        {opt.isTrue ? 'Truth' : opt.authorName ?? 'Bluff'}
                      </span>
                    </div>
                    {opt.voterIds.length > 0 && (
                      <p className="text-stone-400 text-sm mt-2">
                        Voted by:{' '}
                        {opt.voterIds.map((id) => gameState.players[id]?.name ?? '?').join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Round scoring breakdown */}
              <div className="bg-stone-800 rounded-2xl p-5 mb-6">
                <h3 className="text-stone-400 text-sm uppercase tracking-widest mb-3">This round</h3>
                <ul className="space-y-2">
                  {Object.entries(lastRound.points)
                    .filter(([, pts]) => pts > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([pid, pts]) => (
                      <li key={pid} className="flex items-center gap-2 text-sm">
                        <span className="text-white flex-1">
                          {gameState.players[pid]?.name ?? 'Unknown'}
                          {pid === playerId && <span className="text-stone-400 ml-1">(you)</span>}
                        </span>
                        <span className="text-green-400">+{pts}</span>
                      </li>
                    ))}
                  {Object.values(lastRound.points).every((pts) => pts === 0) && (
                    <li className="text-stone-500 text-sm">No one scored this round.</li>
                  )}
                </ul>
              </div>
            </>
          )}

          {/* Scoreboard */}
          <div className="bg-stone-800 rounded-2xl p-5 mb-6">
            <h3 className="text-stone-400 text-sm uppercase tracking-widest mb-3">Scoreboard</h3>
            <ul className="space-y-2">
              {sortedPlayers.map((p, i) => {
                const earned = lastRound?.points[p.id] ?? 0;
                return (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className="text-stone-500 text-sm w-5">{i + 1}.</span>
                    <span className="text-white flex-1">
                      {p.name}
                      {p.id === playerId && <span className="text-stone-400 text-sm ml-1">(you)</span>}
                    </span>
                    {earned > 0 && <span className="text-green-400 text-sm font-medium">+{earned}</span>}
                    <span className="text-white font-bold">{p.score}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {isHost ? (
            <button
              onClick={() => act('next')}
              disabled={isActing}
              className="w-full bg-purple-400 hover:bg-purple-300 text-stone-900 font-bold text-lg py-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLastRound ? 'See Final Results →' : 'Next Question →'}
            </button>
          ) : (
            <p className="text-center text-stone-400 text-sm">Waiting for host to continue...</p>
          )}
        </div>
      </div>
    );
  }

  // ─── Ended ─────────────────────────────────────────────────────────────────
  if (view === 'ended' && gameState) {
    const winners = gameState.game.winnerIds.map((id) => gameState.players[id]).filter(Boolean);
    const winnerNames = winners.map((w) => w.name);
    const topScore = winners[0]?.score ?? 0;
    const headline =
      winnerNames.length === 0
        ? 'Game over'
        : winnerNames.length === 1
        ? `${winnerNames[0]} wins!`
        : `${winnerNames.slice(0, -1).join(', ')} & ${winnerNames[winnerNames.length - 1]} tie for the win!`;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg text-center">
          <div className="mb-8">
            <div className="text-6xl mb-4">🏆</div>
            <h1 className="text-4xl font-extrabold text-white mb-2">{headline}</h1>
            {winnerNames.length > 0 && (
              <p className="text-stone-400">
                {winnerNames.length > 1 ? 'Top score' : 'Final score'}: {topScore} points
              </p>
            )}
          </div>

          <div className="bg-stone-800 rounded-2xl p-6 mb-8 text-left">
            <h2 className="text-stone-400 text-sm uppercase tracking-widest mb-4 text-center">
              Final Scores
            </h2>
            <ul className="space-y-3">
              {sortedPlayers.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="text-2xl w-8">
                    {gameState.game.winnerIds.includes(p.id)
                      ? '🥇'
                      : i === 1
                      ? '🥈'
                      : i === 2
                      ? '🥉'
                      : `${i + 1}.`}
                  </span>
                  <span className="text-white text-lg flex-1">
                    {p.name}
                    {p.id === playerId && <span className="text-stone-400 text-sm ml-1">(you)</span>}
                  </span>
                  <span className="text-white font-bold text-xl">{p.score}</span>
                </li>
              ))}
            </ul>
          </div>

          {gameState.crewSlug && (
            <div className="mb-8 text-left">
              <CrewLeaderboard slug={gameState.crewSlug} highlightMemberId={playerId} refreshKey={1} />
            </div>
          )}

          {isHost ? (
            <button
              onClick={() => act('reset')}
              disabled={isActing}
              className="w-full bg-purple-400 hover:bg-purple-300 text-stone-900 font-bold text-lg py-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            >
              Play Again
            </button>
          ) : (
            <p className="text-stone-400 mb-4">Waiting for host to start a new game...</p>
          )}
          <button
            onClick={() => router.push('/')}
            className="w-full bg-stone-700 hover:bg-stone-600 text-white font-medium py-3 rounded-xl transition-colors"
          >
            Back to Foxflame
          </button>
        </div>
      </div>
    );
  }

  return null;
}
