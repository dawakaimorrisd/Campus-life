import './env';
import http from 'node:http';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { DEFAULT_SERVER_PORT, isValidPlayerId, parseClientMsg, sanitizeName, type ServerMsg } from '@campus/shared';
import { World, type ServerPlayer } from './world';
import { closeDb, initDb } from './db';
import { withTimeout, type PlayerRecord } from './store';

const PORT = Number(process.env.PORT) || DEFAULT_SERVER_PORT;
const MAX_MSGS_PER_SECOND = 40;

const store = await initDb();
const world = new World({ store: store ?? undefined });

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, players: world.players.size, database: !!store }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('Campus Life game server is running.\n');
});

const wss = new WebSocketServer({ server, maxPayload: 4096 });
const alive = new WeakMap<WebSocket, boolean>();

wss.on('connection', (ws) => {
  let player: ServerPlayer | null = null;
  let joining = false;
  let windowStart = Date.now();
  let windowCount = 0;

  const sendRaw = (data: string) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  };
  const sendMsg = (msg: ServerMsg) => sendRaw(JSON.stringify(msg));

  alive.set(ws, true);
  ws.on('pong', () => alive.set(ws, true));

  const joinTimeout = setTimeout(() => {
    if (!player && !joining) ws.close(4000, 'Join timeout');
  }, 10_000);

  async function join(playerId: string, name: string, avatar: import('@campus/shared').Avatar) {
    const isBot = playerId.startsWith('bot-');
    let rec: PlayerRecord | null = null;
    if (store && !isBot) {
      // Load what the campus remembers about this person before they walk in. Never let a slow database block them.
      rec = await withTimeout(store.loadPlayer(playerId), 3000, null);
      await withTimeout(Promise.all([world.memory.ensureLoaded(playerId), world.chichi.ensureLoaded(playerId)]), 3000, undefined);
    }
    if (ws.readyState !== WebSocket.OPEN) return;
    player = world.addPlayer({
      id: playerId,
      name,
      avatar,
      money: rec?.money,
      lastSeenMs: rec?.lastSeenMs ?? null,
      send: sendRaw,
      close: (code, reason) => ws.close(code, reason)
    });
    console.log(`[join] ${name} (${world.players.size} online)`);
    if (store && !isBot) void world.persistPlayer(player);
  }

  ws.on('message', (raw: RawData) => {
    const now = Date.now();
    if (now - windowStart > 1000) {
      windowStart = now;
      windowCount = 0;
    }
    if (++windowCount > MAX_MSGS_PER_SECOND) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const msg = parseClientMsg(parsed);
    if (!msg) return;

    if (msg.t === 'ping') {
      sendMsg({ t: 'pong', ts: msg.ts });
      return;
    }

    if (!player) {
      if (msg.t !== 'join' || joining) return;
      // TODO (auth step): verify a signed token from SvelteKit here instead of trusting playerId.
      const name = sanitizeName(msg.name);
      if (!name || !isValidPlayerId(msg.playerId)) {
        sendMsg({ t: 'error', message: 'Invalid name or player id' });
        ws.close(4002, 'Invalid join');
        return;
      }
      joining = true;
      clearTimeout(joinTimeout);
      join(msg.playerId, name, msg.avatar).catch((e) => {
        console.warn('[join] failed:', (e as Error).message);
        ws.close(1011, 'Join failed');
      });
      return;
    }

    if (msg.t === 'join') return;
    world.handle(player, msg);
  });

  ws.on('close', () => {
    clearTimeout(joinTimeout);
    if (!player) return;
    const p = player;
    if (world.removePlayer(p)) console.log(`[leave] ${p.name} (${world.players.size} online)`);
  });

  ws.on('error', (e) => console.warn('[ws] error:', e.message));
});

// Drop connections that stopped answering pings (closed laptop lids, dead phones).
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (alive.get(ws) === false) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, 30_000);

world.start();
server.listen(PORT, '0.0.0.0', () => console.log(`[server] Campus Life game server on :${PORT}`));

async function shutdown() {
  console.log('\n[server] shutting down');
  clearInterval(heartbeat);
  world.stop();
  wss.close();
  server.close();
  await withTimeout(world.persist(), 4000, undefined);
  await closeDb();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
