/**
 * Dev tool: fills the campus with fake students who walk, sit, eat, chat and react,
 * so you can feel "something is always happening" while building alone.
 *
 *   npm run bots -- 12          # 12 bots (default 8)
 *   npm run bots -- 12 ws://localhost:8080
 */
import './env';
import { WebSocket } from 'ws';
import {
  CAMPUS_MAP, DEFAULT_SERVER_PORT, EMOTES, HAIR_COLORS, QUICK_PHRASES, SHIRT_COLORS, SKIN_TONES, TILE, ZONE_IDS,
  isBlockedTile, zoneGather, type GroupInfo, type PlayerState, type ServerMsg
} from '@campus/shared';

const count = Number(process.argv[2]) || 8;
const url = process.argv[3] || `ws://localhost:${process.env.PORT || DEFAULT_SERVER_PORT}`;
const NAMES = ['James', 'Morris', 'Martha', 'Sarah', 'David', 'Grace', 'Emmanuel', 'Comfort', 'Joseph', 'Esther', 'Prince', 'Mercy', 'Samuel', 'Ruth', 'Kofi', 'Ama'];
const LINES = ['Who going Back Palaver?', 'Bro you hear what happened?', 'Wait for me', 'I dey come', 'Eh, this class hard oh', 'Anybody has pen?', "Let's go Student Center", 'See you at the Hut'];
const rint = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: readonly T[]): T => a[rint(a.length)];
// Bots stay on the ground floor except for the occasional trip to the Library.
const HANGOUTS = ZONE_IDS.filter((z) => !['staircase', 'classroom_b', 'agri_office', 'upstairs_corridor', 'admin_hallway'].includes(z));

function spawnBot(i: number) {
  const id = `bot-${i}-${Math.random().toString(36).slice(2, 10)}`;
  const name = NAMES[i % NAMES.length] + (i >= NAMES.length ? String(i) : '');
  const ws = new WebSocket(url);
  let timer: NodeJS.Timeout | undefined;
  let me: PlayerState | null = null;
  const players = new Map<string, PlayerState>();
  let groups: GroupInfo[] = [];
  const tx = (m: object) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));

  const act = () => {
    const r = Math.random();
    if (!me) return;
    if (r < 0.34) {
      const zone = pick(HANGOUTS);
      const g = zoneGather(CAMPUS_MAP, zone, 70);
      tx({ t: 'move_to', x: g.x, y: g.y });
    } else if (r < 0.5) {
      const seats = CAMPUS_MAP.seats.filter((s) => Math.hypot(s.x - me!.x, s.y - me!.y) < 400 && Math.abs(s.y - me!.y) < 700);
      if (seats.length) tx({ t: 'sit', seat: pick(seats).id });
    } else if (r < 0.62) {
      tx({ t: 'say', text: pick([...QUICK_PHRASES, ...LINES]) });
    } else if (r < 0.72) {
      tx({ t: 'emote', kind: pick(EMOTES) });
    } else if (r < 0.8 && players.size > 1) {
      const others = [...players.values()].filter((p) => p.id !== id && Math.hypot(p.x - me!.x, p.y - me!.y) < 450);
      if (others.length) tx({ t: 'follow', to: pick(others).id });
    } else if (r < 0.86) {
      // Go get food: walk to the stall, buy, then sit somewhere.
      tx({ t: 'move_to', x: 13.5 * TILE, y: 37.5 * TILE });
      setTimeout(() => tx({ t: 'take_food' }), 9000);
    } else if (r < 0.9 && groups.length && Math.random() < 0.6) {
      // Drift toward where people are gathered.
      const gr = pick(groups);
      tx({ t: 'move_to', x: gr.x + (rint(80) - 40), y: gr.y + (rint(80) - 40) });
    } else if (r < 0.93) {
      const spot = pick(CAMPUS_MAP.spots);
      tx({ t: 'move_to', x: (spot.rect.x + spot.rect.w / 2) * TILE, y: (spot.rect.y + spot.rect.h + 0.5) * TILE });
      setTimeout(() => tx({ t: 'use_spot', spot: spot.id }), 9000);
    } else if (r < 0.95) {
      tx({ t: 'invite_all', place: pick(['here', 'back_palaver', 'palaver_hut'] as const) });
    } else if (r < 0.97) {
      tx({ t: 'escape' });
    } else {
      tx({ t: 'unfollow' });
      tx({ t: 'stand' });
    }
    timer = setTimeout(act, 3500 + rint(9000));
  };

  ws.on('open', () => {
    tx({ t: 'join', playerId: id, name, avatar: { skin: rint(SKIN_TONES.length), shirt: rint(SHIRT_COLORS.length), hair: rint(HAIR_COLORS.length) } });
    timer = setTimeout(act, 800 + rint(2500));
  });
  ws.on('message', (raw) => {
    let m: ServerMsg;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    if (m.t === 'welcome') {
      players.clear();
      for (const p of m.players) players.set(p.id, p);
      me = players.get(m.selfId) ?? null;
    } else if (m.t === 'player_joined' || m.t === 'player_state') {
      players.set(m.player.id, m.player);
      if (m.player.id === id) me = m.player;
    } else if (m.t === 'player_left') players.delete(m.id);
    else if (m.t === 'snap') {
      for (const mv of m.moves) {
        const p = players.get(mv.id);
        if (p) { p.x = mv.x; p.y = mv.y; }
      }
    } else if (m.t === 'groups') {
      groups = m.groups;
    } else if (m.t === 'invite') {
      tx({ t: 'invite_reply', id: m.id, accept: Math.random() < 0.7 });
    }
  });
  ws.on('close', () => {
    if (timer) clearTimeout(timer);
    setTimeout(() => spawnBot(i), 3000);
  });
  ws.on('error', () => {});
}

console.log(`[bots] spawning ${count} bots -> ${url}`);
for (let i = 0; i < count; i++) setTimeout(() => spawnBot(i), i * 250);
void isBlockedTile;
