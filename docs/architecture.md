# Architecture

```
campus-life/
  apps/
    web/           SvelteKit + Phaser client (renderer and UI)
    game-server/   Node + ws, the authoritative world, Postgres
  packages/
    shared/        the contract: protocol, map, collision, pathfinding, constants
  docs/
  docker-compose.yml   Postgres 16
```

## Principles

1. **The server is the truth.** Clients send *intent* (walk here, sit there, say this). Only
   `World` (game-server) decides positions, seats, money and who is holding what.
2. **The client is a renderer.** It eases avatars toward the latest server position. There is no
   client-side prediction yet, which is fine on a campus-scale game.
3. **`packages/shared` is the single source of truth** for the map, so the client and server can
   never disagree about where a wall is. Both build the same collision grid from `buildCampusMap()`.
4. **Everything is drawn in code** (map, furniture, avatars), so there are no art files yet.
   Swap in Tiled maps and sprite sheets later without touching gameplay code.
5. **In-memory world, durable accounts.** Positions, seats, invites and help sessions live in
   memory. Postgres holds durable things (players). Money persistence arrives with Phase 7.

## Game server

| File | Responsibility |
|---|---|
| `index.ts` | HTTP health check, WebSocket server, join, flood limit, heartbeat |
| `world.ts` | The simulation: 20 ticks per second, movement, seats, following, eating, timers |
| `chat.ts` | Nearby talk (range, floor and wall rules), whisper, emotes, chat rate limit |
| `social.ts` | Invite, join, give, food, help sessions, mischief |
| `db.ts` | Postgres connection and the `players` table (the game runs without it) |
| `bots.ts` | Dev tool: fake students who walk, sit, eat, chat and react |

Tick order: follow steering, movement, seat and facing arrivals, timers (eating, help requests),
help sessions, invite expiry, then one `snap` broadcast of only the players that changed.
Idle campus means zero traffic.

## Phases 5 to 10 modules

`groups.ts` (clusters), `events.ts` (event engine), `memory.ts` (social memory), `chichi.ts` (buzz), `store.ts` (storage interface) and `db.ts` (Postgres). The game runs without a database; then money, memory and buzz simply do not persist. Tables: `players`, `relationships`, `interactions`, `buzz`.

## Two floors

The upstairs of the Student Block is a separate "island" of the same grid, far below the ground
campus (rows 84 and up). Staircase tiles are *portals*: pathfinding treats them as edges, so
following, inviting and "walk to the Library" work across floors with no special cases.
Nearby speech, giving, helping and the interaction panel are floor-aware, so two people on
different floors cannot hear or reach each other, even if they stand in the same spot on the map above and below.

## Client

| File | Responsibility |
|---|---|
| `lib/game/CampusScene.ts` | Phaser scene: players, bubbles, emotes, seat hints, camera, input |
| `lib/game/drawWorld.ts` | Paints the campus once into one texture; hut roofs; signs |
| `lib/game/avatarTexture.ts` | Draws avatars (standing and sitting) and plates |
| `lib/game/store.svelte.ts` | The reactive state the UI reads; the scene writes it |
| `lib/game/net.ts` | WebSocket wrapper with reconnect; finds the server URL in Codespaces |
| `lib/PlayerPanel.svelte` | The contextual actions for a tapped player |
| `lib/ChatBar.svelte` | Typing, quick phrases, reactions |
| `lib/Overlays.svelte` | Toasts, invite cards, help progress |

## Anti-abuse built in from the start

Input is validated in `parseClientMsg`; messages are capped at 4 KB and 40 per second; chat is
limited to 6 messages per 8 seconds; mischief is opt-out and has cooldowns, a victim shield and a
per-minute prank cap; every range check is done on the server.

## Authentication (not yet)

Players are guests identified by a browser-generated id. `index.ts` has a marked TODO where the
server will verify a signed token issued by SvelteKit once accounts exist.
