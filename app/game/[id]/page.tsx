'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPusherClient } from '@/lib/pusher-client';
import { ClientGameState } from '@/lib/types';

// Inline ID generation for client-side use (avoids importing server-safe lib/game.ts)
function generateClientId(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

type ViewState = 'loading' | 'not-found' | 'name-entry' | 'lobby' | 'answering' | 'revealed' | 'ended';

export default function GamePage() {
  const params = useParams();
  const gameId = params.id as string;
  const router = useRouter();

  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>('loading');
  const [nameInput, setNameInput] = useState('');
  const [answerInput, setAnswerInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const prevPhaseRef = useRef<string | null>(null);

  const apiPost = useCallback(
    async (endpoint: string, extraBody: Record<string, unknown> = {}) => {
      const res = await fetch(`/api/game/${endpoint}`, {
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

  // Fetch current state from server — called after every API action so the
  // triggering client never depends solely on receiving its own Pusher event back.
  const refreshGameState = useCallback(async () => {
    if (!playerId) return;
    try {
      const res = await fetch(`/api/state/${gameId}`);
      if (!res.ok) return;
      const state: ClientGameState = await res.json();
      const prevPhase = prevPhaseRef.current;
      prevPhaseRef.current = state.phase;
      setGameState(state);
      if (!state.players[playerId]) {
        setView('name-entry');
      } else {
        setView(state.phase as ViewState);
        if (state.phase === 'answering') {
          if (prevPhase !== 'answering') setAnswerInput('');
          setHasSubmitted(state.submittedIds.includes(playerId));
        }
      }
    } catch {
      // silently ignore — Pusher may still deliver the update
    }
  }, [gameId, playerId]);

  // Initialize player ID and fetch initial state
  useEffect(() => {
    if (!gameId) return;

    let pid = localStorage.getItem(`player_${gameId}`);
    if (!pid) {
      pid = generateClientId(6);
      localStorage.setItem(`player_${gameId}`, pid);
    }
    setPlayerId(pid);

    async function fetchState() {
      try {
        const res = await fetch(`/api/state/${gameId}`);
        if (res.status === 404) {
          setView('not-found');
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch state');
        const state: ClientGameState = await res.json();
        setGameState(state);

        if (!state.players[pid!]) {
          setView('name-entry');
        } else {
          setView(state.phase as ViewState);
          if (state.submittedIds.includes(pid!)) {
            setHasSubmitted(true);
          }
        }
      } catch {
        setView('not-found');
      }
    }

    fetchState();
  }, [gameId]);

  // Pusher subscription
  useEffect(() => {
    if (!gameId || !playerId) return;

    const pusher = getPusherClient();
    const channel = pusher.subscribe(`game-${gameId}`);

    channel.bind('state-update', (state: ClientGameState) => {
      const prevPhase = prevPhaseRef.current;
      prevPhaseRef.current = state.phase;

      setGameState(state);

      if (!state.players[playerId]) {
        setView('name-entry');
      } else {
        setView(state.phase as ViewState);
      }

      if (state.phase === 'answering') {
        if (prevPhase !== 'answering') {
          setAnswerInput('');
        }
        setHasSubmitted(state.submittedIds.includes(playerId));
      }
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`game-${gameId}`);
    };
  }, [gameId, playerId]);

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

  async function handleStart() {
    try {
      await apiPost('start');
    } catch (err) {
      console.error('Start failed:', err);
    }
  }

  async function handleSubmit() {
    if (!answerInput.trim() || hasSubmitted) return;
    setSubmitting(true);
    try {
      await apiPost('submit', { answer: answerInput.trim() });
      setHasSubmitted(true);
      await refreshGameState();
    } catch (err) {
      console.error('Submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReveal() {
    try {
      await apiPost('reveal');
      await refreshGameState();
    } catch (err) {
      console.error('Reveal failed:', err);
    }
  }

  async function handleNext() {
    try {
      await apiPost('next');
      await refreshGameState();
    } catch (err) {
      console.error('Next failed:', err);
    }
  }

  async function handleSkip() {
    try {
      await apiPost('skip');
      await refreshGameState();
    } catch (err) {
      console.error('Skip failed:', err);
    }
  }

  async function handleReset() {
    try {
      await apiPost('reset');
      await refreshGameState();
    } catch (err) {
      console.error('Reset failed:', err);
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

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading game...</p>
        </div>
      </div>
    );
  }

  // ─── Not Found ─────────────────────────────────────────────────────────────
  if (view === 'not-found') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-3">Game not found</h1>
          <p className="text-slate-400 mb-6">This game doesn&apos;t exist or has expired.</p>
          <a
            href="/"
            className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-6 py-3 rounded-xl transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  // ─── Name Entry ────────────────────────────────────────────────────────────
  if (view === 'name-entry') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-8">
          <p className="text-slate-400 text-sm text-center mb-1 font-mono tracking-widest uppercase">
            Game Code
          </p>
          <p className="text-amber-400 font-mono text-3xl font-bold text-center mb-6 tracking-widest">
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
            className="w-full bg-slate-700 text-white placeholder-slate-500 text-lg px-4 py-3 rounded-xl border border-slate-600 focus:outline-none focus:border-amber-400 mb-4"
          />
          {joinError && (
            <p className="text-red-400 text-sm mb-3">{joinError}</p>
          )}
          <button
            onClick={handleJoin}
            className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-lg py-3 rounded-xl transition-colors"
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  // ─── Lobby ─────────────────────────────────────────────────────────────────
  if (view === 'lobby' && gameState) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <h1 className="text-4xl font-extrabold text-white text-center mb-2">Sync or Swim</h1>
          <p className="text-slate-400 text-center mb-8">Waiting for players...</p>

          {/* Game Code */}
          <div className="bg-slate-800 rounded-2xl p-6 mb-6 text-center">
            <p className="text-slate-400 text-sm mb-2">Share this code to invite players</p>
            <p className="text-amber-400 font-mono text-5xl font-bold tracking-widest mb-4">
              {gameId}
            </p>
            <button
              onClick={copyLink}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {copied ? '✓ Copied!' : 'Copy invite link'}
            </button>
          </div>

          {/* Player List */}
          <div className="bg-slate-800 rounded-2xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-4">
              Players ({players.length})
            </h2>
            <ul className="space-y-2">
              {players.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full" />
                  <span className="text-white">{p.name}</span>
                  {p.id === playerId && (
                    <span className="text-slate-400 text-sm">(you)</span>
                  )}
                  {p.isHost && (
                    <span className="text-amber-400 text-xs font-semibold ml-1">(host)</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Start / Waiting */}
          {isHost ? (
            <button
              onClick={handleStart}
              disabled={players.length < 2}
              className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-lg py-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {players.length < 2 ? 'Waiting for more players...' : 'Start Game'}
            </button>
          ) : (
            <p className="text-center text-slate-400">Waiting for host to start...</p>
          )}
        </div>
      </div>
    );
  }

  // ─── Answering ─────────────────────────────────────────────────────────────
  if (view === 'answering' && gameState) {
    const roundNum = gameState.roundHistory.length + 1;

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {/* Round info */}
          <div className="flex justify-between items-center mb-6">
            <span className="text-slate-400 text-sm">Round {roundNum}</span>
            <span className="text-slate-500 text-sm">{gameState.cardsRemaining} cards left</span>
          </div>

          {/* Cue Card */}
          <div className="bg-slate-800 rounded-2xl p-10 mb-8 text-center shadow-2xl border border-slate-700">
            <p className="text-slate-400 text-xs uppercase tracking-widest mb-4">Fill in the blank</p>
            <p className="text-white text-4xl font-extrabold tracking-wider">
              {gameState.currentCard}
            </p>
          </div>

          {/* Answer Input */}
          <div className="mb-6">
            <input
              type="text"
              value={answerInput}
              onChange={(e) => setAnswerInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !hasSubmitted && handleSubmit()}
              placeholder="Your answer..."
              disabled={hasSubmitted}
              autoFocus
              className="w-full bg-slate-800 text-white placeholder-slate-500 text-xl px-5 py-4 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            />
            {!hasSubmitted ? (
              <button
                onClick={handleSubmit}
                disabled={!answerInput.trim() || submitting}
                className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-lg py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Answer'}
              </button>
            ) : (
              <div className="w-full bg-green-900/50 border border-green-600 text-green-300 text-center py-3 rounded-xl">
                Answer locked in! Waiting for others...
              </div>
            )}
          </div>

          {/* Player submission status */}
          <div className="bg-slate-800 rounded-xl p-4 mb-6">
            <p className="text-slate-400 text-xs uppercase tracking-widest mb-3">Waiting on</p>
            <div className="flex flex-wrap gap-2">
              {players.map((p) => {
                const submitted = gameState.submittedIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
                      submitted
                        ? 'bg-green-900/40 text-green-300'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    <span>{submitted ? '✓' : '⏳'}</span>
                    <span>{p.name}</span>
                    {p.id === playerId && <span className="text-xs opacity-60">(you)</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Host controls */}
          {isHost && (
            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-2.5 rounded-lg transition-colors text-sm border border-slate-600"
              >
                Skip Card
              </button>
              <button
                onClick={handleReveal}
                className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-2.5 rounded-lg transition-colors text-sm"
              >
                Reveal Answers
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Revealed ──────────────────────────────────────────────────────────────
  if (view === 'revealed' && gameState) {
    const lastRound = gameState.roundHistory[gameState.roundHistory.length - 1];
    const roundNum = gameState.roundHistory.length;

    // Group answers by normalized text
    type AnswerGroup = {
      answer: string;
      players: { name: string; id: string; points: number }[];
      points: number;
    };
    const groups: Record<string, AnswerGroup> = {};
    if (lastRound) {
      for (const entry of lastRound.answers) {
        const key = entry.answer.toLowerCase().trim();
        if (!groups[key]) {
          groups[key] = { answer: entry.answer, players: [], points: entry.points };
        }
        groups[key].players.push({ name: entry.playerName, id: entry.playerId, points: entry.points });
      }
    }
    const sortedGroups = Object.values(groups).sort((a, b) => b.points - a.points);

    // Calculate this-round points per player
    const roundPoints: Record<string, number> = {};
    if (lastRound) {
      for (const entry of lastRound.answers) {
        roundPoints[entry.playerId] = entry.points;
      }
    }

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <h2 className="text-3xl font-extrabold text-white text-center mb-2">
            Round {roundNum} Results
          </h2>

          {/* Cue card shown small */}
          {lastRound && (
            <div className="bg-slate-800 rounded-xl px-6 py-3 text-center mb-6 inline-block w-full">
              <span className="text-amber-400 font-mono font-bold text-xl tracking-widest">
                {lastRound.card}
              </span>
            </div>
          )}

          {/* Answer groups */}
          <div className="space-y-3 mb-8">
            {sortedGroups.map((group) => {
              const nameList = group.players.map((p) => p.name).join(' + ');
              const isThreePoint = group.points === 3;
              const isOnePoint = group.points === 1;

              let containerClass = 'bg-slate-700/50 border border-slate-600';
              if (isThreePoint) containerClass = 'bg-green-900/50 border border-green-500';
              if (isOnePoint) containerClass = 'bg-blue-900/50 border border-blue-500';

              return (
                <div key={group.answer} className={`rounded-xl px-5 py-4 ${containerClass}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-white font-semibold text-lg">&ldquo;{group.answer}&rdquo;</p>
                      <p className="text-sm mt-0.5">
                        {isThreePoint && (
                          <span className="text-green-300">
                            🎯 {nameList}
                          </span>
                        )}
                        {isOnePoint && (
                          <span className="text-blue-300">
                            {nameList}
                          </span>
                        )}
                        {!isThreePoint && !isOnePoint && (
                          <span className="text-slate-400">{nameList}</span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`font-bold text-lg shrink-0 ${
                        isThreePoint
                          ? 'text-green-300'
                          : isOnePoint
                          ? 'text-blue-300'
                          : 'text-slate-500'
                      }`}
                    >
                      {group.points} pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scoreboard */}
          <div className="bg-slate-800 rounded-2xl p-5 mb-6">
            <h3 className="text-slate-400 text-sm uppercase tracking-widest mb-3">Scoreboard</h3>
            <ul className="space-y-2">
              {sortedPlayers.map((p, i) => {
                const earned = roundPoints[p.id] ?? 0;
                return (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className="text-slate-500 text-sm w-5">{i + 1}.</span>
                    <span className="text-white flex-1">
                      {p.name}
                      {p.id === playerId && (
                        <span className="text-slate-400 text-sm ml-1">(you)</span>
                      )}
                    </span>
                    {earned > 0 && (
                      <span className="text-green-400 text-sm font-medium">+{earned}</span>
                    )}
                    <span className="text-white font-bold">{p.score}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Host: Next Card or End Game */}
          {isHost && (
            <button
              onClick={handleNext}
              className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-lg py-4 rounded-xl transition-colors"
            >
              {gameState.winnerId ? 'See Final Results →' : 'Next Card →'}
            </button>
          )}
          {!isHost && (
            <p className="text-center text-slate-400 text-sm">Waiting for host to continue...</p>
          )}
        </div>
      </div>
    );
  }

  // ─── Ended ─────────────────────────────────────────────────────────────────
  if (view === 'ended' && gameState) {
    const winner = gameState.winnerId ? gameState.players[gameState.winnerId] : null;

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg text-center">
          {/* Winner announcement */}
          <div className="mb-8">
            <div className="text-6xl mb-4">🏆</div>
            <h1 className="text-4xl font-extrabold text-white mb-2">
              {winner?.name ?? 'Someone'} wins!
            </h1>
            <p className="text-slate-400">
              Final score: {winner?.score} points
            </p>
          </div>

          {/* Final Scoreboard */}
          <div className="bg-slate-800 rounded-2xl p-6 mb-8 text-left">
            <h2 className="text-slate-400 text-sm uppercase tracking-widest mb-4 text-center">
              Final Scores
            </h2>
            <ul className="space-y-3">
              {sortedPlayers.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="text-2xl w-8">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                  </span>
                  <span className="text-white text-lg flex-1">
                    {p.name}
                    {p.id === playerId && (
                      <span className="text-slate-400 text-sm ml-1">(you)</span>
                    )}
                  </span>
                  <span className="text-white font-bold text-xl">{p.score}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          {isHost ? (
            <button
              onClick={handleReset}
              className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-lg py-4 rounded-xl transition-colors mb-3"
            >
              Play Again
            </button>
          ) : (
            <p className="text-slate-400 mb-4">Waiting for host to start a new game...</p>
          )}
          <button
            onClick={() => router.push('/')}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 rounded-xl transition-colors"
          >
            New Game
          </button>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
