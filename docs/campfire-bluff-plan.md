# Campfire Bluff — Plan

A real-time bluffing/trivia game for the Foxflame suite. The game shows a true
but surprising trivia question with the **answer hidden**; every player invents
a fake answer convincing enough to fool the group. All answers — the bluffs
plus the real one — are then shuffled together and everyone votes for the one
they think is true. Score for spotting the truth *and* for fooling your
friends. Highest score after a fixed run of questions wins. Inspired by
Fibbage.

This slots into the existing generic room framework
([lib/games/types.ts](../lib/games/types.ts)): a `Room<CampfireBluffGame>`
envelope in Redis, a logic module registered in
[lib/games/modules.ts](../lib/games/modules.ts), phase-driven API routes under
`app/api/campfire-bluff/*`, and a Pusher broadcast after every state change. It
reuses the crew leaderboard write-back, co-winner style, from Two Tracks and a
Trick.

## How it plays

1. **Lobby** — players join with a name. Host starts once enough have joined.
2. **Bluffing** — the host reveals a trivia prompt (the real answer stays
   server-side). Every player writes one fake answer meant to pass as true.
   No one is "on the spot" — everyone bluffs every round.
3. **Voting** — once the host is ready, all bluffs plus the real answer are
   shuffled into one anonymous list. Every player picks the one they believe
   is true. You can't vote for your own bluff.
4. **Reveal** — the true answer is revealed along with who wrote which bluff
   and who voted for what. Points are awarded. Host advances to the next
   question.
5. **End** — after a fixed number of rounds, the game ends. The player(s) with
   the highest total score win; ties co-win, matching Two Tracks.

## Resolved decisions

- **What's hidden**: the real answer, and authorship of every bluff, until
  reveal. Unlike Two Tracks (one subject per round), *every* player bluffs
  *every* round — there's no spotlight player, which keeps rounds fast and
  everyone equally involved.
- **Self-vote guard**: a player cannot vote for their own bluff. Enforced
  server-side (compares the option's authorship to the voter's id); the client
  also greys out the option matching what that player typed, since they
  already know their own text — no need for the secret-token machinery Smoke
  Signals uses for genuinely hidden hands.
- **Scoring**: voters who find the truth earn **+2**; a bluff's author earns
  **+1 for every player fooled** by it. Rewards sharp truth-seekers and
  convincing liars in the same round — the same "reward both sides" shape as
  Two Tracks' fooled-bonus, tuned so truth-finding (rarer, since bluffs
  outnumber the truth) is worth more per hit than any single fooled vote.
- **Round count**: fixed at `ROUNDS_PER_GAME = 8` (tunable constant, like
  `WIN_SCORE = 25` in Sync or Swim). Trivia content is exhaustible and doesn't
  naturally build toward a score threshold the way matching or lie-spotting
  does, so a flat round count is simpler than a race-to-N and keeps a full
  game inside the 30-minute target (~2–3 min/round including reveal).
- **Win condition**: highest total score after `ROUNDS_PER_GAME` rounds; ties
  co-win (`winnerIds`), same as Two Tracks. No tiebreaker round.
- **Minimum players**: 3. With 2 players there's exactly one bluff to hide the
  truth among — a coin flip every round with no real bluff *variety* to weigh,
  which is the whole appeal of the format.
- **Missing bluffs are fine**: if a player hasn't submitted by the time the
  host opens voting, their bluff simply isn't an option that round — no
  penalty, no roster drop. Unlike Two Tracks (where a missing submission would
  mean a player skips being *the* subject entirely), every round here is
  independent, so there's nothing to reshuffle around a straggler.
- **Timers**: none. Host-paced, mirroring the rest of the suite.

## State machine

```
lobby ──start──▶ bluffing ──(host opens voting)──▶ voting
                                                       │
                          ┌──(all eligible voted, or host reveal)──┘
                          ▼
                       revealed ──host next──▶ bluffing (next question)
                          │
                          └──(round index hits ROUNDS_PER_GAME)──▶ ended
```

Phase values: `'lobby' | 'bluffing' | 'voting' | 'revealed' | 'ended'`.

Transition ownership mirrors Two Tracks:
- `start` (host) — `lobby → bluffing`. Shuffles the question deck, sets
  `totalRounds = min(ROUNDS_PER_GAME, deck.length)`, draws question 0.
- `submit` (any player) — records one player's bluff during `bluffing`. No
  phase change; UI shows a "N players have bluffed" count via `submittedIds`.
- `beginVoting` (host) — `bluffing → voting`. Builds the shuffled `options`
  array from whatever bluffs exist plus the true answer, assigns each an id,
  stores the hidden `authorId | null` map, snapshots `eligibleVoterIds` = every
  player present right now, and clears `votes`/`votedIds`. Requires ≥2 options
  (i.e. at least one bluff) so there's something to vote between.
- `vote` (an eligible player, not voting for their own bluff) — records one
  vote during `voting`. When the **last** player in the round's frozen
  `eligibleVoterIds` locks in, auto-flips to `revealed` and scores the round —
  same auto-advance shape as Two Tracks' guessing phase.
- `reveal` (host) — force `voting → revealed` early (e.g. someone's idle),
  scoring whatever votes exist; missing votes count as no vote (no points
  either way).
- `next` (host) — `revealed → voting`'s successor: draws the next question and
  reopens `bluffing`, or `revealed → ended` when `roundIndex` reaches
  `totalRounds`. **End-of-game crew write-back happens here**, exactly as in
  Two Tracks' `next`.
- `reset` (host) — back to a fresh `lobby`, keeping the roster.

## Data model

New file `lib/games/campfire-bluff/types.ts`:

```ts
export type CampfireBluffPhase =
  | 'lobby' | 'bluffing' | 'voting' | 'revealed' | 'ended';

export interface Question {
  prompt: string;
  answer: string;
}

/** One shuffled option shown during voting. `authorId` is null for the real
 *  answer — kept server-side only until reveal. */
interface Option {
  id: string;
  text: string;
  authorId: string | null;
}

export interface RoundResult {
  prompt: string;
  trueAnswer: string;
  options: {
    text: string;
    isTrue: boolean;
    authorId: string | null; // null for the true answer
    authorName: string | null;
    voterIds: string[];
  }[];
  points: Record<string, number>; // playerId -> points earned this round
}

export interface CampfireBluffGame {
  deck: Question[];                  // remaining questions, shuffled
  totalRounds: number;               // min(ROUNDS_PER_GAME, initial deck size)
  roundIndex: number;                // 0-based, current round
  currentQuestion: Question | null;
  bluffs: Record<string, string>;    // playerId -> bluff text (bluffing phase)
  submittedIds: string[];            // who has bluffed this round
  options: Option[];                 // set when voting opens; authorship hidden from client
  eligibleVoterIds: string[];        // frozen when voting opened
  votes: Record<string, string>;     // voterId -> optionId
  votedIds: string[];
  roundHistory: RoundResult[];
  winnerIds: string[];               // co-winners, set at `ended`
}
```

`createRoom` returns the `lobby` shell with empty collections, `roundIndex: 0`,
`totalRounds: 0` (set at `start`), `winnerIds: []` — same shape as the other
games' `createRoom`.

## Sanitization (what the client may see)

`ClientCampfireBluffGame` — no `ViewerCredential` needed (unlike Smoke
Signals): the only secret is authorship/correctness of the *shared* option
list, and every player already knows their own bluff's text, so there's no
per-viewer split to compute server-side.

| Field | `bluffing` | `voting` | `revealed` / history | Notes |
|---|---|---|---|---|
| `currentQuestion.prompt` | ✅ | ✅ | ✅ | |
| `currentQuestion.answer` | **hidden** | **hidden** | ✅ (via `roundHistory`) | the whole game hinges on this staying server-side pre-reveal |
| own bluff | echoed back to author only | — | — | confirms their submission; never expose others' bluffs pre-vote |
| `submittedIds` | ✅ | ✅ | ✅ | drives "N players have bluffed" |
| `options` (text + id only) | — | ✅ | ✅ (with authorship added) | shuffled; no `authorId`, no `isTrue` until reveal |
| `eligibleVoterIds` | — | ✅ | ✅ | this round's frozen voter pool |
| `votedIds` | — | ✅ | ✅ | who's locked a vote (not *what* they picked) |
| individual votes / authorship | — | **hidden** | ✅ | revealed all at once |
| `roundHistory` | ✅ | ✅ | ✅ | fully revealed past rounds |
| `roundIndex` / `totalRounds` | ✅ | ✅ | ✅ | progress ("Round 3 of 8") |
| `winnerIds` | — | — | ✅ at `ended` | |

Invariant: **no `answer`, no option `authorId`/`isTrue`, and no individual vote
leaves the server before that round's reveal.**

## Scoring (computed at reveal)

For the current round's `options` (one true, the rest bluffs) over
`eligibleVoterIds`:

- For each voter `v`: if `options[votes[v]].authorId === null` (they picked the
  truth), `points[v] += 2`.
- For each bluff's author `a`: `points[a] +=` count of voters whose vote landed
  on that bluff (one point per player fooled by *that specific* bluff — an
  author with multiple... no, each author has exactly one bluff per round, so
  this is just "votes received").
- A voter with no recorded vote scores 0 and can't fool anyone (they didn't
  bluff-vote for someone; irrelevant to authors' tallies either way — they
  simply contribute no vote to any option).
- Add `points` into `room.players[id].score`, push a `RoundResult` (with
  authorship and correctness now attached to every option), set
  `room.phase = 'revealed'`.

At `ended`, compute `max` score across players and set `winnerIds` to every
player who has it (co-win on ties, same as Two Tracks).

## API routes

New tree under `app/api/campfire-bluff/`, following the Two Tracks files
almost verbatim (auth = host-only checks, phase guards, `getRoom` /
`saveRoom` / `broadcastState`):

| Route | Caller | Guard | Effect |
|---|---|---|---|
| `create` | anyone | — | mint room (optional `crewSlug`/`memberId`), `phase: 'lobby'` |
| `join` | anyone | any phase except `ended` | add player; name-unique; max 10 |
| `start` | host | `lobby`, ≥3 players | shuffle deck, set `totalRounds`, draw question 0, `→ bluffing` |
| `submit` | player | `bluffing`, not already submitted | store bluff text (trimmed, non-empty); push to `submittedIds` |
| `beginVoting` | host | `bluffing`, ≥1 bluff submitted | build shuffled `options` + hidden authorship map, snapshot `eligibleVoterIds`, `→ voting` |
| `vote` | player | `voting`, in `eligibleVoterIds`, not already voted, not voting for own bluff | record vote; auto-`reveal` + score when last eligible voter locks in |
| `reveal` | host | `voting` | force score + `→ revealed` |
| `next` | host | `revealed` | next question `→ bluffing`, or `→ ended` + **crew write-back** |
| `reset` | host | any | fresh `lobby`, keep roster, reshuffle deck |

The generic `app/api/state/[id]/route.ts` and the Pusher plumbing need **no
changes** — they dispatch on `room.gameType` through the module registry, and
this game doesn't use the `x-player-id`/`x-player-secret` viewer headers at
all (no per-viewer sanitize needed).

## Wiring into the framework

1. `lib/games/campfire-bluff/types.ts` — the types above.
2. `lib/games/campfire-bluff/questions.ts` — the trivia bank (`Question[]`,
   flat exported array, easy to extend — same pattern as
   `lib/games/sync-or-swim/cards.ts`). Aim for ~60 "surprising but true"
   prompts, camping/outdoors-flavored where it's natural but not forced, so a
   full game (8 rounds) can run several times per group before repeats.
3. `lib/games/campfire-bluff/logic.ts` — `SLUG`, `ROUNDS_PER_GAME`,
   `createRoom`, `sanitize`, plus pure helpers (`shuffle`, `openVoting`,
   `scoreRound`, `computeWinners`).
4. Register the module in [lib/games/modules.ts](../lib/games/modules.ts).
5. Add a `campfireBluffMeta` entry to
   [lib/games/registry.ts](../lib/games/registry.ts) — suggested: mascot
   `skunk` (already implemented in `components/Mascots.tsx` but unused as a
   top-level game mascot — sly/stinky fits a bluffing game), `players: {min: 3,
   max: 10}`, `status: 'coming-soon'` until built, then `'live'`.
6. Client page: a catch-all `app/campfire-bluff/[...slug]/page.tsx` mirroring
   `app/two-tracks-and-a-trick/[...slug]` — supports both `/{gameId}`
   (anonymous) and `/{crewSlug}/{gameId}` (crew) URL shapes.

## Crew integration

Identical in shape to Two Tracks' co-winner write-back. In `next`, when
`phase → 'ended'` and `room.crewSlug` is set and `!room.winRecorded`: loop over
`winnerIds`, calling `recordCrewWin` once per winner; set `room.winRecorded =
true` so a retried request can't double-count. No schema change to `Room`.

## Edge cases & rules

- **Minimum players**: 3 to start (see Resolved decisions).
- **Not enough bluffs to open voting**: `beginVoting` requires at least one
  submitted bluff (so there are ≥2 options — the truth plus one bluff). If
  literally no one has bluffed, the host can't advance; practically this only
  matters right after `start` before anyone's typed anything.
- **Idle / AFK bluffer**: no penalty, no roster drop — see Resolved decisions.
  Their bluff (if any, from a *previous* round) never carries over; each round
  starts `bluffs`/`submittedIds` fresh.
- **Late joiners**: welcome any time before `ended`.
  - During `lobby` / `bluffing` — join normally; if `bluffing` is already
    underway they can still submit a bluff for the *current* round as long as
    voting hasn't opened yet.
  - During `voting` / `revealed` — they join the roster at 0 but are not added
    to the current round's frozen `eligibleVoterIds` (mirrors Two Tracks); they
    become eligible to bluff and vote starting next round.
  - During `ended` — rejected; they wait for the host to `reset`.
- **Disconnected voter at reveal** — counts as no vote; host can `reveal` to
  move on without waiting.
- **Duplicate bluff text** — if two players independently submit identical
  text (or a player accidentally types the real answer verbatim), both/either
  still show as separate options tied to their respective authors; no dedup.
  Rare enough not to special-case, and merging them would require deciding who
  "owns" the merged option's fooled-votes.
- **Bluff validation** — non-empty after trim; no other content restrictions
  (a bluff that happens to equal the true answer is scored as a bluff — the
  author just accidentally leaked it, which is a fine, funny outcome, not a
  bug to prevent).

## Build phases

1. **Core game** — types, `questions.ts` seed content, logic
   (`createRoom`/`sanitize`/`openVoting`/`scoreRound`/`computeWinners`), module
   registration, the eight API routes. Unit-test scoring and the
   reveal/sanitize invariants (answer and authorship never leak pre-reveal).
2. **Client** — lobby, bluff-writing screen (prompt + one text input), voting
   screen (tap an option, own bluff greyed out), reveal screen (truth
   highlighted, each option's author + voters shown, round points), end screen
   with co-winner(s) and final standings.
3. **Crew + polish** — co-winner write-back in `next` (copy Two Tracks'
   implementation), leaderboard surfaced on the end screen and lobby, flip meta
   to `live`.

## Open questions (deferred, sensible defaults assumed)

- **`ROUNDS_PER_GAME` value** — defaulted to 8; easy to retune once playtested
  against the 30-minute target with real question length/reading time.
- **Question bank curation** — mix of general "surprising true facts" and
  camping/nature trivia; exact split is a content decision, not an
  architecture one.
- **Bluff length limits** — none enforced beyond non-empty; revisit if
  someone submits an essay.
