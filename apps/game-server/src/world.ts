import {
  BOND_NOTIFY_MIN, CAMPUS_MAP, EAT_TIME_MS, EVENT_TICK_MS, GROUP_MAX_PAIRS, PERSIST_MS, TOGETHER_SAMPLE_MS, WELCOME_BACK_MS,
  WORK_COOLDOWN_MS, WORK_PAY, FOLLOW_GAP, FOLLOW_GIVEUP, FOLLOW_RANGE, MAX_FOLLOWERS, PLAYER_SPEED, SIT_MAX_DIST,
  START_MONEY, TICK_RATE, WORLD_H, WORLD_W, canStand, dist, findPath, hash01, levelAt, portalAt, randomSpawn,
  type Avatar, type ClientMsg, type Doing, type Facing, type GroupInfo, type HelpKind, type InvitePlace, type ItemKind, type NoticeTone,
  type PlayerState, type Seat, type SelfState, type ServerMsg, type SnapMove, type Vec, type Waypoint
} from '@campus/shared';
import { emote, say, whisper } from './chat';
import * as social from './social';
import { computeClusters, publicGroups, type Cluster } from './groups';
import { EventEngine } from './events';
import { SocialMemory } from './memory';
import { Chichi } from './chichi';
import type { Store } from './store';

export interface Invite { id: string; from: string; to: string; place: InvitePlace; expires: number }

export interface HelpSession {
  id: string; helper: string; requester: string; kind: HelpKind;
  progress: number; farMs: number; lastSent: number;
}

export interface ServerPlayer {
  id: string; name: string; avatar: Avatar;
  x: number; y: number; facing: Facing; moving: boolean;
  path: Waypoint[]; dirX: number; dirY: number;
  send: (data: string) => void;
  close: (code: number, reason: string) => void;
  seat: string | null; pendingSeat: string | null; faceTarget: string | null;
  following: string | null; nextFollowAt: number;
  held: ItemKind | null; eatingUntil: number; hotFor: string | null; hotUntil: number;
  money: number; allowMischief: boolean; mischiefShieldUntil: number;
  asking: HelpKind | null; askingUntil: number; helpSessionId: string | null;
  chatTimes: number[]; lastEmoteAt: number; prankTimes: number[]; cooldowns: Map<string, number>;
  // Phases 5 to 10
  doing: Doing | null; doingUntil: number; workSpot: string | null;
  boostMul: number; boostUntil: number;
  stealTimes: number[]; mischiefLockUntil: number; watchedUntil: number;
  savedMoney: number;
}

export interface WorldHooks {
  onInteraction?(kind: string, a: string, b: string | null): void;
}
export interface WorldOptions { clock?: () => number; hooks?: WorldHooks; store?: Store }
export type NewPlayer = Pick<ServerPlayer, 'id' | 'name' | 'avatar' | 'send' | 'close'> & { money?: number; lastSeenMs?: number | null };

const r1 = (n: number) => Math.round(n * 10) / 10;
const faceFrom = (dx: number, dy: number): Facing =>
  Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';

/**
 * The authoritative world. Clients send intent; only this class decides what is true.
 * chat.ts handles talk, social.ts handles the verbs.
 */
export class World {
  readonly players = new Map<string, ServerPlayer>();
  readonly invites = new Map<string, Invite>();
  readonly helpSessions = new Map<string, HelpSession>();
  readonly helpPairs = new Map<string, number>();
  readonly seatsById = new Map<string, Seat>(CAMPUS_MAP.seats.map((s) => [s.id, s]));
  /** seat id -> player id (includes players still walking to the seat). */
  readonly seatOwner = new Map<string, string>();
  readonly hooks: WorldHooks;
  readonly clock: () => number;
  readonly store?: Store;
  readonly memory: SocialMemory;
  readonly chichi: Chichi;
  readonly events: EventEngine;
  /** Where people recently slipped out of class, per zone (for "left together"). */
  readonly escapes = new Map<string, Array<{ id: string; t: number }>>();
  /** Every cluster of 2 or more people this second; clients only see the ones with 3+. */
  clusters: Cluster[] = [];
  /** When each spot was last used (shared cooldowns such as the music). */
  readonly spotUsedAt = new Map<string, number>();
  private lastGroupsJson = '[]';
  private nextCluster = 0;
  private nextTogether = 0;
  private nextPersist = 0;
  tick = 0;
  private timer: NodeJS.Timeout | null = null;
  private last = performance.now();
  private nextHousekeeping = 0;

  constructor(opts: WorldOptions = {}) {
    this.clock = opts.clock ?? (() => Date.now());
    this.hooks = opts.hooks ?? {};
    this.store = opts.store;
    this.events = new EventEngine(this);
    this.memory = new SocialMemory(this, this.store);
    this.chichi = new Chichi(this, this.store);
  }
  now() { return this.clock(); }

  // ---------- lifecycle ----------
  start() {
    if (this.timer) return;
    this.last = performance.now();
    this.timer = setInterval(() => {
      const t = performance.now();
      const dt = Math.min((t - this.last) / 1000, 0.25);
      this.last = t;
      this.step(dt);
    }, 1000 / TICK_RATE);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  addPlayer(init: NewPlayer): ServerPlayer {
    const existing = this.players.get(init.id);
    if (existing) {
      this.removePlayer(existing);
      existing.close(4001, 'Signed in from another tab');
    }
    const spawn = randomSpawn(CAMPUS_MAP);
    const player: ServerPlayer = {
      id: init.id, name: init.name, avatar: init.avatar, send: init.send, close: init.close,
      x: spawn.x, y: spawn.y, facing: 'up', moving: false, path: [], dirX: 0, dirY: 0,
      seat: null, pendingSeat: null, faceTarget: null, following: null, nextFollowAt: 0,
      held: null, eatingUntil: 0, hotFor: null, hotUntil: 0,
      money: init.money ?? START_MONEY, allowMischief: true, mischiefShieldUntil: 0,
      asking: null, askingUntil: 0, helpSessionId: null,
      chatTimes: [], lastEmoteAt: 0, prankTimes: [], cooldowns: new Map(),
      doing: null, doingUntil: 0, workSpot: null, boostMul: 1, boostUntil: 0,
      stealTimes: [], mischiefLockUntil: 0, watchedUntil: 0, savedMoney: init.money ?? START_MONEY
    };
    this.memory.setName(player.id, player.name);
    this.players.set(player.id, player);
    this.send(player, {
      t: 'welcome', selfId: player.id, tick: this.tick,
      players: [...this.players.values()].map((p) => this.toState(p)), self: this.selfState(player)
    });
    this.broadcast({ t: 'player_joined', player: this.toState(player) }, player.id);
    this.afterJoin(player, init.lastSeenMs ?? null);
    return player;
  }

  /** "Your social world continues without you": tell people who is here that they know. */
  private afterJoin(p: ServerPlayer, lastSeenMs: number | null) {
    const known = [...this.players.values()].filter((o) => o !== p && this.memory.bond(p.id, o.id) >= 1);
    const away = lastSeenMs !== null && this.now() - lastSeenMs > WELCOME_BACK_MS;
    if (known.length) {
      const names = known.slice(0, 3).map((o) => o.name);
      const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      this.notice(p, `${away ? 'Welcome back. ' : ''}${list} ${known.length > 1 ? 'are' : 'is'} here.`, 'info');
    } else if (away) this.notice(p, 'Welcome back.', 'info');
    for (const o of known) if (this.memory.bond(p.id, o.id) >= BOND_NOTIFY_MIN) this.notice(o, `${p.name} just came online.`, 'info');
  }

  /** Idempotent. Only removes this exact player object, so a stale socket can't evict a newer one. */
  removePlayer(player: ServerPlayer): boolean {
    if (this.players.get(player.id) !== player) return false;
    this.players.delete(player.id);
    this.releaseSeat(player);
    social.onPlayerLeft(this, player);
    this.broadcast({ t: 'player_left', id: player.id });
    void this.persistPlayer(player);
    return true;
  }

  // ---------- messaging helpers ----------
  toState(p: ServerPlayer): PlayerState {
    return {
      id: p.id, name: p.name, avatar: p.avatar, x: r1(p.x), y: r1(p.y), facing: p.facing, moving: p.moving,
      seat: p.seat, held: p.held, following: p.following, eating: p.eatingUntil > this.now(),
      asking: p.asking, hotFor: p.hotFor, doing: p.doing, watched: p.watchedUntil > this.now()
    };
  }
  selfState(p: ServerPlayer): SelfState { return { money: p.money, mischief: p.allowMischief }; }
  send(p: ServerPlayer, msg: ServerMsg) { p.send(JSON.stringify(msg)); }
  broadcast(msg: ServerMsg, exceptId?: string) {
    const data = JSON.stringify(msg);
    for (const p of this.players.values()) if (p.id !== exceptId) p.send(data);
  }
  sendNear(origin: Vec, range: number, msg: ServerMsg | ((p: ServerPlayer) => ServerMsg)) {
    for (const p of this.players.values()) {
      if (dist(origin, p) <= range) this.send(p, typeof msg === 'function' ? msg(p) : msg);
    }
  }
  notice(p: ServerPlayer, text: string, tone: NoticeTone = 'info') { this.send(p, { t: 'notice', text, tone }); }
  pushState(p: ServerPlayer) { this.broadcast({ t: 'player_state', player: this.toState(p) }); }
  pushSelf(p: ServerPlayer) { this.send(p, { t: 'self', self: this.selfState(p) }); }
  /** Every meaningful thing players do goes through here: memory, buzz, campus events, and any outside hook. */
  log(kind: string, a: string, b: string | null = null) {
    this.hooks.onInteraction?.(kind, a, b);
    this.memory.record(kind, a, b);
    this.chichi.apply(kind, a, b);
    this.events.onInteraction(kind, a, b);
  }
  cooldownLeft(p: ServerPlayer, key: string): number { return Math.max(0, (p.cooldowns.get(key) ?? 0) - this.now()); }
  setCooldown(p: ServerPlayer, key: string, ms: number) { p.cooldowns.set(key, this.now() + ms); }

  // ---------- input ----------
  handle(p: ServerPlayer, msg: ClientMsg) {
    switch (msg.t) {
      case 'move_to': return this.moveTo(p, msg.x, msg.y);
      case 'dir': return this.setDirection(p, msg.x, msg.y);
      case 'sit': return void this.sit(p, msg.seat);
      case 'stand': return this.stand(p);
      case 'say': return say(this, p, msg.text, !!msg.q);
      case 'whisper': return whisper(this, p, msg.to, msg.text);
      case 'emote': return emote(this, p, msg.kind);
      case 'invite': return social.invite(this, p, msg.to, msg.place);
      case 'invite_reply': return social.inviteReply(this, p, msg.id, msg.accept);
      case 'follow': return void this.follow(p, msg.to, true);
      case 'unfollow': return this.stopFollowing(p, true);
      case 'join_in': return social.joinIn(this, p, msg.to);
      case 'give': return social.give(this, p, msg.to, msg.item, msg.amount);
      case 'take_food': return social.takeFood(this, p);
      case 'ask_help': return social.askHelp(this, p, msg.kind);
      case 'cancel_help': return social.cancelHelp(this, p);
      case 'offer_help': return social.offerHelp(this, p, msg.to);
      case 'steal': return social.steal(this, p, msg.to);
      case 'reclaim': return social.reclaim(this, p, msg.from);
      case 'prank': return social.prank(this, p, msg.to);
      case 'settings': return social.settings(this, p, msg.mischief);
      case 'invite_all': return social.inviteAll(this, p, msg.place);
      case 'use_spot': return social.useSpot(this, p, msg.spot);
      case 'escape': return social.escape(this, p);
      case 'cancel_activity': return this.cancelDoing(p);
      case 'peek': return social.peek(this, p, msg.id);
      default: return;
    }
  }

  // ---------- movement ----------
  /** Cancel anything steering this player (a follow, a seat, a pending turn). Returns true if they were seated. */
  private takeControl(p: ServerPlayer) {
    if (p.doing === 'work') this.cancelDoing(p);
    const wasSeated = this.releaseSeat(p);
    this.stopFollowing(p, false);
    p.faceTarget = null;
    p.dirX = 0;
    p.dirY = 0;
    return wasSeated;
  }

  moveTo(p: ServerPlayer, x: number, y: number) {
    const wasSeated = this.takeControl(p);
    p.path = findPath(CAMPUS_MAP, p.x, p.y, Math.min(Math.max(x, 0), WORLD_W - 1), Math.min(Math.max(y, 0), WORLD_H - 1));
    if (wasSeated) this.pushState(p);
  }
  /** Walk somewhere, optionally turning to face a player on arrival. */
  walkTo(p: ServerPlayer, x: number, y: number, faceId: string | null = null) {
    this.moveTo(p, x, y);
    p.faceTarget = faceId;
  }
  setDirection(p: ServerPlayer, x: number, y: number) {
    if (x === 0 && y === 0) { p.dirX = 0; p.dirY = 0; return; }
    const wasSeated = this.takeControl(p);
    p.path = [];
    p.dirX = x;
    p.dirY = y;
    if (wasSeated) this.pushState(p);
  }

  /** Stop whatever timed activity this player is doing (working, riding, sneaking). */
  cancelDoing(p: ServerPlayer) {
    if (!p.doing) return;
    const was = p.doing;
    p.doing = null;
    p.workSpot = null;
    if (was === 'ride') p.boostUntil = 0;
    this.pushState(p);
    if (was === 'work') this.notice(p, 'You stopped working.', 'info');
  }

  // ---------- seats ----------
  releaseSeat(p: ServerPlayer): boolean {
    const wasSeated = p.seat !== null;
    if (p.seat && this.seatOwner.get(p.seat) === p.id) this.seatOwner.delete(p.seat);
    if (p.pendingSeat && this.seatOwner.get(p.pendingSeat) === p.id) this.seatOwner.delete(p.pendingSeat);
    p.seat = null;
    p.pendingSeat = null;
    return wasSeated;
  }
  stand(p: ServerPlayer) { if (this.releaseSeat(p)) this.pushState(p); }
  seatIsFree(seatId: string, forId?: string) {
    const owner = this.seatOwner.get(seatId);
    return !owner || owner === forId;
  }

  sit(p: ServerPlayer, seatId: string, quiet = false): boolean {
    const seat = this.seatsById.get(seatId);
    if (!seat) return false;
    const say = (t: string) => { if (!quiet) this.notice(p, t, 'warn'); };
    if (!this.seatIsFree(seatId, p.id)) { say('Someone is already sitting there.'); return false; }
    if (levelAt(seat.y) !== levelAt(p.y) || Math.hypot(seat.x - p.x, seat.y - p.y) > SIT_MAX_DIST) {
      say('That seat is too far away. Walk closer first.');
      return false;
    }
    const wasSeated = this.takeControl(p);
    const here = Math.hypot(seat.x - p.x, seat.y - p.y) < 14;
    const path = here ? [] : findPath(CAMPUS_MAP, p.x, p.y, seat.x, seat.y);
    if (!here && path.length === 0) {
      say("Can't reach that seat.");
      if (wasSeated) this.pushState(p);
      return false;
    }
    this.seatOwner.set(seatId, p.id);
    p.pendingSeat = seatId;
    p.path = path;
    if (here) this.arriveSeat(p);
    else if (wasSeated) this.pushState(p);
    return true;
  }

  /** Nearest free seat to a point on the same level, or null. */
  freeSeatNear(x: number, y: number, range: number, forId?: string): Seat | null {
    let best: Seat | null = null;
    let bd = range;
    for (const s of this.seatsById.values()) {
      if (!this.seatIsFree(s.id, forId)) continue;
      if (levelAt(s.y) !== levelAt(y)) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  private arriveSeat(p: ServerPlayer) {
    const seat = p.pendingSeat ? this.seatsById.get(p.pendingSeat) : undefined;
    if (!seat) { p.pendingSeat = null; return; }
    p.x = seat.x; p.y = seat.y; p.facing = seat.facing;
    p.seat = seat.id; p.pendingSeat = null; p.path = []; p.moving = false;
    this.pushState(p);
  }

  // ---------- following ----------
  follow(p: ServerPlayer, targetId: string, announce: boolean): boolean {
    const t = this.players.get(targetId);
    if (!t || t === p) return false;
    if (dist(p, t) > FOLLOW_RANGE) { this.notice(p, 'They are too far away to follow. Walk closer first.', 'warn'); return false; }
    for (let cur: ServerPlayer | undefined = t, hops = 0; cur && hops < 10; cur = cur.following ? this.players.get(cur.following) : undefined, hops++) {
      if (cur === p) { this.notice(p, 'They are already following you.', 'warn'); return false; }
    }
    let followers = 0;
    for (const o of this.players.values()) if (o.following === t.id) followers++;
    if (followers >= MAX_FOLLOWERS && p.following !== t.id) { this.notice(p, 'Too many people are already following them.', 'warn'); return false; }
    this.takeControl(p);
    p.path = [];
    p.following = t.id;
    p.nextFollowAt = 0;
    this.pushState(p);
    if (announce) {
      this.notice(t, `${p.name} is following you.`, 'info');
      this.log('followed', p.id, t.id);
    }
    return true;
  }
  stopFollowing(p: ServerPlayer, announce: boolean) {
    if (!p.following) return;
    p.following = null;
    p.path = [];
    this.pushState(p);
    if (announce) this.notice(p, 'You stopped following.', 'info');
  }
  private tickFollow(p: ServerPlayer, now: number) {
    if (!p.following || now < p.nextFollowAt) return;
    p.nextFollowAt = now + 350;
    const t = this.players.get(p.following);
    if (!t) return this.stopFollowing(p, false);
    // Different levels are ~1700px apart in raw distance, so measure by walking distance instead.
    const crossLevel = levelAt(p.y) !== levelAt(t.y);
    if (!crossLevel && dist(p, t) > FOLLOW_GIVEUP) { this.notice(p, 'You lost them.', 'info'); return this.stopFollowing(p, false); }
    const a = hash01(p.id) * Math.PI * 2;
    let tx = t.x + Math.cos(a) * FOLLOW_GAP;
    let ty = t.y + Math.sin(a) * FOLLOW_GAP * 0.7;
    if (crossLevel || !canStand(CAMPUS_MAP, tx, ty)) { tx = t.x; ty = t.y; }
    if (!crossLevel && Math.hypot(tx - p.x, ty - p.y) < 14) { p.path = []; return; }
    p.path = findPath(CAMPUS_MAP, p.x, p.y, tx, ty);
    if (p.path.length === 0) { this.notice(p, 'You lost them.', 'info'); this.stopFollowing(p, false); }
  }

  // ---------- simulation ----------
  step(dt: number) {
    const now = this.now();
    this.tick++;
    const moves: SnapMove[] = [];

    for (const p of this.players.values()) {
      this.tickFollow(p, now);
      if (p.seat) continue;

      let nx = p.x;
      let ny = p.y;
      const maxStep = PLAYER_SPEED * (now < p.boostUntil ? p.boostMul : 1) * dt;

      if (p.dirX !== 0 || p.dirY !== 0) {
        const len = Math.hypot(p.dirX, p.dirY);
        const vx = (p.dirX / len) * maxStep;
        const vy = (p.dirY / len) * maxStep;
        if (canStand(CAMPUS_MAP, p.x + vx, p.y)) nx = p.x + vx;
        if (canStand(CAMPUS_MAP, nx, p.y + vy)) ny = p.y + vy;
        // Walking onto a staircase takes you to the other floor.
        const warp = portalAt(CAMPUS_MAP, nx, ny);
        if (warp) { nx = warp.x; ny = warp.y; }
      } else if (p.path.length) {
        let remaining = maxStep;
        while (remaining > 0 && p.path.length) {
          const wp = p.path[0];
          if (wp.warp) { nx = wp.x; ny = wp.y; p.path.shift(); continue; }
          const dx = wp.x - nx;
          const dy = wp.y - ny;
          const d = Math.hypot(dx, dy);
          if (d <= remaining) { nx = wp.x; ny = wp.y; remaining -= d; p.path.shift(); }
          else { nx += (dx / d) * remaining; ny += (dy / d) * remaining; remaining = 0; }
        }
      }

      const moved = nx !== p.x || ny !== p.y;
      const prevFacing = p.facing;
      if (moved && Math.hypot(nx - p.x, ny - p.y) < 200) p.facing = faceFrom(nx - p.x, ny - p.y);
      p.x = nx;
      p.y = ny;

      if (p.pendingSeat && p.path.length === 0 && p.dirX === 0 && p.dirY === 0) {
        const seat = this.seatsById.get(p.pendingSeat);
        if (seat && Math.hypot(seat.x - p.x, seat.y - p.y) < 40) this.arriveSeat(p);
        else this.releaseSeat(p);
        if (p.seat) continue;
      }
      if (p.faceTarget && p.path.length === 0 && p.dirX === 0 && p.dirY === 0) {
        const t = this.players.get(p.faceTarget);
        if (t) p.facing = faceFrom(t.x - p.x, t.y - p.y);
        p.faceTarget = null;
      }

      const nowMoving = moved || p.path.length > 0;
      if (moved || nowMoving !== p.moving || p.facing !== prevFacing) {
        p.moving = nowMoving;
        moves.push({ id: p.id, x: r1(p.x), y: r1(p.y), f: p.facing, m: nowMoving });
      }
    }

    this.tickTimers(now);
    social.tickHelp(this, dt, now);

    if (now >= this.nextCluster) {
      this.nextCluster = now + EVENT_TICK_MS;
      this.clusters = computeClusters(this.players.values(), now);
      const pub = publicGroups(this.clusters);
      const json = JSON.stringify(pub);
      if (json !== this.lastGroupsJson) {
        this.lastGroupsJson = json;
        this.broadcast({ t: 'groups', groups: pub as GroupInfo[] });
      }
      this.events.tick(now, this.clusters);
    }
    if (now >= this.nextTogether) {
      this.nextTogether = now + TOGETHER_SAMPLE_MS;
      for (const c of this.clusters) {
        const ids = c.ids.slice(0, GROUP_MAX_PAIRS);
        for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) this.log('together', ids[i], ids[j]);
      }
    }
    if (now >= this.nextPersist) {
      this.nextPersist = now + PERSIST_MS;
      void this.persist();
    }

    if (now >= this.nextHousekeeping) {
      this.nextHousekeeping = now + 1000;
      for (const [id, inv] of this.invites) if (inv.expires <= now) this.invites.delete(id);
    }
    if (moves.length) this.broadcast({ t: 'snap', tick: this.tick, moves });
  }

  /** Eating, "hot" stolen plates and help requests run on simple timers. */
  private tickTimers(now: number) {
    for (const p of this.players.values()) {
      if (p.boostUntil && now >= p.boostUntil) { p.boostUntil = 0; p.boostMul = 1; }
      if (p.watchedUntil && now >= p.watchedUntil) { p.watchedUntil = 0; this.pushState(p); }
      if (p.doing && now >= p.doingUntil) this.finishDoing(p, now);
      if (p.held === 'plate' && p.seat) {
        if (!p.eatingUntil) { p.eatingUntil = now + EAT_TIME_MS; this.pushState(p); }
        else if (now >= p.eatingUntil) this.finishEating(p);
      } else if (p.eatingUntil) {
        p.eatingUntil = 0;
        this.pushState(p);
      }
      if (p.hotFor && (now >= p.hotUntil || !this.players.has(p.hotFor))) { p.hotFor = null; this.pushState(p); }
      if (p.asking && now >= p.askingUntil) {
        p.asking = null;
        this.pushState(p);
        this.notice(p, 'Your help request timed out.', 'info');
      }
    }
  }

  private finishDoing(p: ServerPlayer, now: number) {
    const was = p.doing;
    const spot = p.workSpot;
    p.doing = null;
    p.workSpot = null;
    if (was === 'work' && spot) {
      p.money += WORK_PAY;
      this.setCooldown(p, `work:${spot}`, WORK_COOLDOWN_MS);
      this.pushSelf(p);
      this.notice(p, `Done. You earned ${WORK_PAY} LD.`, 'good');
      this.log('worked', p.id);
    }
    void now;
    this.pushState(p);
  }

  /** Save what must survive a restart: money, memory, buzz. Safe to call any time. */
  async persist() {
    if (!this.store) return;
    for (const p of this.players.values()) if (p.money !== p.savedMoney) await this.persistPlayer(p);
    await Promise.all([this.memory.flush(), this.chichi.flush()]);
  }
  async persistPlayer(p: ServerPlayer) {
    if (!this.store || p.id.startsWith('bot-')) return;
    try {
      await this.store.savePlayer(p.id, p.name, p.avatar, p.money);
      p.savedMoney = p.money;
    } catch {
      /* try again on the next pass */
    }
    await Promise.all([this.memory.flush(), this.chichi.flush()]);
  }

  private finishEating(p: ServerPlayer) {
    p.held = null; p.eatingUntil = 0; p.hotFor = null;
    this.pushState(p);
    this.notice(p, 'That was good.', 'good');
    this.log('ate', p.id);
    for (const o of this.players.values()) {
      if (o !== p && o.seat && levelAt(o.y) === levelAt(p.y) && dist(o, p) < 110) this.log('ate_together', p.id, o.id);
    }
  }
}
