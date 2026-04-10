# Blank Slate — Remote Play App

## Overview

A lightweight web app for playing Blank Slate over Zoom with a remote team. No logins, no installs — share a link and play.

---

## Game Rules Summary

- A **cue card** is shown with a partial phrase (e.g., "FIRE ___" or "___ DAY")
- All players simultaneously write one word to complete the phrase
- **Scoring per round:**
  - Exactly 2 players write the same word → each earns **3 points**
  - 3+ players write the same word → each earns **1 point**
  - Unique / unmatched answers → **0 points**
- First player to reach **25 points** wins

---

## Core Requirements

### Game Setup

- A **host** creates a new game room and receives a unique shareable URL (e.g., `/game/abc123`)
- Players join by opening the link and entering their **display name** (no account or login required)
- Host can start the game once players have joined (minimum 3 players recommended)
- Player count: supports up to ~8 players (original game is designed for 3–8)

### Gameplay Loop (per round)

1. **Cue card display:** A cue card is shown to all players (e.g., "GOLD ___")
2. **Answer phase:** Each player types their word and submits; answers are hidden from others until all have submitted or the host triggers reveal
3. **Reveal phase:** Host manually triggers reveal — all answers are shown simultaneously
4. **Scoring:** App automatically calculates and awards points based on matching rules
5. **Score display:** Updated scoreboard visible to all players after each round
6. **Next round:** Host manually advances to the next card

### Cards / Cue Deck

- App includes a built-in word list (~200 community-sourced cue cards)
- Cards are defined in a single flat file (`cards.ts` or `cards.js`) so new ones can be added easily
- Cards are shown in random order each game, without repeating within a session
- Host can skip a card if desired
- No rotating "Selector" role — host controls pace for all rounds

### Scoring & Endgame

- Live scoreboard visible to all players throughout the game
- Game ends when any player reaches 25 points
- Winner screen shown at end
- Option to start a new game (resets scores, reshuffles deck)

---

## User Roles

| Role | Description |
|------|-------------|
| **Host** | Creates the room; triggers reveal and next card each round; can skip cards; starts new game |
| **Player** | Joins via link, enters name, submits answers each round |

> The host is also a player and submits answers like everyone else.

---

## UX Requirements

- **No login / no accounts** — name entry only
- **Mobile-friendly** — players should be able to participate from their phone
- Works in modern browsers (Chrome, Safari, Firefox, Edge)
- Clean, readable UI — large text for cue cards, easy answer input
- **Answer lock:** Once submitted, an answer cannot be changed
- **"Waiting for..." indicator** showing which players haven't submitted yet (by name, not answer)
- Round history: players can scroll back to see answers from previous rounds

---

## Out of Scope (v1)

- User accounts or persistent profiles
- Answer validation (one word, no blanks, etc.)
- Chat or voice (players use Zoom for that)
- Timed answer phases
- Spectator mode
- Leaderboards across multiple games
- Mobile app (web only)

---

## Technical Approach

### Vercel Constraint

Vercel runs **serverless functions** — no persistent process, no in-memory state between requests, no native WebSockets. The architecture needs to account for this.

### Chosen Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend + API routes | **Next.js** (App Router) | Native Vercel support, simple API routes |
| Real-time sync | **Pusher Channels** (free tier) | Easiest real-time layer for serverless; 100 concurrent connections, 200k messages/day — plenty for a small team |
| Game state storage | **Upstash Redis** (free tier) | Serverless-friendly key-value store; persists game state between API calls |
| Hosting | **Vercel** | Free tier, instant deploys from GitHub |

### Why Pusher?

Vercel serverless functions can't hold open WebSocket connections. Pusher acts as the real-time broker: the server pushes events (reveal triggered, scores updated, player joined) to all connected clients via Pusher Channels without needing a persistent process.

### Why Upstash Redis?

Each Vercel function invocation is stateless. Game state (players, scores, current card, submitted answers) needs to live somewhere between API calls. Upstash is a serverless Redis that works seamlessly with Vercel — no always-on server required.

### Room / Session Model

- Each game gets a short unique ID (e.g., 6 random chars)
- URL: `https://yourapp.vercel.app/game/XYZ123`
- Game state stored in Redis under key `game:XYZ123`
- State auto-expires after 24 hours (no manual cleanup needed)

### Card List

- Stored in `/lib/cards.ts` as a plain exported array of strings
- Easy to add new cues by appending to the array
- Shuffled fresh each game on the server side

### Project Structure (proposed)

```
blank-slate/
├── app/
│   ├── page.tsx              # Home — create or join a game
│   ├── game/[id]/
│   │   └── page.tsx          # Game room UI
│   └── api/
│       ├── game/
│       │   ├── create/route.ts     # POST — create new game
│       │   ├── join/route.ts       # POST — join game, register name
│       │   ├── submit/route.ts     # POST — submit answer
│       │   ├── reveal/route.ts     # POST — host triggers reveal
│       │   ├── next/route.ts       # POST — host advances to next card
│       │   └── skip/route.ts       # POST — host skips current card
│       └── state/[id]/route.ts     # GET — fetch current game state
├── lib/
│   ├── cards.ts              # Full cue card list (easy to edit)
│   ├── redis.ts              # Upstash Redis client
│   └── pusher.ts             # Pusher server + client config
└── components/
    ├── Lobby.tsx
    ├── GameBoard.tsx
    ├── Scoreboard.tsx
    └── RoundHistory.tsx
```

---

## Dependencies

- `next` — framework
- `@upstash/redis` — serverless Redis client
- `pusher` — server-side Pusher SDK
- `pusher-js` — client-side Pusher SDK
- `nanoid` — short unique room IDs
