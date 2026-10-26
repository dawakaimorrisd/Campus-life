# Deploying: Netlify + Neon + a game server host

```
Phone (PWA)  ->  Netlify (web app, static)
     |
     +--wss-->  Game server (Render / Fly.io / Railway)  -->  Neon Postgres
```

Why three parts: Netlify serves files and short functions. The game needs one always-running server that keeps WebSocket connections open, so it runs on a Node host. All players must connect to the same one.

## 1. Neon (database)
1. Copy the connection string (use the "pooled" one). It ends with `?sslmode=require`.
2. Nothing to create by hand: the game server makes its tables on first start.
3. Neon's free database sleeps when idle. The first connection after a pause can take a few seconds; the server waits up to 10 s.

## 2. Game server (needs a host that runs a long process)
Render is the simplest:
1. New Web Service, connect your GitHub repo, runtime Docker (uses the `Dockerfile` in the repo root).
2. Environment variable: `DATABASE_URL` = your Neon string. `PORT` is set by Render.
3. Health check path: `/health`.
4. Deploy. Your server URL looks like `https://campus-game.onrender.com`. The WebSocket address is the same with `wss://`.

Free tiers sleep after idle time, so the first player waits a little. A paid or always-on plan fixes that. Run ONE instance only: players on different instances would not see each other.

## 3. Netlify (web app)
1. New site from Git, pick the repo. `netlify.toml` already holds the build settings (publish folder `apps/web/build`).
2. Site settings, Environment variables: `VITE_WS_URL` = `wss://campus-game.onrender.com` (your game server).
3. Deploy. Change `VITE_WS_URL` later and you must trigger a new deploy, because it is baked in at build time.

## 4. Install as an app (PWA)
- Android Chrome: open the site, tap "Install Campus Life" on the first screen (or the browser menu, Install app).
- iPhone Safari: Share, Add to Home Screen.
- It opens full screen with its own icon. The game itself still needs a connection.
- The service worker is `apps/web/src/service-worker.ts`; the icons are in `apps/web/static/icons`.

## Check it works
- Open `https://<your-game-server>/health`: it shows players and `database: true`.
- Open the Netlify site on two phones: you should see each other.
- If the page loads but nobody appears: the `VITE_WS_URL` is wrong or missing (must start with `wss://`).
