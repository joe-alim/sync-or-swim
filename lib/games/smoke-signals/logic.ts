// Smoke Signals — server-side game engine (a campfire-themed Love Letter Premium
// reskin). All mutation goes through these functions; routes load the room, call
// one, and save. Rules follow ./REQUIREMENTS.md. Hidden information is enforced in
// `sanitize`, which returns a per-viewer view gated by a server-issued secret.

import { randomUUID } from 'crypto';
import { Room, ClientRoom, Player, ViewerCredential } from '../types';
import { CardId, CARDS, deckFor, SmokeSignalsVersion } from './cards';
import { SmokeSignalsGame, ClientSmokeSignalsGame, SSMove, SSClientPlayer } from './types';

export const SLUG = 'smoke-signals';

type SSRoom = Room<SmokeSignalsGame>;
type Result = { ok: true } | { ok: false; error: string };
const ok: Result = { ok: true };
const err = (error: string): Result => ({ ok: false, error });

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function versionFor(playerCount: number): SmokeSignalsVersion {
  return playerCount >= 5 ? 'premium' : 'regular';
}

function tokensToWin(playerCount: number): number {
  if (playerCount <= 2) return 7;
  if (playerCount === 3) return 5;
  return 4; // 4 players, and the flat 4 for 5–8
}

export function createRoom(id: string, hostId: string): SSRoom {
  return {
    id,
    gameType: SLUG,
    hostId,
    phase: 'lobby',
    players: {},
    game: {
      version: 'regular',
      tokensToWin: 7,
      roundNumber: 0,
      deck: [],
      removed: null,
      faceUp: [],
      states: {},
      secrets: {},
      turnOrder: [],
      currentTurn: null,
      firstPlayerId: null,
      sycophantTarget: null,
      jesterBets: {},
      peeks: {},
      pending: null,
      log: [],
      roundWinnerIds: [],
      gameWinnerId: null,
    },
  };
}

/** Add a player (lobby only). Returns the player's private secret (issued once). */
export function addPlayer(
  room: SSRoom,
  playerId: string,
  name: string
): { ok: true; player: Player; secret: string } | { ok: false; error: string } {
  if (room.game.secrets[playerId]) {
    // Reconnect: hand back the existing identity.
    return { ok: true, player: room.players[playerId], secret: room.game.secrets[playerId] };
  }
  if (room.phase !== 'lobby') return { ok: false, error: 'Game already in progress' };
  if (room.game.turnOrder.length >= 8) return { ok: false, error: 'Table is full (max 8)' };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'Name required' };
  const taken = Object.values(room.players).some(
    (p) => p.name.toLowerCase() === trimmed.toLowerCase() && p.id !== playerId
  );
  if (taken) return { ok: false, error: 'Name already taken' };

  const player: Player = { id: playerId, name: trimmed, score: 0, isHost: playerId === room.hostId };
  room.players[playerId] = player;
  room.game.turnOrder.push(playerId);
  const secret = randomUUID();
  room.game.secrets[playerId] = secret;
  return { ok: true, player, secret };
}

/** Host starts the game: lock version/target from the table size and deal round 1. */
export function startGame(room: SSRoom): Result {
  if (room.phase !== 'lobby') return err('Game already started');
  const count = room.game.turnOrder.length;
  if (count < 2) return err('Need at least 2 players');

  room.game.version = versionFor(count);
  room.game.tokensToWin = tokensToWin(count);
  room.game.roundNumber = 0;
  room.game.firstPlayerId = room.hostId;
  for (const id of room.game.turnOrder) room.players[id].score = 0;
  setupRound(room);
  return ok;
}

function setupRound(room: SSRoom): void {
  const g = room.game;
  const count = g.turnOrder.length;
  g.roundNumber += 1;

  const deck = shuffle(deckFor(g.version));
  g.removed = deck.pop() ?? null;
  g.faceUp = g.version === 'regular' && count === 2 ? [deck.pop()!, deck.pop()!, deck.pop()!] : [];

  g.states = {};
  for (const id of g.turnOrder) {
    g.states[id] = { hand: [deck.pop()!], discard: [], isOut: false, protected: false };
  }
  g.deck = deck;

  g.sycophantTarget = null;
  g.jesterBets = {};
  g.peeks = {};
  g.pending = null;
  g.log = [];
  g.roundWinnerIds = [];
  g.currentTurn = g.firstPlayerId && g.states[g.firstPlayerId] ? g.firstPlayerId : g.turnOrder[0];

  room.phase = 'playing';
  beginTurn(room); // first player draws to 2
}

/** Advance into `currentTurn`'s turn: clear their protection + stale peeks, draw. */
function beginTurn(room: SSRoom): void {
  const g = room.game;
  const id = g.currentTurn!;
  g.states[id].protected = false;
  g.peeks[id] = {};
  const drawn = drawCard(g);
  if (drawn) g.states[id].hand.push(drawn);
}

/** Draw from the deck; falls back to the set-aside `removed` card once empty. */
function drawCard(g: SmokeSignalsGame): CardId | null {
  if (g.deck.length > 0) return g.deck.pop()!;
  if (g.removed) {
    const c = g.removed;
    g.removed = null;
    return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Turn helpers
// ---------------------------------------------------------------------------

const name = (room: SSRoom, id: string) => room.players[id]?.name ?? '?';
const activePlayers = (g: SmokeSignalsGame) => g.turnOrder.filter((id) => !g.states[id].isOut);

/** Players another card may target: in the round, not Handmaid-protected, optionally self. */
function targetable(g: SmokeSignalsGame, actorId: string, includeSelf: boolean): string[] {
  return g.turnOrder.filter((id) => {
    if (g.states[id].isOut) return false;
    if (id === actorId) return includeSelf;
    return !g.states[id].protected;
  });
}

function knockOut(room: SSRoom, id: string, reason: string): void {
  const g = room.game;
  const st = g.states[id];
  if (st.isOut) return;
  st.isOut = true;
  // Their hand goes to the discard pile (effect not applied).
  st.discard.push(...st.hand);
  st.hand = [];
  g.log.push(`${name(room, id)} is out — ${reason}.`);
  // Constable: knocked out with the Constable in your discard → gain a token.
  if (st.discard.includes('constable')) {
    awardToken(room, id, `${name(room, id)} gains a token (Constable)`);
  }
}

/** Grant a token and end the game immediately if it reaches the target. */
function awardToken(room: SSRoom, id: string, logLine: string): void {
  const g = room.game;
  room.players[id].score += 1;
  g.log.push(logLine + '.');
  if (room.players[id].score >= g.tokensToWin) {
    g.gameWinnerId = id;
    room.phase = 'game-end';
  }
}

// ---------------------------------------------------------------------------
// Playing a card
// ---------------------------------------------------------------------------

export function playCard(room: SSRoom, playerId: string, move: SSMove): Result {
  const g = room.game;
  if (room.phase !== 'playing') return err('Not in play');
  if (g.pending) return err('A decision is pending');
  if (g.currentTurn !== playerId) return err('Not your turn');

  const st = g.states[playerId];
  if (!st || st.isOut) return err('You are out of the round');
  if (st.hand.length !== 2) return err('Draw first');
  if (!st.hand.includes(move.card)) return err('You do not hold that card');

  // Countess: must be played if you also hold the King or Prince.
  if (
    st.hand.includes('countess') &&
    (st.hand.includes('king') || st.hand.includes('prince')) &&
    move.card !== 'countess'
  ) {
    return err('You must play the Countess');
  }

  // Remove the played card from hand into discard (before resolving its effect).
  const idx = st.hand.indexOf(move.card);
  st.hand.splice(idx, 1);
  st.discard.push(move.card);
  g.log.push(`${name(room, playerId)} plays the ${CARDS[move.card].name}.`);

  const res = resolveEffect(room, playerId, move);
  if (!res.ok) {
    // Roll back the discard so the player can re-submit a valid move.
    st.discard.pop();
    st.hand.splice(idx, 0, move.card);
    g.log.pop();
    return res;
  }

  // Clear the Sycophant constraint once any card has been played after it.
  if (move.card !== 'sycophant') g.sycophantTarget = null;

  // resolveEffect may have ended the game (a token hit the target); re-check.
  // (Cast defeats stale control-flow narrowing from the `!== 'playing'` guard.)
  if ((room.phase as string) === 'game-end') return ok;
  if (!g.pending) endTurn(room);
  return ok;
}

function resolveEffect(room: SSRoom, actorId: string, move: SSMove): Result {
  const g = room.game;
  const st = g.states[actorId];
  const card = move.card;

  // Enforce a live Sycophant redirect: if the forced target is a legal choice for
  // this card, the move must include it.
  const forced = g.sycophantTarget;
  const mustInclude = (cands: string[]): boolean =>
    forced != null && cands.includes(forced);

  switch (card) {
    case 'handmaid':
      st.protected = true;
      g.log.push(`${name(room, actorId)} is protected until their next turn.`);
      return ok;

    case 'count':
    case 'constable':
    case 'countess':
    case 'assassin':
      // No on-play effect. (The Assassin's power triggers only while held, when a
      // Guard targets its holder — handled in the 'guard' case.)
      return ok;

    case 'princess':
      knockOut(room, actorId, 'discarded the Princess');
      return ok;

    case 'guard': {
      const cands = targetable(g, actorId, false);
      if (cands.length === 0) return ok; // no legal target → no effect
      const target = move.targetId;
      if (!target || !cands.includes(target)) return err('Choose a valid player');
      if (mustInclude(cands) && target !== forced) return err('Sycophant forces a target');
      if (move.namedValue == null || move.namedValue === 1) return err('Name a number other than 1');
      const th = g.states[target].hand[0];
      // Assassin counter: targeting the Assassin-holder knocks out the Guard player.
      if (th === 'assassin') {
        g.log.push(`${name(room, target)} reveals the Assassin!`);
        knockOut(room, actorId, 'struck by the Assassin');
        g.states[target].discard.push('assassin');
        g.states[target].hand = [];
        const drawn = drawCard(g);
        if (drawn) g.states[target].hand.push(drawn);
        return ok;
      }
      if (CARDS[th].value === move.namedValue) {
        knockOut(room, target, `Guard named ${move.namedValue}`);
      } else {
        g.log.push(`Guard misses ${name(room, target)}.`);
      }
      return ok;
    }

    case 'priest': {
      const cands = targetable(g, actorId, false);
      if (cands.length === 0) return ok;
      const target = move.targetId;
      if (!target || !cands.includes(target)) return err('Choose a valid player');
      if (mustInclude(cands) && target !== forced) return err('Sycophant forces a target');
      g.peeks[actorId] = { ...g.peeks[actorId], [target]: g.states[target].hand[0] };
      g.log.push(`${name(room, actorId)} looks at ${name(room, target)}'s hand.`);
      return ok;
    }

    case 'baroness': {
      const cands = targetable(g, actorId, false);
      if (cands.length === 0) return ok;
      const targets = move.baronessTargets ?? [];
      if (targets.length < 1 || targets.length > 2) return err('Choose 1 or 2 players');
      if (targets.some((t) => !cands.includes(t)) || new Set(targets).size !== targets.length)
        return err('Choose valid, distinct players');
      if (mustInclude(cands) && !targets.includes(forced!)) return err('Sycophant forces a target');
      for (const t of targets) g.peeks[actorId] = { ...g.peeks[actorId], [t]: g.states[t].hand[0] };
      g.log.push(`${name(room, actorId)} peeks at ${targets.map((t) => name(room, t)).join(' & ')}.`);
      return ok;
    }

    case 'baron': {
      const cands = targetable(g, actorId, false);
      if (cands.length === 0) return ok;
      const target = move.targetId;
      if (!target || !cands.includes(target)) return err('Choose a valid player');
      if (mustInclude(cands) && target !== forced) return err('Sycophant forces a target');
      const a = CARDS[st.hand[0]].value;
      const b = CARDS[g.states[target].hand[0]].value;
      if (a > b) knockOut(room, target, `lost the duel (${b} vs ${a})`);
      else if (b > a) knockOut(room, actorId, `lost the duel (${a} vs ${b})`);
      else g.log.push(`${name(room, actorId)} and ${name(room, target)} tie — no one out.`);
      return ok;
    }

    case 'dowager-queen': {
      const cands = targetable(g, actorId, false);
      if (cands.length === 0) return ok;
      const target = move.targetId;
      if (!target || !cands.includes(target)) return err('Choose a valid player');
      if (mustInclude(cands) && target !== forced) return err('Sycophant forces a target');
      const a = CARDS[st.hand[0]].value;
      const b = CARDS[g.states[target].hand[0]].value;
      if (a > b) knockOut(room, actorId, `higher hand falls (${a} vs ${b})`);
      else if (b > a) knockOut(room, target, `higher hand falls (${b} vs ${a})`);
      else g.log.push(`${name(room, actorId)} and ${name(room, target)} tie — no one out.`);
      return ok;
    }

    case 'king': {
      const cands = targetable(g, actorId, false);
      if (cands.length === 0) return ok;
      const target = move.targetId;
      if (!target || !cands.includes(target)) return err('Choose a valid player');
      if (mustInclude(cands) && target !== forced) return err('Sycophant forces a target');
      [st.hand, g.states[target].hand] = [g.states[target].hand, st.hand];
      g.log.push(`${name(room, actorId)} trades hands with ${name(room, target)}.`);
      return ok;
    }

    case 'prince': {
      const cands = targetable(g, actorId, true); // may target self
      if (cands.length === 0) return ok;
      const target = move.targetId;
      if (!target || !cands.includes(target)) return err('Choose a valid player');
      if (mustInclude(cands) && target !== forced) return err('Sycophant forces a target');
      const ts = g.states[target];
      const discarded = ts.hand[0];
      ts.discard.push(discarded);
      ts.hand = [];
      if (discarded === 'princess') {
        knockOut(room, target, 'forced to discard the Princess');
      } else {
        const drawn = drawCard(g);
        if (drawn) ts.hand.push(drawn);
        g.log.push(`${name(room, target)} discards and draws anew.`);
      }
      return ok;
    }

    case 'sycophant': {
      const cands = targetable(g, actorId, true);
      if (cands.length === 0) return ok;
      const target = move.targetId;
      if (!target || !cands.includes(target)) return err('Choose a valid player');
      g.sycophantTarget = target;
      g.log.push(`The next targeting card must include ${name(room, target)}.`);
      return ok;
    }

    case 'jester': {
      const cands = targetable(g, actorId, false);
      if (cands.length === 0) return ok;
      const target = move.targetId;
      if (!target || !cands.includes(target)) return err('Choose a valid player');
      if (mustInclude(cands) && target !== forced) return err('Sycophant forces a target');
      g.jesterBets[actorId] = target;
      g.log.push(`${name(room, actorId)} bets on ${name(room, target)} to win the round.`);
      return ok;
    }

    case 'cardinal': {
      // Two players (may include self) swap hands; then peek one. Needs ≥2 choosable.
      const cands = targetable(g, actorId, true);
      if (cands.length < 2) return ok;
      const pair = move.cardinalTargets;
      if (!pair || pair.length !== 2 || pair[0] === pair[1]) return err('Choose two players');
      if (!cands.includes(pair[0]) || !cands.includes(pair[1])) return err('Choose valid players');
      if (mustInclude(cands) && !pair.includes(forced!)) return err('Sycophant forces a target');
      const peek = move.cardinalPeek;
      if (!peek || !pair.includes(peek)) return err('Choose which hand to look at');
      [g.states[pair[0]].hand, g.states[pair[1]].hand] = [
        g.states[pair[1]].hand,
        g.states[pair[0]].hand,
      ];
      g.peeks[actorId] = { ...g.peeks[actorId], [peek]: g.states[peek].hand[0] };
      g.log.push(`${name(room, actorId)} swaps ${name(room, pair[0])} & ${name(room, pair[1])}.`);
      return ok;
    }

    case 'bishop': {
      const cands = targetable(g, actorId, false);
      if (cands.length === 0) return ok;
      const target = move.targetId;
      if (!target || !cands.includes(target)) return err('Choose a valid player');
      if (mustInclude(cands) && target !== forced) return err('Sycophant forces a target');
      if (move.namedValue == null) return err('Name a number');
      if (CARDS[g.states[target].hand[0]].value === move.namedValue) {
        awardToken(room, actorId, `${name(room, actorId)} guesses right (Bishop) and gains a token`);
        // The revealed player MAY discard and redraw — offer them the choice.
        if (room.phase !== 'game-end' && !g.states[target].discard.includes('princess')) {
          g.pending = { kind: 'bishop-redraw', playerId: target };
        }
      } else {
        g.log.push(`Bishop misses ${name(room, target)}.`);
      }
      return ok;
    }

    default:
      return err('Unknown card');
  }
}

/** Resolve the Bishop's optional discard-and-redraw for the revealed player. */
export function resolveBishopRedraw(room: SSRoom, playerId: string, redraw: boolean): Result {
  const g = room.game;
  if (!g.pending || g.pending.kind !== 'bishop-redraw') return err('No pending decision');
  if (g.pending.playerId !== playerId) return err('Not your decision');
  const st = g.states[playerId];
  if (redraw) {
    const discarded = st.hand[0];
    st.discard.push(discarded);
    st.hand = [];
    if (discarded === 'princess') {
      knockOut(room, playerId, 'discarded the Princess');
    } else {
      const drawn = drawCard(g);
      if (drawn) st.hand.push(drawn);
      g.log.push(`${name(room, playerId)} discards and draws anew (Bishop).`);
    }
  } else {
    g.log.push(`${name(room, playerId)} keeps their hand.`);
  }
  g.pending = null;
  if (room.phase !== 'game-end') endTurn(room);
  return ok;
}

// ---------------------------------------------------------------------------
// End of turn / round / game
// ---------------------------------------------------------------------------

function endTurn(room: SSRoom): void {
  const g = room.game;
  const active = activePlayers(g);
  if (active.length <= 1) {
    resolveRound(room, active);
    return;
  }
  // Round ends when the deck is empty at the end of a turn → compare hands.
  if (g.deck.length === 0) {
    resolveRound(room, deckoutWinners(room, active));
    return;
  }
  advanceTurn(room);
}

function advanceTurn(room: SSRoom): void {
  const g = room.game;
  const order = g.turnOrder;
  const start = order.indexOf(g.currentTurn!);
  for (let i = 1; i <= order.length; i++) {
    const id = order[(start + i) % order.length];
    if (!g.states[id].isOut) {
      g.currentTurn = id;
      beginTurn(room);
      return;
    }
  }
}

const discardSum = (g: SmokeSignalsGame, id: string) =>
  g.states[id].discard.reduce((s, c) => s + CARDS[c].value, 0);

/** A player's compared value at deck-out: hand value + 1 per Count in discard. */
const effectiveValue = (g: SmokeSignalsGame, id: string) =>
  CARDS[g.states[id].hand[0]].value +
  g.states[id].discard.filter((c) => c === 'count').length;

/** Order two surviving hands: Princess beats Bishop; else higher effective value;
 *  ties broken by discard-pile sum. Returns >0 if a wins, <0 if b wins, 0 tie. */
function compareHands(g: SmokeSignalsGame, a: string, b: string): number {
  const ha = g.states[a].hand[0];
  const hb = g.states[b].hand[0];
  if (ha === 'princess' && hb === 'bishop') return 1;
  if (hb === 'princess' && ha === 'bishop') return -1;
  const va = effectiveValue(g, a);
  const vb = effectiveValue(g, b);
  if (va !== vb) return va - vb;
  return discardSum(g, a) - discardSum(g, b);
}

function deckoutWinners(room: SSRoom, active: string[]): string[] {
  const g = room.game;
  let best = active[0];
  for (const id of active) if (compareHands(g, id, best) > 0) best = id;
  return active.filter((id) => compareHands(g, id, best) === 0);
}

function resolveRound(room: SSRoom, winners: string[]): void {
  const g = room.game;
  g.roundWinnerIds = winners;
  for (const w of winners) {
    awardToken(room, w, `${name(room, w)} wins the round and gains a token`);
  }
  // Jester payouts: a correct bet on a round winner earns the bettor a token too.
  for (const [bettor, pick] of Object.entries(g.jesterBets)) {
    if (winners.includes(pick)) {
      awardToken(room, bettor, `${name(room, bettor)} called it (Jester) and gains a token`);
    }
  }

  if (room.phase === 'game-end') return; // a token hit the target mid-resolution

  // Pick who leads the next round (a winner). Then check for an outright game win.
  g.firstPlayerId = winners[0] ?? g.turnOrder[0];

  const top = Math.max(...g.turnOrder.map((id) => room.players[id].score));
  const leaders = g.turnOrder.filter((id) => room.players[id].score === top);
  if (top >= g.tokensToWin && leaders.length === 1) {
    g.gameWinnerId = leaders[0];
    room.phase = 'game-end';
  } else {
    // Either no one has reached the target, or there's a tie at/over it — in which
    // case the rulebook has the tied players play another round. We resolve that
    // with a normal next round (simpler than seating only the tied players).
    room.phase = 'round-end';
  }
}

/** Host advances from the round-end screen to the next round. */
export function nextRound(room: SSRoom): Result {
  if (room.phase !== 'round-end') return err('Round is not over');
  setupRound(room);
  return ok;
}

/** Host returns a finished game to the lobby to play again (keeps the table). */
export function resetToLobby(room: SSRoom): Result {
  const g = room.game;
  for (const id of g.turnOrder) room.players[id].score = 0;
  g.roundNumber = 0;
  g.states = {};
  g.deck = [];
  g.removed = null;
  g.faceUp = [];
  g.currentTurn = null;
  g.firstPlayerId = null;
  g.sycophantTarget = null;
  g.jesterBets = {};
  g.peeks = {};
  g.pending = null;
  g.log = [];
  g.roundWinnerIds = [];
  g.gameWinnerId = null;
  room.phase = 'lobby';
  room.winRecorded = false;
  return ok;
}

// ---------------------------------------------------------------------------
// Sanitize (per-viewer)
// ---------------------------------------------------------------------------

export function sanitize(room: SSRoom, viewer?: ViewerCredential): ClientRoom<ClientSmokeSignalsGame> {
  const g = room.game;
  const isViewer =
    !!viewer && !!g.secrets[viewer.playerId] && g.secrets[viewer.playerId] === viewer.secret;
  const viewerId = isViewer ? viewer!.playerId : null;

  const states: Record<string, SSClientPlayer> = {};
  for (const id of g.turnOrder) {
    const s = g.states[id];
    if (!s) continue;
    states[id] = {
      isOut: s.isOut,
      protected: s.protected,
      discard: s.discard,
      handCount: s.hand.length,
      hand: viewerId === id ? s.hand : undefined,
    };
  }

  const game: ClientSmokeSignalsGame = {
    version: g.version,
    tokensToWin: g.tokensToWin,
    roundNumber: g.roundNumber,
    deckCount: g.deck.length,
    faceUp: g.faceUp,
    states,
    turnOrder: g.turnOrder,
    currentTurn: g.currentTurn,
    sycophantTarget: g.sycophantTarget,
    jesterBets: g.jesterBets,
    pending: g.pending,
    peeks: viewerId ? g.peeks[viewerId] ?? {} : {},
    log: g.log,
    roundWinnerIds: g.roundWinnerIds,
    gameWinnerId: g.gameWinnerId,
    viewerId,
  };

  return {
    id: room.id,
    gameType: room.gameType,
    hostId: room.hostId,
    phase: room.phase,
    players: room.players,
    crewSlug: room.crewSlug,
    game,
  };
}
