'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPusherClient } from '@/lib/pusher-client';
import { generateId } from '@/lib/ids';
import { ClientRoom } from '@/lib/games/types';
import { ClientSmokeSignalsGame, SSMove } from '@/lib/games/smoke-signals/types';
import { CardId, CARDS, CARD_ORDER } from '@/lib/games/smoke-signals/cards';
import { SmokeSignalsCard } from '@/components/SmokeSignalsCard';
import { getCrewIdentity, setCrewIdentity } from '@/lib/crew-client';
import { CrewLeaderboard } from '@/components/CrewLeaderboard';
import { SmokeSignalsRules } from '@/components/SmokeSignalsRules';
import { SmokeSignalsCardReference } from '@/components/SmokeSignalsCardReference';

type RoomState = ClientRoom<ClientSmokeSignalsGame>;

// What extra input a card needs once chosen (drives the targeting panel).
function cardNeeds(card: CardId): {
  target?: 'one' | 'self' | 'two' | 'multi';
  number?: boolean;
} {
  switch (card) {
    case 'guard':
      return { target: 'one', number: true };
    case 'bishop':
      return { target: 'one', number: true };
    case 'priest':
    case 'baron':
    case 'dowager-queen':
    case 'king':
    case 'jester':
      return { target: 'one' };
    case 'prince':
    case 'sycophant':
      return { target: 'self' };
    case 'cardinal':
      return { target: 'two' };
    case 'baroness':
      return { target: 'multi' };
    default:
      return {};
  }
}

export default function SmokeSignalsGamePage() {
  const params = useParams();
  const router = useRouter();

  const slugParts = (params.slug as string[]) ?? [];
  const gameId = slugParts[slugParts.length - 1];
  const pathTail = slugParts.join('/');

  const [gameState, setGameState] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const secretRef = useRef<string | null>(null);
  const [view, setView] = useState<
    'loading' | 'not-found' | 'name-entry' | 'crew-entry' | 'play'
  >('loading');
  const [nameInput, setNameInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showRef, setShowRef] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // Card-play selection state
  const [selectedCard, setSelectedCard] = useState<CardId | null>(null);
  const [targetSel, setTargetSel] = useState<string[]>([]);
  const [numberSel, setNumberSel] = useState<number | null>(null);
  const [cardinalPeek, setCardinalPeek] = useState<string | null>(null);

  const resetSelection = useCallback(() => {
    setSelectedCard(null);
    setTargetSel([]);
    setNumberSel(null);
    setCardinalPeek(null);
    setActionError('');
  }, []);

  const apiPost = useCallback(
    async (endpoint: string, extraBody: Record<string, unknown> = {}) => {
      const res = await fetch(`/api/smoke-signals/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId, secret: secretRef.current, ...extraBody }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Request failed');
      }
      return res.json();
    },
    [gameId, playerId]
  );

  // Fetch state, sending identity via headers so the server reveals our hand.
  const refreshGameState = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (playerId) headers['x-player-id'] = playerId;
      if (secretRef.current) headers['x-player-secret'] = secretRef.current;
      const res = await fetch(`/api/state/${gameId}`, { headers });
      if (!res.ok) return;
      const state: RoomState = await res.json();
      setGameState(state);
      if (playerId && !state.players[playerId]) {
        setView(state.crewSlug ? 'crew-entry' : 'name-entry');
      } else if (playerId) {
        setView('play');
      }
    } catch {
      // Pusher may still deliver the update
    }
  }, [gameId, playerId]);

  const joinRoom = useCallback(
    async (pid: string, name: string) => {
      const res = await fetch(`/api/smoke-signals/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId: pid, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to join');
      if (data.secret) {
        secretRef.current = data.secret;
        localStorage.setItem(`ss_secret_${gameId}`, data.secret);
      }
      return data;
    },
    [gameId]
  );

  // Resolve identity + initial state (mirrors the crew/anonymous pattern).
  useEffect(() => {
    if (!gameId) return;
    async function init() {
      let state: RoomState;
      try {
        const res = await fetch(`/api/state/${gameId}`);
        if (res.status === 404) return setView('not-found');
        if (!res.ok) throw new Error('bad');
        state = await res.json();
      } catch {
        return setView('not-found');
      }
      setGameState(state);

      if (state.crewSlug) {
        const identity = getCrewIdentity(state.crewSlug);
        if (!identity) return setView('crew-entry');
        const pid = identity.memberId;
        localStorage.setItem(`player_${gameId}`, pid);
        secretRef.current = localStorage.getItem(`ss_secret_${gameId}`);
        setPlayerId(pid);
        if (!state.players[pid] || !secretRef.current) {
          try {
            await joinRoom(pid, identity.name);
          } catch {
            return setView('crew-entry');
          }
        }
        setView('play');
        return;
      }

      let pid = localStorage.getItem(`player_${gameId}`);
      if (!pid) {
        pid = generateId(6);
        localStorage.setItem(`player_${gameId}`, pid);
      }
      secretRef.current = localStorage.getItem(`ss_secret_${gameId}`);
      setPlayerId(pid);
      setView(state.players[pid] ? 'play' : 'name-entry');
    }
    init();
  }, [gameId, joinRoom]);

  // Canonical crew URL
  useEffect(() => {
    if (!gameState) return;
    const desired = gameState.crewSlug ? `${gameState.crewSlug}/${gameId}` : gameId;
    if (pathTail !== desired) router.replace(`/smoke-signals/${desired}`);
  }, [gameState, gameId, pathTail, router]);

  // Pusher
  useEffect(() => {
    if (!gameId || !playerId) return;
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`game-${gameId}`);
    pusher.connection.bind('connected', refreshGameState);
    channel.bind('state-update', refreshGameState);
    refreshGameState();
    return () => {
      pusher.connection.unbind('connected', refreshGameState);
      channel.unbind_all();
      pusher.unsubscribe(`game-${gameId}`);
    };
  }, [gameId, playerId, refreshGameState]);

  async function handleJoin() {
    if (!nameInput.trim()) return setJoinError('Please enter a name.');
    setJoinError('');
    try {
      await joinRoom(playerId!, nameInput.trim());
      await refreshGameState();
      setView('play');
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
      setCrewIdentity(crewSlug, { memberId: data.memberId, name: data.name });
      localStorage.setItem(`player_${gameId}`, data.memberId);
      setPlayerId(data.memberId);
      await joinRoom(data.memberId, data.name);
      await refreshGameState();
      setView('play');
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join');
    }
  }

  async function act(endpoint: string, body: Record<string, unknown> = {}) {
    if (isActing) return;
    setIsActing(true);
    setActionError('');
    try {
      await apiPost(endpoint, body);
      await refreshGameState();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
      await refreshGameState();
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

  const g = gameState?.game;
  const isHost = playerId === gameState?.hostId;
  const players = gameState ? Object.values(gameState.players) : [];

  // ── Simple screens ─────────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <Centered>
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
      </Centered>
    );
  }
  if (view === 'not-found') {
    return (
      <Centered>
        <div className="text-center">
          <h1 className="mb-3 text-3xl font-bold text-white">Game not found</h1>
          <a href="/" className="font-bold text-red-300 hover:underline">Back to Foxflame</a>
        </div>
      </Centered>
    );
  }
  if (view === 'name-entry') {
    return (
      <JoinForm
        title="Smoke Signals" code={gameId} value={nameInput} error={joinError}
        onChange={(v) => { setNameInput(v.slice(0, 20)); setJoinError(''); }}
        onSubmit={handleJoin} cta="Join"
      />
    );
  }
  if (view === 'crew-entry' && gameState?.crewSlug) {
    return (
      <Centered>
        <div className="w-full max-w-sm rounded-2xl bg-stone-800 p-8">
          <p className="mb-2 text-center font-mono text-2xl font-bold tracking-widest text-red-300">
            {gameState.crewSlug}
          </p>
          <p className="mb-6 text-center text-sm text-stone-400">
            New name? Pick a PIN. Returning? Enter your PIN.
          </p>
          <input
            value={nameInput} placeholder="Your name" autoFocus
            onChange={(e) => { setNameInput(e.target.value.slice(0, 24)); setJoinError(''); }}
            className="mb-3 w-full rounded-xl border border-stone-600 bg-stone-700 px-4 py-3 text-lg text-white placeholder-stone-500 focus:border-red-500 focus:outline-none"
          />
          <input
            value={pinInput} placeholder="4-digit PIN" inputMode="numeric" maxLength={4}
            onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setJoinError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleCrewJoin()}
            className="mb-4 w-full rounded-xl border border-stone-600 bg-stone-700 px-4 py-3 text-center font-mono text-lg tracking-[0.5em] text-white placeholder-stone-500 focus:border-red-500 focus:outline-none"
          />
          {joinError && <p className="mb-3 text-sm text-red-400">{joinError}</p>}
          <button onClick={handleCrewJoin} className="w-full rounded-xl bg-red-600 py-3 text-lg font-bold text-white hover:bg-red-500">
            Join crew game
          </button>
        </div>
      </Centered>
    );
  }

  if (!gameState || !g) return null;

  // ── Lobby ────────────────────────────────────────────────────────────────
  if (gameState.phase === 'lobby') {
    const count = players.length;
    const version = count >= 5 ? 'Premium (32 cards)' : 'Regular (16 cards)';
    return (
      <Centered>
        <div className="w-full max-w-lg">
          <h1 className="mb-1 text-center text-4xl font-extrabold text-white">Smoke Signals</h1>
          <p className="mb-4 text-center text-stone-400">Gather round the fire…</p>
          <div className="mb-6 flex justify-center gap-2">
            <button
              onClick={() => setShowRules(true)}
              className="rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-sm font-semibold text-stone-200 hover:bg-stone-700"
            >
              📜 How to play
            </button>
            <button
              onClick={() => setShowRef(true)}
              className="rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-sm font-semibold text-stone-200 hover:bg-stone-700"
            >
              📖 View cards
            </button>
          </div>
          <div className="mb-6 rounded-2xl bg-stone-800 p-6 text-center">
            <p className="mb-2 text-sm text-stone-400">Share this code</p>
            <p className="mb-4 font-mono text-5xl font-bold tracking-widest text-red-300">{gameId}</p>
            <button onClick={copyLink} className="rounded-lg bg-stone-700 px-4 py-2 text-sm text-white hover:bg-stone-600">
              {copied ? '✓ Copied!' : 'Copy invite link'}
            </button>
          </div>
          <div className="mb-6 rounded-2xl bg-stone-800 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-white">Players ({count})</h2>
              <span className="text-xs text-stone-400">{count >= 2 ? version : '2–8 players'}</span>
            </div>
            <ul className="space-y-2">
              {players.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  <span className="font-[family-name:var(--font-cinzel)] text-lg tracking-wide text-white">{p.name}</span>
                  {p.id === playerId && <span className="text-sm text-stone-400">(you)</span>}
                  {p.isHost && <span className="ml-1 text-xs font-semibold text-red-300">(host)</span>}
                </li>
              ))}
            </ul>
          </div>
          {gameState.crewSlug && (
            <div className="mb-6"><CrewLeaderboard slug={gameState.crewSlug} highlightMemberId={playerId} /></div>
          )}
          {isHost ? (
            <button
              onClick={() => act('start')} disabled={count < 2 || isActing}
              className="w-full rounded-xl bg-red-600 py-4 text-lg font-bold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {count < 2 ? 'Waiting for more players…' : 'Start Game'}
            </button>
          ) : (
            <p className="text-center text-stone-400">Waiting for host to start…</p>
          )}
          {actionError && <p className="mt-3 text-center text-sm text-red-400">{actionError}</p>}
        </div>
        {showRef && <SmokeSignalsCardReference version="all" onClose={() => setShowRef(false)} />}
        {showRules && (
          <SmokeSignalsRules
            version={count >= 5 ? 'premium' : 'regular'}
            playerCount={count}
            onClose={() => setShowRules(false)}
          />
        )}
      </Centered>
    );
  }

  // ── Shared play-area data ──────────────────────────────────────────────────
  const me = playerId ? g.states[playerId] : undefined;
  const myHand = me?.hand ?? [];
  const isMyTurn = g.currentTurn === playerId && gameState.phase === 'playing';
  const canPlay = isMyTurn && myHand.length === 2 && !g.pending;
  const pendingMine = g.pending?.kind === 'bishop-redraw' && g.pending.playerId === playerId;

  // Legal targets for the selected card, evaluated client-side (server re-checks).
  function legalTargets(card: CardId): string[] {
    const needs = cardNeeds(card);
    const includeSelf = needs.target === 'self' || needs.target === 'two';
    return g!.turnOrder.filter((id) => {
      const s = g!.states[id];
      if (!s || s.isOut) return false;
      if (id === playerId) return includeSelf;
      return !s.protected;
    });
  }

  function submitPlay() {
    if (!selectedCard) return;
    const needs = cardNeeds(selectedCard);
    const move: SSMove = { card: selectedCard };
    const legal = legalTargets(selectedCard);

    if (needs.target && legal.length > 0) {
      if (needs.target === 'two') {
        if (targetSel.length !== 2) return setActionError('Pick two players.');
        if (!cardinalPeek) return setActionError('Pick whose hand to peek.');
        move.cardinalTargets = [targetSel[0], targetSel[1]];
        move.cardinalPeek = cardinalPeek;
      } else if (needs.target === 'multi') {
        if (targetSel.length < 1) return setActionError('Pick 1 or 2 players.');
        move.baronessTargets = targetSel;
      } else {
        if (targetSel.length !== 1) return setActionError('Pick a player.');
        move.targetId = targetSel[0];
      }
    }
    if (needs.number) {
      if (numberSel == null) return setActionError('Name a number.');
      move.namedValue = numberSel;
    }
    resetSelection();
    act('play', { move });
  }

  const valueChoices = (forGuard: boolean) => {
    const key = g.version === 'regular' ? 'regular' : 'premium';
    const vals = new Set<number>();
    for (const id of CARD_ORDER) if (CARDS[id][key] > 0) vals.add(CARDS[id].value);
    return [...vals].sort((a, b) => a - b).filter((v) => (forGuard ? v !== 1 : true));
  };

  // ── Play / round-end / game-end share the table layout ─────────────────────
  const winner = g.gameWinnerId ? gameState.players[g.gameWinnerId] : null;

  return (
    <div className="ss-elevated min-h-screen px-4 py-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Smoke Signals</h1>
            <p className="text-xs text-stone-400">
              Round {g.roundNumber} · {g.version} · first to {g.tokensToWin} tokens · {g.deckCount} in deck
            </p>
          </div>
          <div className="flex items-center gap-3">
            {gameState.phase === 'playing' && (
              isMyTurn ? (
                <span className="ss-turn-pop inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  Your turn
                </span>
              ) : (
                <p className="text-sm text-stone-400">
                  {`${gameState.players[g.currentTurn ?? '']?.name ?? '—'}'s turn`}
                </p>
              )
            )}
            <button
              onClick={() => setShowRules(true)}
              className="rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-sm font-semibold text-stone-200 hover:bg-stone-700"
            >
              📜 Rules
            </button>
            <button
              onClick={() => setShowRef(true)}
              className="rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-sm font-semibold text-stone-200 hover:bg-stone-700"
            >
              📖 Cards
            </button>
          </div>
        </div>

        {/* Opponents / table */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {g.turnOrder.map((id) => {
            const p = gameState.players[id];
            const s = g.states[id];
            if (!p || !s) return null;
            const isTurn = g.currentTurn === id;
            const peeked = g.peeks[id]; // card we (the viewer) peeked at this player
            const selectable =
              !!selectedCard && legalTargets(selectedCard).includes(id) && canPlay;
            const chosen = targetSel.includes(id);
            return (
              <button
                key={id}
                disabled={!selectable}
                onClick={() => {
                  if (!selectedCard) return;
                  const needs = cardNeeds(selectedCard);
                  if (needs.target === 'two' || needs.target === 'multi') {
                    const max = needs.target === 'two' ? 2 : 2;
                    setTargetSel((cur) =>
                      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < max ? [...cur, id] : cur
                    );
                  } else {
                    setTargetSel([id]);
                  }
                }}
                className={[
                  'rounded-xl border p-3 text-left transition-colors',
                  isTurn ? 'border-red-500/70 bg-stone-800' : 'border-stone-700 bg-stone-800/60',
                  s.isOut ? 'opacity-45' : '',
                  selectable ? 'cursor-pointer ring-2 ring-red-500/40 hover:bg-stone-700' : 'cursor-default',
                  chosen ? 'ring-2 ring-red-500' : '',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-[family-name:var(--font-cinzel)] text-lg font-semibold tracking-wide text-stone-100">
                    {p.name}{id === playerId ? ' (you)' : ''}
                  </span>
                  <span className="shrink-0 rounded-full bg-red-600/90 px-2 text-xs font-bold text-white">
                    {p.score} ♥
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-stone-400">
                  {s.isOut ? <span className="text-red-400">out</span> : <span>{s.handCount} in hand</span>}
                  {s.protected && <span className="text-sky-300">protected</span>}
                  {g.jesterBets[id] && <span className="text-fuchsia-300">jester→{gameState.players[g.jesterBets[id]]?.name}</span>}
                </div>
                {/* discard pile (latest few) */}
                {s.discard.length > 0 && (
                  <div className="mt-1 truncate text-[10px] text-stone-500">
                    {s.discard.map((c) => CARDS[c].value).join(' · ')}
                  </div>
                )}
                {peeked && (
                  <div className="mt-1 rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] text-emerald-300">
                    you saw: {CARDS[peeked].name}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Banner: round-end / game-end */}
        {gameState.phase === 'game-end' && (
          <Banner>
            <div className="text-center">
              <div className="mb-2 text-5xl">🏆</div>
              <h2 className="text-3xl font-extrabold text-white">{winner?.name ?? 'Someone'} wins the heart!</h2>
              <p className="text-stone-400">{winner?.score} tokens of affection</p>
            </div>
            {isHost ? (
              <button onClick={() => act('reset')} disabled={isActing}
                className="mt-4 w-full rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-500 disabled:opacity-50">
                Play again
              </button>
            ) : (
              <p className="mt-4 text-center text-stone-400">Waiting for host…</p>
            )}
          </Banner>
        )}
        {gameState.phase === 'round-end' && (
          <Banner>
            <h2 className="mb-1 text-center text-xl font-bold text-white">
              {g.roundWinnerIds.map((id) => gameState.players[id]?.name).join(' & ') || 'No one'} won the round
            </h2>
            <p className="mb-3 text-center text-sm text-stone-400">A token of affection is awarded.</p>
            {isHost ? (
              <button onClick={() => act('next')} disabled={isActing}
                className="w-full rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-500 disabled:opacity-50">
                Deal next round →
              </button>
            ) : (
              <p className="text-center text-stone-400">Waiting for host to deal…</p>
            )}
          </Banner>
        )}

        {/* Bishop pending decision (for the revealed player) */}
        {pendingMine && (
          <Banner>
            <p className="mb-3 text-center text-white">The Bishop revealed your hand. Discard and draw a new card?</p>
            <div className="flex gap-3">
              <button onClick={() => act('decision', { redraw: false })} disabled={isActing}
                className="flex-1 rounded-xl bg-stone-700 py-3 font-semibold text-white hover:bg-stone-600 disabled:opacity-50">
                Keep
              </button>
              <button onClick={() => act('decision', { redraw: true })} disabled={isActing}
                className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-500 disabled:opacity-50">
                Discard &amp; redraw
              </button>
            </div>
          </Banner>
        )}

        {/* My hand + play controls */}
        {(gameState.phase === 'playing' || gameState.phase === 'round-end') && me && !me.isOut && (
          <div className="rounded-2xl border border-stone-700 bg-stone-900/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-300">Your hand</h3>
              {g.sycophantTarget && (
                <span className="text-xs text-fuchsia-300">
                  Sycophant: next targeting card must include {gameState.players[g.sycophantTarget]?.name}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {myHand.map((c, i) => (
                <button
                  key={`${c}-${i}`}
                  disabled={!canPlay}
                  onClick={() => { resetSelection(); setSelectedCard(c); }}
                  className={[
                    'w-44 rounded-2xl transition-transform sm:w-52',
                    canPlay ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default',
                    selectedCard === c ? 'ring-2 ring-red-500' : '',
                  ].join(' ')}
                >
                  <SmokeSignalsCard card={CARDS[c]} />
                </button>
              ))}
              {myHand.length === 0 && <p className="text-sm text-stone-500">No cards.</p>}
            </div>

            {/* Targeting / confirm panel */}
            {selectedCard && canPlay && (
              <div className="mt-4 rounded-xl border border-stone-700 bg-stone-800/70 p-3">
                <p className="mb-2 text-sm text-stone-300">
                  Play <span className="font-bold text-red-300">{CARDS[selectedCard].name}</span> — {CARDS[selectedCard].effect}
                </p>
                {(() => {
                  const needs = cardNeeds(selectedCard);
                  const legal = legalTargets(selectedCard);
                  const multi = needs.target === 'two' || needs.target === 'multi';
                  const toggleTarget = (id: string) => {
                    setActionError('');
                    if (multi) {
                      setTargetSel((cur) =>
                        cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 2 ? [...cur, id] : cur
                      );
                    } else {
                      setTargetSel([id]);
                    }
                  };
                  // Is the move fully specified and ready to submit?
                  const targetReady =
                    !needs.target || legal.length === 0
                      ? true
                      : needs.target === 'two'
                      ? targetSel.length === 2 && !!cardinalPeek
                      : needs.target === 'multi'
                      ? targetSel.length >= 1
                      : targetSel.length === 1;
                  const ready = targetReady && (!needs.number || numberSel != null);

                  return (
                    <>
                      {needs.target && legal.length === 0 && (
                        <p className="mb-2 text-xs text-stone-400">No legal targets — plays with no effect.</p>
                      )}

                      {/* Target picker (right here in the panel) */}
                      {needs.target && legal.length > 0 && (
                        <div className="mb-3">
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">
                            {needs.target === 'two' ? 'Pick two players to swap'
                              : needs.target === 'multi' ? 'Pick 1 or 2 players to peek'
                              : 'Pick a player'}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {legal.map((id) => (
                              <button key={id} onClick={() => toggleTarget(id)}
                                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                                  targetSel.includes(id)
                                    ? 'bg-red-600 text-white'
                                    : 'bg-stone-700 text-stone-200 hover:bg-stone-600'
                                }`}>
                                {gameState.players[id]?.name}{id === playerId ? ' (you)' : ''}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cardinal: which swapped hand to peek */}
                      {needs.target === 'two' && targetSel.length === 2 && (
                        <div className="mb-3">
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">Peek whose hand?</p>
                          <div className="flex gap-2">
                            {targetSel.map((id) => (
                              <button key={id} onClick={() => setCardinalPeek(id)}
                                className={`rounded-lg px-3 py-1.5 text-sm ${cardinalPeek === id ? 'bg-red-600 text-white' : 'bg-stone-700 text-stone-200 hover:bg-stone-600'}`}>
                                {gameState.players[id]?.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Guard / Bishop: name a number */}
                      {needs.number && (
                        <div className="mb-3">
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">Name a number</p>
                          <div className="flex flex-wrap gap-1.5">
                            {valueChoices(selectedCard === 'guard').map((v) => (
                              <button key={v} onClick={() => { setNumberSel(v); setActionError(''); }}
                                className={`h-8 w-8 rounded-lg text-sm font-bold ${numberSel === v ? 'bg-red-600 text-white' : 'bg-stone-700 text-stone-200 hover:bg-stone-600'}`}>
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {actionError && <p className="mb-2 text-xs text-red-400">{actionError}</p>}
                      <div className="flex gap-2">
                        <button onClick={resetSelection} className="rounded-lg bg-stone-700 px-3 py-2 text-sm text-stone-200 hover:bg-stone-600">
                          Cancel
                        </button>
                        <button onClick={submitPlay} disabled={isActing || !ready}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50">
                          Play card
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
            {!isMyTurn && gameState.phase === 'playing' && (
              <p className="mt-3 text-sm text-stone-500">Waiting for your turn…</p>
            )}
          </div>
        )}
        {me?.isOut && gameState.phase === 'playing' && (
          <p className="rounded-2xl border border-stone-700 bg-stone-900/60 p-4 text-center text-stone-400">
            You&apos;re out this round — watching by the fire.
          </p>
        )}

        {/* Log */}
        {g.log.length > 0 && (
          <div className="mt-5 rounded-xl border border-stone-800 bg-stone-900/40 p-3">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Round log</h4>
            <ul className="space-y-0.5 text-xs text-stone-400">
              {g.log.slice(-8).map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </div>
        )}
        {actionError && view === 'play' && !selectedCard && (
          <p className="mt-3 text-center text-sm text-red-400">{actionError}</p>
        )}
      </div>

      {showRef && <SmokeSignalsCardReference version={g.version} onClose={() => setShowRef(false)} />}
      {showRules && (
        <SmokeSignalsRules
          version={g.version}
          playerCount={g.turnOrder.length}
          tokensToWin={g.tokensToWin}
          onClose={() => setShowRules(false)}
        />
      )}
    </div>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────────
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="ss-elevated flex min-h-screen items-center justify-center px-4">{children}</div>;
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 rounded-2xl border border-red-800/50 bg-stone-900/80 p-5 shadow-xl">{children}</div>
  );
}

function JoinForm({
  title, code, value, error, onChange, onSubmit, cta,
}: {
  title: string; code: string; value: string; error: string;
  onChange: (v: string) => void; onSubmit: () => void; cta: string;
}) {
  return (
    <Centered>
      <div className="w-full max-w-sm rounded-2xl bg-stone-800 p-8">
        <p className="mb-1 text-center font-mono text-xs uppercase tracking-widest text-stone-400">Game Code</p>
        <p className="mb-6 text-center font-mono text-3xl font-bold tracking-widest text-red-300">{code}</p>
        <h2 className="mb-6 text-center text-2xl font-bold text-white">{title}</h2>
        <input
          value={value} placeholder="Your name" autoFocus
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          className="mb-4 w-full rounded-xl border border-stone-600 bg-stone-700 px-4 py-3 text-lg text-white placeholder-stone-500 focus:border-red-500 focus:outline-none"
        />
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        <button onClick={onSubmit} className="w-full rounded-xl bg-red-600 py-3 text-lg font-bold text-white hover:bg-red-500">
          {cta}
        </button>
      </div>
    </Centered>
  );
}
