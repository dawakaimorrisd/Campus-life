import {
  RACE_AUTO_OPEN_MS, RACE_COOLDOWN_MS, RACE_COUNTDOWN_MS, RACE_FALSE_START_PX, RACE_FINISH_PAY, RACE_FLAG_X, RACE_GRACE_MS, RACE_MAX_MS,
  RACE_MAX_RUNNERS, RACE_MIN_RUNNERS, RACE_OPEN_MS, RACE_QUEUE_MAX, RACE_START_X, RACE_WIN_PAY, RACE_Y0, RACE_Y1, TILE, levelAt,
  type RacePhase, type RaceResult, type RaceState
} from '@campus/shared';
import type { ServerPlayer, World } from './world';

interface Runner { id: string; name: string; turned: boolean; finishedAt: number; lane: number }

/**
 * The Sprint Track: a friendly race to the flag and back for at most 6 runners at a time.
 * Press Join to open a race (or to enter one that is open). 20 seconds to gather, 3 second countdown, then GO.
 * A false start (leaving the line early) puts you out. First back wins 12 LD, others who finish in time get 3 LD.
 * Anyone else joins the waiting list; when a race ends the next one opens by itself for the people waiting.
 */
export class RaceEngine {
  private phase: RacePhase = 'idle';
  private runners = new Map<string, Runner>();
  private queue: Array<{ id: string; name: string }> = [];
  private out: string[] = [];
  private startsAt = 0;
  private endsAt = 0;
  private results: RaceResult[] = [];
  private cooldownUntil = 0;
  private autoOpenAt = 0;

  constructor(private world: World) {}

  has(id: string) { return this.runners.has(id) || this.queue.some((q) => q.id === id); }
  inRace(id: string) { return this.runners.has(id); }

  state(): RaceState {
    return {
      phase: this.phase,
      entrants: [...this.runners.values()].map((r) => ({ id: r.id, name: r.name, turned: r.turned, lane: r.lane })),
      queue: this.queue.slice(), cap: RACE_MAX_RUNNERS, out: this.out.slice(),
      startsAt: this.startsAt, endsAt: this.endsAt, results: this.results, now: this.world.now()
    };
  }
  private send() { this.world.broadcast({ t: 'race', ...this.state() }); }
  sendTo(p: ServerPlayer) { this.world.send(p, { t: 'race', ...this.state() }); }

  private lanes() { const used = new Set([...this.runners.values()].map((r) => r.lane)); let l = 0; while (used.has(l)) l++; return l; }

  private add(p: ServerPlayer) {
    this.runners.set(p.id, { id: p.id, name: p.name, turned: false, finishedAt: 0, lane: this.lanes() });
    this.world.stand(p);
    p.path = []; p.dirX = 0; p.dirY = 0;
    this.world.notice(p, 'You are in the race. Go to the start line and wait. Do not leave it before GO!', 'good');
  }

  /** Join (or open) a race. Returns false if the player was put on the waiting list. */
  join(p: ServerPlayer) {
    const now = this.world.now();
    if (this.runners.has(p.id)) return this.world.notice(p, 'You are in. Wait for the others.', 'info');
    if (this.queue.some((q) => q.id === p.id)) return this.world.notice(p, `You are on the waiting list (place ${this.queue.findIndex((q) => q.id === p.id) + 1}).`, 'info');
    if (this.phase === 'idle' && now < this.cooldownUntil && !this.queue.length) return this.world.notice(p, `Let the runners catch their breath. Next race in ${Math.ceil((this.cooldownUntil - now) / 1000)}s.`, 'warn');
    if (this.phase === 'idle' && !this.queue.length) {
      this.open(now);
      this.world.events.emit('buzz', `${p.name} is starting a sprint race at the Recreation Ground. Join in!`, { x: p.x, y: p.y }, { key: 'race', cooldownMs: 30_000, tone: 'fun', priority: false });
    }
    if (this.phase === 'open' && this.runners.size < RACE_MAX_RUNNERS && !this.queue.length) this.add(p);
    else {
      if (this.queue.length >= RACE_QUEUE_MAX) return this.world.notice(p, 'The waiting list is full. Try again in a bit.', 'warn');
      this.queue.push({ id: p.id, name: p.name });
      this.world.notice(p, this.phase === 'running' ? `A race is on. You are on the waiting list (place ${this.queue.length}) for the next one.` : `The race is full. You are on the waiting list (place ${this.queue.length}).`, 'info');
    }
    this.send();
  }

  leave(p: ServerPlayer) {
    const was = this.runners.delete(p.id);
    const q = this.queue.findIndex((x) => x.id === p.id);
    if (q >= 0) this.queue.splice(q, 1);
    if (was || q >= 0) { this.world.notice(p, 'You left the race.', 'info'); this.promote(); this.send(); }
  }

  private open(now: number) {
    this.phase = 'open';
    this.startsAt = now + RACE_OPEN_MS;
    this.endsAt = 0;
    this.results = [];
    this.out = [];
    this.autoOpenAt = 0;
  }

  /** Move people from the waiting list into free places (while the race is open). */
  private promote() {
    if (this.phase !== 'open') return;
    while (this.runners.size < RACE_MAX_RUNNERS && this.queue.length) {
      const q = this.queue.shift()!;
      const p = this.world.players.get(q.id);
      if (!p || !this.world.games.inArea(p)) continue;
      this.add(p);
      this.world.notice(p, 'A place opened. You are in the next race!', 'good');
    }
  }

  tick(now: number) {
    if (this.phase === 'idle') {
      if (this.queue.length && now >= this.cooldownUntil) {
        this.open(now);
        this.promote();
        this.send();
      }
      return;
    }
    if (this.phase === 'open' && now >= this.startsAt) {
      this.promote();
      if (this.runners.size < RACE_MIN_RUNNERS) {
        for (const id of this.runners.keys()) { const p = this.world.players.get(id); if (p) this.world.notice(p, 'Nobody else joined, so the race was cancelled. Bring a friend!', 'info'); }
        this.reset(now, 0);
        return;
      }
      this.phase = 'running';
      this.startsAt = now + RACE_COUNTDOWN_MS;
      this.endsAt = this.startsAt + RACE_MAX_MS;
      // everybody to their lane on the start line
      for (const r of this.runners.values()) {
        const p = this.world.players.get(r.id);
        if (!p) continue;
        p.x = 4.5 * TILE; p.y = (RACE_Y0 / TILE + 0.5 + r.lane) * TILE; p.facing = 'right'; p.moving = false;
        this.world.broadcast({ t: 'snap', tick: this.world.tick, moves: [{ id: p.id, x: Math.round(p.x), y: Math.round(p.y), f: 'right', m: false }] });
      }
      this.send();
      return;
    }
    if (this.phase !== 'running') return;
    if (now < this.startsAt) {
      // false starts
      for (const r of [...this.runners.values()]) {
        const p = this.world.players.get(r.id);
        if (p && p.x > RACE_START_X + RACE_FALSE_START_PX) {
          this.runners.delete(r.id);
          this.out.push(r.id);
          this.world.notice(p, '🚫 False start! You are out of this race.', 'warn');
          this.send();
        }
      }
      return;
    }
    for (const r of this.runners.values()) {
      if (r.finishedAt) continue;
      const p = this.world.players.get(r.id);
      if (!p) { r.finishedAt = -1; continue; }
      if (levelAt(p.y) !== 'ground' || p.y < RACE_Y0 - 64 || p.y > RACE_Y1 + 64) continue;
      if (!r.turned && p.x >= RACE_FLAG_X) { r.turned = true; this.send(); }
      else if (r.turned && p.x <= RACE_START_X) {
        r.finishedAt = now;
        this.results.push({ id: r.id, name: r.name, place: this.results.length + 1, ms: now - this.startsAt });
        if (this.results.length === 1) this.endsAt = Math.min(this.endsAt, now + RACE_GRACE_MS);
        this.send();
      }
    }
    const waiting = [...this.runners.values()].some((r) => !r.finishedAt);
    if (!waiting || now >= this.endsAt) this.finish(now);
  }

  private finish(now: number) {
    for (const res of this.results) {
      const p = this.world.players.get(res.id);
      if (!p) continue;
      const pay = res.place === 1 ? RACE_WIN_PAY : RACE_FINISH_PAY;
      this.world.credit(p, pay);
      this.world.pushSelf(p);
      this.world.notice(p, res.place === 1 ? `🏆 You won the race in ${(res.ms / 1000).toFixed(1)}s! +${pay} LD` : `You finished #${res.place} in ${(res.ms / 1000).toFixed(1)}s. +${pay} LD`, 'good');
      this.world.log('raced', p.id);
    }
    for (const id of this.runners.keys()) if (!this.results.some((r) => r.id === id)) {
      const p = this.world.players.get(id);
      if (p) this.world.notice(p, 'Time is up. You did not finish this time.', 'info');
    }
    const winner = this.results[0];
    if (winner) this.world.events.emit('buzz', `${winner.name} won the sprint race!`, { x: RACE_START_X, y: (RACE_Y0 + RACE_Y1) / 2 }, { key: 'racewin', cooldownMs: 0, tone: 'fun', priority: false });
    this.phase = 'idle';
    this.runners.clear();
    this.cooldownUntil = now + (this.queue.length ? RACE_AUTO_OPEN_MS : RACE_COOLDOWN_MS);
    this.endsAt = 0;
    for (const q of this.queue) { const p = this.world.players.get(q.id); if (p) this.world.notice(p, `The next race opens soon. You are on the list (place ${this.queue.indexOf(q) + 1}).`, 'info'); }
    this.send();
  }

  private reset(now: number, cool: number) {
    this.phase = 'idle'; this.runners.clear(); this.results = []; this.startsAt = this.endsAt = 0; this.cooldownUntil = now + cool;
    this.queue = []; this.out = [];
    this.send();
  }

  removed(id: string) {
    const q = this.queue.findIndex((x) => x.id === id);
    if (q >= 0) this.queue.splice(q, 1);
    if (this.phase === 'open') { if (this.runners.delete(id)) { this.promote(); this.send(); } }
    else if (this.phase === 'running') { const r = this.runners.get(id); if (r && !r.finishedAt) r.finishedAt = -1; }
  }
}
