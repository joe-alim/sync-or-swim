# Two Tracks and a Trick — Plan

A real-time party game for the Foxflame suite. Every player writes **two truths
and one lie** ("two tracks and a trick"); the group then takes turns trying to
**spot the trick** in each other's sets. Highest score after everyone has been
in the spotlight wins.

This game slots into the existing generic room framework
([lib/games/types.ts](../lib/games/types.ts)): a `Room<TwoTracksGame>` envelope
in Redis, a logic module registered in [lib/games/modules.ts](../lib/games/modules.ts),
phase-driven API routes under `app/api/two-tracks-and-a-trick/*`, and a Pusher
broadcast after every state change. It reuses the same crew leaderboard
write-back as Sync or Swim. The meta entry already exists (currently
`coming-soon`); going live means flipping `status` and wiring the module.

## How it plays

1. **Lobby** — players join with a name. Host starts once enough have joined.
2. **Writing** — *every* player simultaneously submits three statements and marks
   which one is the lie. The set is locked once submitted.
3. **Guessing** — once everyone has written their set, the game reveals each
   player's three statements **one subject at a time, in random order**. Every
   *other* player picks the statement they think is the trick (the lie). The
   subject does not guess their own set.
4. **Reveal** — the lie is revealed, points are scored, and the board shows who
   guessed what. Host advances to the next subject.
5. **End** — after the last subject is revealed, the game ends. The player(s)
   with the highest total score win; ties co-win.

## Resolved decisions

- **What players guess**: spot the **lie** (the trick). One correct answer per set.
- **Scoring**: guessers earn **+1 for each correct catch**; the subject (author)
  earns a **+1 bonus for every player they fooled** (wrong guesses against their
  set). Rewards both sharp detectives and convincing liars.
- **Win condition**: **one pass** through all players (each player is the subject
  exactly once). Highest total score wins; **multiple players can co-win** on a
  tie — matching the "person or persons" intent. No tiebreaker round.
- **Timers**: none. Host-paced, mirroring Sync or Swim today.

## State machine

```
lobby ──start──▶ writing ──(all sets submitted, host begins)──▶ guessing
                                                                   │
                          ┌──(all others guessed, or host reveal)──┘
                          ▼
                       revealed ──host next──▶ guessing (next subject)
                          │
                          └──(no subjects remain)──▶ ended
```

Phase values (the game-specific `room.phase`):
`'lobby' | 'writing' | 'guessing' | 'revealed' | 'ended'`.

Transition ownership mirrors Sync or Swim:
- `start` (host) — `lobby → writing`.
- `submit` (any player) — records one player's set during `writing`. No phase
  change; the UI shows a "waiting on N players" count via `submittedIds`.
- `begin` (host) — `writing → guessing`. The host can start without everyone:
  any present player who hasn't written a set is **dropped from the roster**
  (they can rejoin mid-pass via the catch-up flow). Requires the host's own set
  and **≥ `MIN_PLAYERS` submitted sets**. Builds the randomized `order` from the
  submitters and opens the first subject.
- `guess` (an *eligible* non-subject player) — records one guess during
  `guessing`. When the **last** player in the round's frozen `eligibleIds` locks
  in, it auto-flips to `revealed` and scores the round (same shape as Sync or
  Swim's submit→reveal auto-advance).
- `reveal` (host) — force `guessing → revealed` early (e.g. someone is idle),
  scoring whatever guesses exist; missing guesses count as incorrect.
- `next` (host) — `revealed → guessing` for the next subject, or
  `revealed → ended` when `order` is exhausted (note `order` can have grown if
  players joined mid-pass — see Late joiners). **End-of-game crew write-back
  happens here**, exactly as in Sync or Swim's `next`.
- `reset` (host) — back to a fresh `lobby`, keeping the roster.

**Opening a round** (both `begin` for subject 0 and `next` for later subjects)
snapshots `eligibleIds` = every player present *at that moment* except the
subject, and clears `guesses`/`guessedIds`. Freezing the pool here is what keeps
the auto-reveal check stable when someone joins mid-round.

## Data model

Game-specific payload carried in `Room<TwoTracksGame>.game`
(new file `lib/games/two-tracks-and-a-trick/types.ts`):

```ts
export type TwoTracksPhase =
  | 'lobby' | 'writing' | 'guessing' | 'revealed' | 'ended';

/** One player's set. Statements are stored already shuffled into display order
 *  so the lie's slot can't be inferred from input order; `lieIndex` points at
 *  the lie within that displayed array. */
export interface Submission {
  statements: [string, string, string];
  lieIndex: number; // 0..2
}

export interface RoundResult {
  subjectId: string;
  subjectName: string;
  statements: string[];
  lieIndex: number;
  guesses: {
    playerId: string;
    playerName: string;
    guessIndex: number;
    correct: boolean;
  }[];
  points: Record<string, number>; // playerId -> points earned this round
}

export interface TwoTracksGame {
  submissions: Record<string, Submission>; // playerId -> set
  submittedIds: string[];                   // who has written their set
  order: string[];                          // randomized subject order
  roundIndex: number;                       // index into `order`
  eligibleIds: string[];                    // guessers frozen when the current round opened
  guesses: Record<string, number>;          // current round: guesserId -> chosen index
  guessedIds: string[];                     // who has guessed this round
  roundHistory: RoundResult[];
  winnerIds: string[];                      // co-winners, set at `ended`
}
```

`createRoom` returns the `lobby` shell with empty collections, `roundIndex: 0`,
`order: []`, `winnerIds: []` — same shape as `syncOrSwim.createRoom`.

## Sanitization (what the client may see)

The whole point is hiding the lie until reveal, so `sanitize` is stricter than
Sync or Swim's. Client type `ClientTwoTracksGame` exposes:

| Field | `writing` | `guessing` | `revealed` / history | Notes |
|---|---|---|---|---|
| own submission | echoed back to author only | — | — | author confirms their set; never expose other players' sets |
| `submittedIds` | ✅ | ✅ | ✅ | drives the lobby/writing progress count |
| current subject id + name | — | ✅ | ✅ | who's in the spotlight |
| current statements | — | ✅ (no `lieIndex`) | ✅ | the three lines to guess between |
| `lieIndex` | — | **hidden** | ✅ | the answer — only after reveal |
| `eligibleIds` | — | ✅ | ✅ | this round's frozen guesser pool — drives "waiting on N" and the late-joiner write prompt |
| `guessedIds` | — | ✅ | ✅ | who has locked a guess (not *what* they guessed) |
| individual guesses | — | **hidden** | ✅ | revealed all at once |
| `roundHistory` | ✅ | ✅ | ✅ | fully revealed past rounds |
| `roundIndex` / total | ✅ | ✅ | ✅ | progress ("Round 3 of 6") |
| `winnerIds` | — | — | ✅ at `ended` | |

The key invariant: **no statement set, no `lieIndex`, and no individual guess
leaves the server before its reveal.** The server holds the full `submissions`
map and per-round `guesses`; the client only ever receives the current subject's
data with the answer stripped until `revealed`.

## Scoring (computed at reveal)

For the current subject `S` with lie at `lieIndex`, over the set of eligible
guessers `G` (all present players except `S`):

- For each `g ∈ G`: `points[g] = (guesses[g] === lieIndex) ? 1 : 0`.
- Author bonus: `points[S] = |G| - (number of correct guessers)` — one point per
  player fooled.

Add `points` into `room.players[id].score`, push a `RoundResult`, set
`room.phase = 'revealed'`. A guesser with no recorded guess counts as incorrect
(0 for them, +1 fooled for the subject). At `ended`, compute
`max` score across players and set `winnerIds` to every player who has it.

## API routes

New tree under `app/api/two-tracks-and-a-trick/`, following the Sync or Swim
files almost verbatim (auth = host-only checks, phase guards, `getRoom` /
`saveRoom` / `broadcastState`):

| Route | Caller | Guard | Effect |
|---|---|---|---|
| `create` | anyone | — | mint room (optional `crewSlug`/`memberId`, same as Sync or Swim), `phase: 'lobby'` |
| `join` | anyone | any phase except `ended` | add player; name-unique; max 12; mid-pass joiners then write a set (see Late joiners) |
| `start` | host | `lobby`, ≥3 players | `→ writing` |
| `submit` | player | `writing` **or** mid-pass with no set yet | store `{statements, lieIndex}` shuffled; push to `submittedIds`; if mid-pass, append player to `order` tail |
| `begin` | host | `writing`, host submitted, ≥`MIN_PLAYERS` sets | drop non-submitters, build `order` (shuffle), open subject 0, `→ guessing` |
| `guess` | player | `guessing`, in this round's `eligibleIds`, not already guessed | record guess; auto-`reveal` + score when last eligible guesser locks in |
| `reveal` | host | `guessing` | force score + `→ revealed` |
| `next` | host | `revealed` | next subject `→ guessing`, or `→ ended` + **crew write-back** |
| `reset` | host | any | fresh `lobby`, keep roster |

The generic `app/api/state/[id]/route.ts` and the Pusher plumbing need **no
changes** — they dispatch on `room.gameType` through the module registry.

## Wiring into the framework

1. `lib/games/two-tracks-and-a-trick/types.ts` — the types above.
2. `lib/games/two-tracks-and-a-trick/logic.ts` — `SLUG`, `createRoom`,
   `sanitize`, plus pure helpers (`shuffle`, `scoreRound`, `computeWinners`).
3. Register the module in [lib/games/modules.ts](../lib/games/modules.ts)
   (add the `two-tracks-and-a-trick` entry alongside `sync-or-swim`).
4. Flip [lib/games/two-tracks-and-a-trick/meta.ts](../lib/games/two-tracks-and-a-trick/meta.ts)
   `status: 'coming-soon' → 'live'`. It's already in the meta registry, so the
   hub card lights up automatically.
5. Client page: a catch-all `app/two-tracks-and-a-trick/[...slug]/page.tsx`
   mirroring `app/sync-or-swim/[...slug]` — supports both `/{gameId}` (anonymous)
   and `/{crewSlug}/{gameId}` (crew) URL shapes.

## Crew integration

Reuses the existing leaderboard mechanism unchanged in spirit, with **one
adjustment for co-winners**. Sync or Swim's `next` calls `recordCrewWin` for a
single `winnerId`; here `winnerIds` can hold several. In `next`, when
`phase → 'ended'` and `room.crewSlug` is set and `!room.winRecorded`:

- Loop over `winnerIds`, calling `recordCrewWin` once per winner (each gets a
  `ZINCRBY` of 1 and a history entry, or one history entry listing all winners —
  implementer's call).
- Set `room.winRecorded = true` so a retried request can't double-count.

No schema change to `Room`; `crewSlug` / `winRecorded` already exist on the
envelope.

## Edge cases & rules

- **Minimum players**: 3 to start. With only 2, a subject has a single guesser
  and the author bonus is trivially gameable; 3+ keeps it fun.
- **Late joiners are welcome** any time before `ended` — see the dedicated
  section below. Reconnects (existing `playerId`) always succeed.
- **Idle / AFK writer**: a player who joins the lobby but never writes a set no
  longer stalls the game. The host's `begin` drops non-submitters from the roster
  (so they aren't subjects and don't clutter the scoreboard); a dropped player
  who is still connected lands back at name entry and can rejoin via the
  catch-up flow. `begin` still requires the host's own set and ≥`MIN_PLAYERS`
  submitted sets.
- **Subject never guesses their own set** — excluded from eligible guessers and
  from the "all guessed" auto-reveal check.
- **Disconnected guesser** at reveal — counts as no guess (incorrect); host can
  `reveal` to move on without waiting.
- **Player leaves after writing** — their submission stays, so they're still a
  subject when their turn comes; they simply don't earn guesser points.
- **Statement validation** — three non-empty statements, exactly one marked as
  the lie, trimmed; reject otherwise on `submit`.

## Late joiners

Anyone can join until the game has `ended`. The behavior depends on when they
arrive:

- **During `lobby` / `writing`** — no special handling. They write their set like
  everyone else and are included when `begin` builds the initial `order`.
- **During `guessing` / `revealed` (mid-pass)** — the design goal is "let them
  play without disturbing the round in flight":
  1. `join` adds them to the board immediately (they show up in standings at 0).
  2. They have no set yet, so the client shows them the write-your-set form. The
     `submit` route accepts this even outside `writing`.
  3. On submit, they're **appended to the tail of `order`**, so their spotlight
     comes after the already-queued subjects. `order` grows; `next` reaches
     `ended` only once the extended order is exhausted.
  4. They become an eligible guesser **from the next subject onward**. They are
     *not* added to the current round's frozen `eligibleIds`, so the in-flight
     round's auto-reveal is unaffected.
- **During `ended`** — rejected; they wait for the host to `reset`.

**Scoring asymmetry (accepted):** a mid-pass joiner misses the guessing on
subjects already revealed before they arrived, so they have fewer chances to
earn guesser points. Their author bonus is unaffected — their set is still shown
to everyone present when their turn comes. For a host-paced party game with
co-winning we accept this rather than normalizing scores by rounds played; the
end screen can footnote "joined late" next to such players if it ever feels
unfair.

**Why not rebuild `order`?** Reshuffling mid-pass would re-show or reorder
subjects already played. Appending is the only change that's strictly additive
and never disturbs a round in progress — the same additive principle the crew
plan follows elsewhere.

## Build phases

1. **Core game** — types, logic (`createRoom`/`sanitize`/scoring helpers),
   module registration, the seven API routes. Unit-test scoring and the
   reveal/sanitize invariants (lie never leaks pre-reveal).
2. **Client** — lobby + write-your-set form (three inputs, "mark the lie"),
   guessing screen (tap a statement), reveal screen (lie highlighted, who-guessed-
   what, round points), end screen with co-winner(s) and final standings.
3. **Crew + polish** — co-winner write-back in `next`, leaderboard surfaced on
   the end screen and lobby (same two surfaces as Sync or Swim), flip meta to
   `live`.

## Open questions (deferred, sensible defaults assumed)

- **Statement count / format** — fixed at 3 statements, free text. (Could later
  allow categories or prompts.)
- **Re-using sets across rounds of the same crew** — out of scope; every game is
  a fresh write.
- **Empty-guess penalty** — none beyond missing the point; no negative scoring.
