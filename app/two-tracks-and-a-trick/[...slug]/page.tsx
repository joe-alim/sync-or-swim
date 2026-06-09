'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPusherClient } from '@/lib/pusher-client';
import { generateId } from '@/lib/ids';
import { ClientRoom } from '@/lib/games/types';
import { ClientTwoTracksGame } from '@/lib/games/two-tracks-and-a-trick/types';
import { getCrewIdentity, setCrewIdentity } from '@/lib/crew-client';
import { CrewLeaderboard } from '@/components/CrewLeaderboard';

const SLUG = 'two-tracks-and-a-trick';
const MIN_PLAYERS = 3;

type RoomState = ClientRoom<ClientTwoTracksGame>;
type ViewState =
  | 'loading'
  | 'not-found'
  | 'name-entry'
  | 'crew-entry'
  | 'lobby'
  | 'writing'
  | 'guessing'
  | 'revealed'
  | 'ended';

export default function TwoTracksGamePage() {
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

  // Write-your-set form (two truths + one lie).
  const [stmts, setStmts] = useState<string[]>(['', '', '']);
  const [lieIdx, setLieIdx] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
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
        // Reset the write form whenever a fresh writing phase opens.
        if (state.phase === 'writing' && prevPhase !== 'writing') {
          setStmts(['', '', '']);
          setLieIdx(null);
          setFormError('');
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

  async function handleSubmitSet() {
    const cleaned = stmts.map((s) => s.trim());
    if (cleaned.some((s) => !s)) return setFormError('Fill in all three statements.');
    if (lieIdx === null) return setFormError('Mark which one is the lie.');
    setFormError('');
    if (isActing) return;
    setIsActing(true);
    try {
      await apiPost('submit', { statements: cleaned, lieIndex: lieIdx });
      await refreshGameState();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setIsActing(false);
    }
  }

  async function handleGuess(index: number) {
    await act('guess', { guessIndex: index });
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
          <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
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
            className="bg-orange-400 hover:bg-orange-300 text-stone-900 font-bold px-6 py-3 rounded-xl transition-colors"
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
          <p className="text-orange-400 font-mono text-3xl font-bold text-center mb-6 tracking-widest">
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
            className="w-full bg-stone-700 text-white placeholder-stone-500 text-lg px-4 py-3 rounded-xl border border-stone-600 focus:outline-none focus:border-orange-400 mb-4"
          />
          {joinError && <p className="text-red-400 text-sm mb-3">{joinError}</p>}
          <button
            onClick={handleJoin}
            className="w-full bg-orange-400 hover:bg-orange-300 text-stone-900 font-bold text-lg py-3 rounded-xl transition-colors"
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
          <p className="text-orange-400 font-mono text-2xl font-bold text-center mb-2 tracking-widest">
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
            className="w-full bg-stone-700 text-white placeholder-stone-500 text-lg px-4 py-3 rounded-xl border border-stone-600 focus:outline-none focus:border-orange-400 mb-3"
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
            className="w-full bg-stone-700 text-white placeholder-stone-500 text-lg px-4 py-3 rounded-xl border border-stone-600 focus:outline-none focus:border-orange-400 font-mono tracking-[0.5em] text-center mb-4"
          />
          {joinError && <p className="text-red-400 text-sm mb-3">{joinError}</p>}
          <button
            onClick={handleCrewJoin}
            className="w-full bg-orange-400 hover:bg-orange-300 text-stone-900 font-bold text-lg py-3 rounded-xl transition-colors"
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
          <h1 className="text-4xl font-extrabold text-white text-center mb-2">
            Two Tracks and a Trick
          </h1>
          <p className="text-stone-400 text-center mb-8">Waiting for players...</p>

          <div className="bg-stone-800 rounded-2xl p-6 mb-6 text-center">
            <p className="text-stone-400 text-sm mb-2">Share this code to invite players</p>
            <p className="text-orange-400 font-mono text-5xl font-bold tracking-widest mb-4">
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
                    <span className="text-orange-400 text-xs font-semibold ml-1">(host)</span>
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
              className="w-full bg-orange-400 hover:bg-orange-300 text-stone-900 font-bold text-lg py-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

  const hasSet = gameState ? gameState.game.submittedIds.includes(playerId ?? '') : false;

  // Shared write-your-set form (used in `writing` and by mid-pass late joiners).
  const writeForm = (intro: string) => (
    <div className="w-full max-w-lg">
      <h2 className="text-3xl font-extrabold text-white text-center mb-1">Two truths, one trick</h2>
      <p className="text-stone-400 text-center mb-6">{intro}</p>

      <div className="space-y-3 mb-4">
        {stmts.map((s, i) => (
          <div
            key={i}
            className={`rounded-xl border p-3 transition-colors ${
              lieIdx === i ? 'border-orange-400 bg-orange-950/30' : 'border-stone-700 bg-stone-800'
            }`}
          >
            <textarea
              value={s}
              onChange={(e) => {
                const next = [...stmts];
                next[i] = e.target.value.slice(0, 140);
                setStmts(next);
                setFormError('');
              }}
              placeholder={`Statement ${i + 1}`}
              rows={2}
              className="w-full bg-transparent text-white placeholder-stone-500 text-lg focus:outline-none resize-none"
            />
            <button
              type="button"
              onClick={() => {
                setLieIdx(i);
                setFormError('');
              }}
              className={`mt-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                lieIdx === i
                  ? 'bg-orange-400 text-stone-900'
                  : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
              }`}
            >
              {lieIdx === i ? '🦊 This is the lie' : 'Mark as the lie'}
            </button>
          </div>
        ))}
      </div>

      {formError && <p className="text-red-400 text-sm mb-3">{formError}</p>}

      <button
        onClick={handleSubmitSet}
        disabled={isActing}
        className="w-full bg-orange-400 hover:bg-orange-300 text-stone-900 font-bold text-lg py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isActing ? 'Locking in...' : 'Lock in my set'}
      </button>
    </div>
  );

  // ─── Writing ───────────────────────────────────────────────────────────────
  if (view === 'writing' && gameState) {
    const submittedCount = players.filter((p) =>
      gameState.game.submittedIds.includes(p.id)
    ).length;
    const waitingCount = players.length - submittedCount;
    const allSubmitted = players.length > 0 && waitingCount === 0;
    const canBegin = submittedCount >= MIN_PLAYERS;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
        {!hasSet ? (
          writeForm('Write three statements about yourself — two true, one a convincing lie.')
        ) : (
          <div className="w-full max-w-lg">
            <div className="bg-green-900/50 border border-green-600 text-green-300 text-center py-4 rounded-xl mb-6">
              Your set is locked in! Waiting for everyone to finish...
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
                  onClick={() => act('begin')}
                  disabled={!canBegin || isActing}
                  className="w-full bg-orange-400 hover:bg-orange-300 text-stone-900 font-bold text-lg py-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!canBegin
                    ? `Need at least ${MIN_PLAYERS} sets...`
                    : allSubmitted
                    ? 'Begin guessing →'
                    : `Start without ${waitingCount} waiting →`}
                </button>
                {canBegin && !allSubmitted && (
                  <p className="text-center text-stone-500 text-xs mt-2">
                    Players who haven&apos;t written a set will be dropped, but can rejoin and
                    catch up mid-game.
                  </p>
                )}
              </>
            ) : (
              <p className="text-center text-stone-400">Waiting for host to begin...</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Guessing ────────────────────────────────────────────────────────────────
  if (view === 'guessing' && gameState && gameState.game.currentSubject) {
    const subject = gameState.game.currentSubject;
    const isSubject = subject.subjectId === playerId;
    const isEligible = gameState.game.eligibleIds.includes(playerId ?? '');
    const hasGuessed = gameState.game.guessedIds.includes(playerId ?? '');
    const roundNum = gameState.game.roundIndex + 1;
    const totalRounds = gameState.game.totalRounds;

    // Late joiner who still owes a set — let them catch up for the next round.
    if (!hasSet) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
          {writeForm("You're in! Write your set now — you'll join the guessing next round.")}
        </div>
      );
    }

    const waitingNames = gameState.game.eligibleIds
      .filter((id) => !gameState.game.guessedIds.includes(id))
      .map((id) => gameState.players[id]?.name ?? '?');

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="flex justify-between items-center mb-4">
            <span className="text-stone-400 text-sm">
              Round {roundNum} of {totalRounds}
            </span>
            <span className="text-stone-500 text-sm">Spot the trick 🦊</span>
          </div>

          <div className="text-center mb-6">
            <p className="text-stone-400 text-sm">Whose set</p>
            <p className="text-white text-2xl font-extrabold">
              {subject.subjectName}
              {isSubject && <span className="text-orange-400 text-base ml-2">(you)</span>}
            </p>
          </div>

          <div className="space-y-3 mb-6">
            {subject.statements.map((text, i) => {
              const tappable = isEligible && !hasGuessed && !isSubject;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!tappable || isActing}
                  onClick={() => tappable && handleGuess(i)}
                  className={`w-full text-left rounded-xl border px-5 py-4 transition-colors ${
                    tappable
                      ? 'border-stone-700 bg-stone-800 hover:border-orange-400 hover:bg-stone-700 cursor-pointer'
                      : 'border-stone-700 bg-stone-800 cursor-default'
                  }`}
                >
                  <span className="text-stone-500 text-sm mr-2">{i + 1}.</span>
                  <span className="text-white text-lg">{text}</span>
                </button>
              );
            })}
          </div>

          {/* Role-specific status */}
          {isSubject ? (
            <div className="bg-stone-800 border border-stone-700 text-stone-300 text-center py-3 rounded-xl mb-4">
              Your set is up! Sit tight while everyone hunts for your trick.
            </div>
          ) : !isEligible ? (
            <div className="bg-stone-800 border border-stone-700 text-stone-300 text-center py-3 rounded-xl mb-4">
              You&apos;ll start guessing next round.
            </div>
          ) : hasGuessed ? (
            <div className="bg-green-900/50 border border-green-600 text-green-300 text-center py-3 rounded-xl mb-4">
              Guess locked in! Waiting for others...
            </div>
          ) : (
            <p className="text-center text-stone-400 mb-4">Tap the statement you think is the lie.</p>
          )}

          {/* Waiting-on list */}
          {waitingNames.length > 0 && (
            <p className="text-center text-stone-500 text-sm mb-4">
              Waiting on: {waitingNames.join(', ')}
            </p>
          )}

          {/* Host: reveal early */}
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

  // ─── Revealed ────────────────────────────────────────────────────────────────
  if (view === 'revealed' && gameState) {
    const lastRound = gameState.game.roundHistory[gameState.game.roundHistory.length - 1];
    const isLastRound = gameState.game.roundIndex + 1 >= gameState.game.totalRounds;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {lastRound && (
            <>
              <h2 className="text-3xl font-extrabold text-white text-center mb-1">
                {lastRound.subjectName}&apos;s trick
              </h2>
              <p className="text-stone-400 text-center mb-6">The lie is revealed 🦊</p>

              <div className="space-y-3 mb-6">
                {lastRound.statements.map((text, i) => {
                  const isLie = i === lastRound.lieIndex;
                  const guessers = lastRound.guesses.filter((g) => g.guessIndex === i);
                  return (
                    <div
                      key={i}
                      className={`rounded-xl border px-5 py-4 ${
                        isLie
                          ? 'border-red-500 bg-red-950/40'
                          : 'border-green-600/60 bg-green-950/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-white text-lg">
                          <span className="text-stone-500 text-sm mr-2">{i + 1}.</span>
                          {text}
                        </p>
                        <span
                          className={`shrink-0 text-xs font-bold uppercase tracking-wide px-2 py-1 rounded ${
                            isLie ? 'bg-red-500 text-white' : 'bg-green-600/70 text-white'
                          }`}
                        >
                          {isLie ? 'The lie' : 'Truth'}
                        </span>
                      </div>
                      {guessers.length > 0 && (
                        <p className="text-stone-400 text-sm mt-2">
                          Guessed by: {guessers.map((g) => g.playerName).join(', ')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Round scoring breakdown */}
              <div className="bg-stone-800 rounded-2xl p-5 mb-6">
                <h3 className="text-stone-400 text-sm uppercase tracking-widest mb-3">This round</h3>
                <ul className="space-y-2">
                  {lastRound.guesses.map((g) => (
                    <li key={g.playerId} className="flex items-center gap-2 text-sm">
                      <span>{g.correct ? '🎯' : '🙈'}</span>
                      <span className="text-white flex-1">
                        {g.playerName}
                        {g.playerId === playerId && (
                          <span className="text-stone-400 ml-1">(you)</span>
                        )}
                      </span>
                      <span className={g.correct ? 'text-green-400' : 'text-stone-500'}>
                        {g.correct ? 'caught it +1' : 'fooled'}
                      </span>
                    </li>
                  ))}
                  <li className="flex items-center gap-2 text-sm pt-2 border-t border-stone-700">
                    <span>🦊</span>
                    <span className="text-white flex-1">
                      {lastRound.subjectName}
                      {lastRound.subjectId === playerId && (
                        <span className="text-stone-400 ml-1">(you)</span>
                      )}
                      <span className="text-stone-500"> (author)</span>
                    </span>
                    <span className="text-orange-400">
                      +{lastRound.points[lastRound.subjectId] ?? 0} fooled
                    </span>
                  </li>
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
              className="w-full bg-orange-400 hover:bg-orange-300 text-stone-900 font-bold text-lg py-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLastRound ? 'See Final Results →' : 'Next Player →'}
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
    const winners = gameState.game.winnerIds
      .map((id) => gameState.players[id])
      .filter(Boolean);
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
              className="w-full bg-orange-400 hover:bg-orange-300 text-stone-900 font-bold text-lg py-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
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
