# Crew Leaderboards — Plan

Persistent, frictionless leaderboards for groups of friends across the Foxflame
games suite. No accounts, no passwords, no OAuth, no email. Pure Upstash Redis.

## Goals

- A group of friends can keep a **consistent historical record of wins** across
  many games and sessions.
- **Zero forced friction**: no signup, no password, no third-party sign-in.
- Cross-device identity is recoverable via a casual **name + 4-digit PIN**.
- Additive only — anonymous one-off rooms keep working exactly as they do today.

## Explicit non-goals (out of scope)

- Slack / Google / any OAuth.
- Email / magic links.
- Points-based or per-game leaderboards. **v1 tracks pure win count only.**
- Strong security. PINs guard bragging rights, not anything sensitive.

## Core concepts

### Identity = `(crew, name)`, re-claimable by PIN

A person *is* their name within a crew. The PIN is the key that re-attaches that
name to a new device. A stable `memberId` (via existing `generateId`) is the
internal handle; the browser caches it in `localStorage` **keyed by crew slug**
(e.g. `crew:{slug}:memberId`) so the common case never sees a PIN prompt and a
single device can carry a distinct identity in each crew it belongs to.

- **First join of a name** → name is free → set a 4-digit PIN → mint `memberId`,
  store `{ name, pinHash }` on the crew roster, cache `memberId` locally
  **keyed by crew slug** (a device can hold a separate identity per crew).
- **Returning, same device** → `localStorage` has a `memberId` for this crew slug
  → silent rejoin.
- **Returning, new device / cleared cache** → pick an existing name → prompt for
  PIN → match → re-bind to that `memberId`, cache it locally. Wins follow you.
- **Guest** → "just play, don't save me" → ephemeral player, no crew write, no PIN.

Friction budget: one PIN, once per device.

### Crew = a persistent room-of-rooms

A long-lived entity that holds a roster and an aggregated win count. Mirrors the
existing room model (a code + a JSON blob in Redis) but without the 24h TTL.

- **Anyone spins up a crew when they create a room.** Creating a room offers an
  optional "Start/continue a crew" step. A room either belongs to a crew or is a
  plain anonymous room (today's behavior).
- A crew has a short code/slug like rooms (reuse `generateId`).

## Data model (Redis / Upstash)

```
crew:{slug}
  -> {
       slug: string,
       name: string,                 // display name, e.g. "Compt"
       createdAt: number,
       hostMemberId: string,         // can reset members' PINs (admin)
       members: {
         [memberId: string]: {
           name: string,
           pinHash: string,          // salted hash, NEVER plaintext, never sent to client
           joinedAt: number,
         }
       }
     }

crew:{slug}:leaderboard  -> ZSET  member memberId -> total wins   // ranked read in one ZREVRANGE
crew:{slug}:history      -> LIST  { gameType, winnerId, winnerName, players: string[], ts }
```

Notes:
- **TTL**: crews use a **90-day sliding TTL**, refreshed on any activity (game
  end, join, leaderboard read). A crew that plays even monthly never expires;
  truly dead crews self-clean. This is the one place the current 24h room
  assumption changes. Refresh by re-`EXPIRE`-ing `crew:{slug}` and its
  `:leaderboard` / `:history` keys together so they age as a unit.
- The ZSET makes "top N" a single command and keeps the win count authoritative
  and separate from the roster blob.

## Changes to existing code

The room shell ([lib/games/types.ts](../lib/games/types.ts)) gains one optional field:

```ts
export interface Room<TGame> {
  // ...existing...
  crewSlug?: string; // present when this room writes back to a crew
}
```

`Player.id` becomes the crew `memberId` when a room is launched inside a crew
(instead of a fresh per-room id), so end-of-game write-back needs no mapping.

### Touch points

| File | Change |
|---|---|
| [lib/redis.ts](../lib/redis.ts) | Add `getCrew`, `saveCrew`, and leaderboard/history helpers (`incrementWin`, `getLeaderboard`, `pushHistory`). |
| [lib/crew.ts](../lib/crew.ts) *(new)* | Crew domain logic: create crew, claim/verify name+PIN, PIN hashing, rate-limit helper. |
| [lib/ids.ts](../lib/ids.ts) | Reuse `generateId` for crew slugs + memberIds. No change. |
| `app/api/crew/*` *(new)* | `create`, `join` (claim name / verify PIN), `leaderboard`, `reset-pin` (host only). |
| [app/api/sync-or-swim/create/route.ts](../app/api/sync-or-swim/create/route.ts) | Accept optional `crewSlug` + `memberId`; stamp `crewSlug` onto the room. |
| [app/api/sync-or-swim/join/route.ts](../app/api/sync-or-swim/join/route.ts) | When room has a `crewSlug`, the join is a crew join (name+PIN) rather than free-text. |
| [app/api/sync-or-swim/next/route.ts](../app/api/sync-or-swim/next/route.ts) | **Write-back point.** When `phase` flips to `'ended'` and `room.crewSlug` is set, `ZINCRBY` the winner and `LPUSH` history — once per game (guard against double-fire). |

### Write-back detail

Game end is already centralized: [next/route.ts:27-28](../app/api/sync-or-swim/next/route.ts#L27-L28)
sets `room.phase = 'ended'` when `room.game.winnerId` exists. That single
transition is the only place to record a win. Make it idempotent (e.g. a
`room.recorded === true` flag) so a retried request can't double-count.

## Security / abuse (lightweight, but do it right)

- PINs hashed with a salt; never stored or transmitted in plaintext.
- Rate-limit PIN attempts per `(crew, name)` — a Redis counter with short TTL —
  to stop brute-forcing 10,000 combinations.
- **Forgotten PIN**: no email = no automated reset. The crew host can reset a
  member's PIN from a roster screen (`reset-pin`, host-only). Fallback: play as a
  new name.
- Impersonation is prevented by the PIN: an unclaimed name is fair game; a
  claimed name requires its PIN.

## Build phases

1. **Crew + leaderboard storage** — Redis helpers, `lib/crew.ts`, crew create/join
   API with name+PIN claim, ZSET write-back wired into `next` game-end. Minimal
   read endpoint.
2. **UI** — crew creation in the room-create flow, name+PIN join screen
   (silent rejoin when `localStorage` has a `memberId` for this crew slug), and
   the leaderboard surfaced in **two places**:
   - **End-of-game results screen** — updated crew standings right after a game
     ends (the highest-impact moment).
   - **Room lobby** — running crew record shown while waiting to start.

   Plus the guest "don't save me" path. (No dedicated crew page or hub surface in
   v1 — leaderboard lives only inside the room flow.)
3. **Admin polish** — host PIN reset, rate limiting. (The `:history` LIST is
   written from day one for the record, but has no UI surface in v1; it's ready
   if a dedicated crew page is added later.)

## v2 — persistent crew lobby (shipped)

v1 deliberately had no crew hub; the crew only existed as a tag on a room, and
each game card carried its own "Play with a crew" button that created a crew
*and* a game in one step. v2 promotes the crew to a first-class place:

- **One crew entry point**, not one per game. The hub has a single "Play with a
  crew" CTA (`CrewSetupModal`, now identity-only) plus a standalone "crew code →
  lobby" box. The per-card crew buttons are gone.
- **`/crew/{slug}` — the persistent, shareable lobby.** Resolves identity once
  (silent rejoin from `localStorage`, else name + PIN via `/api/crew/join`),
  then shows the standings and a launcher for every live game. Creating a game
  here calls the existing `POST /api/{slug}/create` with `{ crewSlug, memberId }`
  and routes to `/{gameSlug}/{crewSlug}/{gameId}` — the URL scheme is unchanged.
  A crew can now exist and be shared with no game in flight.
- **Leaderboard does double duty.** In the lobby the standings board also shows
  *who's here right now* via a Pusher **presence channel** (`presence-crew-{slug}`,
  signed by the new `POST /api/pusher/auth`). Present members get a live green
  dot; a member who just joined the crew is folded in even before the standings
  refetch knows them. Presence identity is cosmetic — the PIN still guards every
  leaderboard write — so the auth route trusts the client-supplied `{memberId,
  name}` for display only, consistent with the lightweight-security stance.

This supersedes the v1 non-goal "no dedicated crew page or hub surface."

## Resolved decisions

- **Crew TTL**: 90-day sliding, refreshed on activity.
- **Leaderboard surfaces**: end-of-game results screen + room lobby only. No
  dedicated crew page or hub surface in v1.
- **Multi-crew**: yes — a device can belong to multiple crews; `memberId` is
  cached in `localStorage` keyed by crew slug.
- **URL scheme**: crew code lives in the path for shareable, trackable links.
  A single catch-all route `app/sync-or-swim/[...slug]` serves both shapes —
  `/sync-or-swim/{gameId}` (anonymous) and `/sync-or-swim/{crewSlug}/{gameId}`
  (crew). The game page canonicalizes to the two-segment form once it learns the
  room's crew, so even joining by room code upgrades the URL.
