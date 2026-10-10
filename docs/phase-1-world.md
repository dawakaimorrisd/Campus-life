# Phase 1: World

**Goal:** can I walk around campus and see other people?

## What was built
- Phaser top-down campus rendered from code, with collision.
- Click or tap to walk (A* pathfinding on the tile grid, run on the server) and WASD or arrow keys.
- Authoritative server at 20 ticks per second; clients ease avatars toward server positions.
- Guest profile (name and three colour choices) saved in the browser.
- Camera follow with zoom that adapts to screen size; HUD with zone name, players online and ping.
- Postgres `players` table; the game keeps running if the database is down.
- Reconnect with back-off; a second tab with the same player replaces the first.

## Key decisions
Server-authoritative movement from day one, shared map package, everything drawn in code, Postgres in Docker for local and production parity.

## Done when
Two phones and a laptop can see each other walking without jitter.
