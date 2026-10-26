import {
  BALL_FRICTION, BALL_RADIUS, CAMPUS_MAP, GOAL_RESTART_MS, KICK_RANGE, KICK_SPEED, NUDGE_RANGE, NUDGE_SPEED, levelAt,
  type BallState
} from '@campus/shared';
import type { ServerPlayer, World } from './world';

const T = CAMPUS_MAP.tile;
const REC = CAMPUS_MAP.rec;
const X0 = REC.pitch.x * T;
const X1 = (REC.pitch.x + REC.pitch.w) * T;
const Y0 = REC.pitch.y * T;
const Y1 = (REC.pitch.y + REC.pitch.h) * T;
const GY0 = REC.goalY0 * T;
const GY1 = REC.goalY1 * T;
const START = { x: REC.start.x * T, y: REC.start.y * T };
const MIN_SEND_MS = 110;

/**
 * The shared football. One ball for the whole Recreation Ground. Walking into it nudges it, the Kick button
 * sends it flying. The server moves it; phones just draw it, so everybody sees the same game.
 */
export class BallEngine {
  x = START.x;
  y = START.y;
  vx = 0;
  vy = 0;
  private lastTouch: string | null = null;
  private restartAt = 0;
  private goalBy: string | null = null;
  private lastSend = 0;
  private dirty = false;

  constructor(private world: World) {}

  state(): BallState {
    const now = this.world.now();
    return { x: Math.round(this.x), y: Math.round(this.y), vx: Math.round(this.vx), vy: Math.round(this.vy), at: now, now, goalBy: this.goalBy };
  }

  private send() {
    this.lastSend = this.world.now();
    this.dirty = false;
    this.world.broadcast({ t: 'ball', ...this.state() });
  }

  private get moving() { return this.vx !== 0 || this.vy !== 0; }

  kick(p: ServerPlayer) {
    if (levelAt(p.y) !== 'ground' || this.restartAt) return;
    if (!this.world.football.canTouch(p)) return this.blocked(p);
    const dx = this.x - p.x;
    const dy = this.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > KICK_RANGE) return this.world.notice(p, 'Get closer to the ball.', 'info');
    let ux = dx / (d || 1);
    let uy = dy / (d || 1);
    if (d < 4) {
      ux = p.facing === 'left' ? -1 : p.facing === 'right' ? 1 : 0;
      uy = p.facing === 'up' ? -1 : p.facing === 'down' ? 1 : 0;
    }
    this.vx = ux * KICK_SPEED;
    this.vy = uy * KICK_SPEED;
    this.lastTouch = p.id;
    this.send();
  }

  private blockedAt = new Map<string, number>();
  private blocked(p: ServerPlayer) {
    const now = this.world.now();
    if (now - (this.blockedAt.get(p.id) ?? -Infinity) < 8000) return;
    this.blockedAt.set(p.id, now);
    this.world.notice(p, 'A match is on. Only the players can touch the ball. Join the waiting list at the Games desk.', 'info');
  }

  /** Back to the centre spot (kick-off, or when a match ends). */
  reset() {
    this.restartAt = 0; this.goalBy = null; this.lastTouch = null;
    this.x = START.x; this.y = START.y; this.vx = 0; this.vy = 0;
    this.send();
  }

  /** Every simulation step. */
  step(dt: number) {
    const now = this.world.now();
    if (this.restartAt) {
      if (now >= this.restartAt) {
        this.restartAt = 0;
        this.goalBy = null;
        this.x = START.x; this.y = START.y; this.vx = 0; this.vy = 0;
        this.send();
      }
      return;
    }
    // Players running into the ball push it along.
    for (const p of this.world.players.values()) {
      if (!p.moving || levelAt(p.y) !== 'ground' || !this.world.football.canTouch(p)) continue;
      const dx = this.x - p.x;
      const dy = this.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > NUDGE_RANGE || d === 0) continue;
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > NUDGE_SPEED * 0.8) continue;
      this.vx = (dx / d) * NUDGE_SPEED;
      this.vy = (dy / d) * NUDGE_SPEED;
      this.lastTouch = p.id;
      this.dirty = true;
    }
    if (this.moving) {
      const k = Math.exp(-BALL_FRICTION * dt);
      this.vx *= k;
      this.vy *= k;
      if (Math.hypot(this.vx, this.vy) < 8) { this.vx = 0; this.vy = 0; this.dirty = true; }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.walls();
    }
    if (this.dirty && now - this.lastSend >= MIN_SEND_MS) this.send();
  }

  private walls() {
    const r = BALL_RADIUS;
    const inMouth = this.y > GY0 + r && this.y < GY1 - r;
    // top and bottom lines
    if (this.y < Y0 + r) { this.y = Y0 + r; this.vy = Math.abs(this.vy) * 0.6; this.dirty = true; }
    if (this.y > Y1 - r) { this.y = Y1 - r; this.vy = -Math.abs(this.vy) * 0.6; this.dirty = true; }
    // goal ends
    for (const side of [-1, 1] as const) {
      const line = side < 0 ? X0 : X1;
      const crossed = side < 0 ? this.x < line : this.x > line;
      if (!crossed) continue;
      if (inMouth) {
        const back = side < 0 ? line - T + r : line + T - r;
        if (side < 0 ? this.x < back : this.x > back) { this.x = back; this.vx = -this.vx * 0.2; }
        this.goal(side < 0 ? 'left' : 'right');
        return;
      }
      this.x = side < 0 ? X0 + r : X1 - r;
      this.vx = -this.vx * 0.6;
      this.dirty = true;
    }
  }

  private goal(side: 'left' | 'right') {
    const scorer = this.lastTouch ? this.world.players.get(this.lastTouch) : undefined;
    this.vx = this.vy = 0;
    this.restartAt = this.world.now() + GOAL_RESTART_MS;
    this.goalBy = scorer?.name ?? 'Someone';
    this.send();
    // In a match the football engine keeps the score and pays; in a casual kickabout it is just for fun.
    this.world.football.goal(side, this.lastTouch);
    const at = { x: this.x, y: this.y };
    this.world.events.emit('buzz', `GOAL! ${this.goalBy} scores at the Recreation Ground ⚽`, at, { key: 'goal', cooldownMs: 5000, tone: 'fun', priority: true });
  }
}
