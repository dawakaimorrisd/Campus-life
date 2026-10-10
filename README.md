# Campus Life

A multiplayer campus where something is always happening. Currently **Phases 1 to 10**: walk, sit,
talk, invite, follow, eat, help and cause harmless mischief across a two-floor campus.

**All documentation lives in [`docs/`](docs/README.md).** Start with `docs/testing.md`.

## Run it (GitHub Codespaces)

```bash
cp .env.example .env        # once
npm install                 # once
npm run db:up               # starts Postgres in Docker
npm run dev                 # web on :5173 + game server on :8080

```

Then open the forwarded **5173** port. Pick a name and a look, then enter campus.

**Want to see a crowd while testing alone?** In a second terminal:

```bash
npm run bots -- 14         # 14 wandering fake students
```

### Codespaces notes

- The web client finds the game server by itself (`-5173.` becomes `-8080.` in the URL, over `wss://`).
- If the page sits on "Connecting to campus": Ports tab, right-click **8080**, **Port Visibility**, **Public**.
  Friends on their own phones need it Public too.
- Codespaces stop when idle and take the world with them. Run `npm run db:up` after a restart
  (the included `.devcontainer` does it automatically on a rebuilt Codespace).

## Layout

```
apps/web/          SvelteKit + Phaser client
apps/game-server/  Node + ws, authoritative world, Postgres
packages/shared/   protocol types, campus map + collision, A* pathfinding, avatar palettes
```

`packages/shared` is the contract. Client and server import the same message types and build the
same collision grid, so they cannot disagree about where a wall is.

## How it works

- **Server-authoritative.** Clients send *intent* (`move_to` a point, or `dir` from the keyboard).
  The server owns positions: it runs A* on the tile grid, simulates at 20 ticks per second, and
  broadcasts only the players that changed (`snap`). Idle campus means zero traffic.
- **Client is a renderer.** It eases avatars toward the latest server position. No prediction yet.
- **Everything is drawn in code** (map, furniture, avatars), so there are no art assets to manage.
  Swap in Tiled maps and sprite sheets later without touching gameplay code.
- **Postgres** stores guest players (`players` table, created on boot). If the database is down,
  the game still runs; players just are not saved.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | web + game server together |
| `npm run dev:web` / `dev:server` | one at a time |
| `npm run bots -- 12` | add 12 wandering bots |
| `npm run db:up` / `db:down` | start / stop Postgres |
| `npm run db:psql` | open a psql shell |
| `npm run typecheck` | typecheck everything |

Health check: `GET :8080/health` returns the player count.

## Status

See [`docs/roadmap.md`](docs/roadmap.md). All 10 phases are built and ready to test.
Not yet: real accounts, saving money between visits, sound, weather, time of day.

## Troubleshooting

- **`address already in use :8080` or `:5173`**: stop the old process (`pkill -f tsx`, `pkill -f vite`).
- **`[db] unavailable`**: the game runs anyway. Check `docker compose ps`, then `npm run db:up`.
- **Blank page / Phaser errors after pulling changes**: delete `apps/web/.svelte-kit` and restart.
- **Same name appears twice**: you opened a second tab. The older tab is disconnected on purpose.
