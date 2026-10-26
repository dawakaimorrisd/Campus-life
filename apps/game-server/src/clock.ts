import {
  CAMPUS_MAP, COLLECT_AT, DAYTIME, DAY_PLAN, SPECIALS, SPECIAL_EVERY_MS, SPECIAL_MS, type ClockPhase, type ClockState, type SpecialDef, type SpecialId
} from '@campus/shared';
import type { World } from './world';

export interface ClockOptions {
  /** 'off' turns the day cycle off completely (the old standalone timers take over in tests). */
  mode?: 'on' | 'off';
  /** Multiplies every phase length: 0.25 runs the day four times faster (handy for testing). */
  scale?: number;
  /** Begin the first day at this phase instead of the morning. */
  start?: ClockPhase;
  rnd?: () => number;
}

/**
 * The master clock of campus life. Classes, the party, the guard, the sky and the social rewards all read this one
 * clock, so the whole campus shares the same rhythm. See `packages/shared/src/clock.ts` for the plan.
 */
export class ClockEngine {
  private idx = DAY_PLAN.length - 1;
  private startsAt = 0;
  private endsAt = 0;
  private day = 0;
  private dayStartAt = 0;
  private started = false;
  private special: { def: SpecialDef; endsAt: number } | null = null;
  private nextSpecialAt = 0;
  private readonly scale: number;
  private readonly startPhase: ClockPhase | undefined;
  private readonly rnd: () => number;
  readonly enabled: boolean;
  /** Transitions since the last tick, so engines can react once. */
  private listeners: Array<(from: ClockPhase, to: ClockPhase, now: number) => void> = [];

  constructor(private world: World, o: ClockOptions = {}) {
    this.enabled = (o.mode ?? 'on') === 'on';
    this.scale = o.scale && o.scale > 0 ? o.scale : 1;
    this.startPhase = o.start;
    this.rnd = o.rnd ?? Math.random;
  }

  get phase(): ClockPhase { return this.enabled ? DAY_PLAN[this.idx].phase : 'free'; }
  get lesson() { return DAY_PLAN[this.idx].lesson; }
  /** Stretch or shrink a length of campus time by the clock's speed (1 normally; smaller when testing fast). */
  scaleMs(ms: number) { return ms * this.scale; }
  /** The moment the next class's wrap-up begins (where assignments are collected), counted from `now`. */
  msUntilNextWrapup(now: number): number {
    let at = this.endsAt;
    let i = (this.idx + 1) % DAY_PLAN.length;
    for (let n = 0; n < DAY_PLAN.length; n++, i = (i + 1) % DAY_PLAN.length) {
      const s = DAY_PLAN[i];
      if (s.phase === 'class') return Math.max(now, at + s.ms * this.scale * COLLECT_AT);
      at += s.ms * this.scale;
    }
    return at;
  }
  get endsAtMs() { return this.endsAt; }
  get startsAtMs() { return this.startsAt; }
  get dayNumber() { return this.day; }
  get isDaytime() { return DAYTIME.includes(this.phase); }
  /** True from dusk until dawn begins. */
  get isNight() { return this.phase === 'dusk' || this.phase === 'party' || this.phase === 'bedtime'; }

  onPhase(fn: (from: ClockPhase, to: ClockPhase, now: number) => void) { this.listeners.push(fn); }

  /** Multiplier for an active special of this kind, otherwise 1. */
  mult(id: SpecialId): number {
    return this.special && this.special.def.id === id && this.special.endsAt > this.world.now() ? this.special.def.mult : 1;
  }

  private activeMs() {
    return DAY_PLAN.filter((s) => DAYTIME.includes(s.phase)).reduce((a, s) => a + s.ms * this.scale, 0);
  }

  state(): ClockState {
    const s = this.special && this.special.endsAt > this.world.now() ? { id: this.special.def.id, label: this.special.def.label, endsAt: this.special.endsAt } : null;
    return {
      phase: this.phase, lesson: this.lesson, day: this.day, now: this.world.now(), startsAt: this.startsAt, endsAt: this.endsAt,
      dayStartAt: this.dayStartAt, activeMs: this.activeMs(), special: s,
      clockFrom: DAY_PLAN[this.idx].from, clockTo: DAY_PLAN[this.idx].to
    };
  }

  private send() { this.world.broadcast({ t: 'clock', ...this.state() }); }

  private enter(i: number, now: number) {
    const from = DAY_PLAN[this.idx].phase;
    this.idx = i;
    const step = DAY_PLAN[i];
    this.startsAt = now;
    this.endsAt = now + step.ms * this.scale;
    if (i === 0) {
      this.day++;
      this.dayStartAt = now;
    }
    if (step.phase === 'free') this.nextSpecialAt = now + this.between(SPECIAL_EVERY_MS[0], SPECIAL_EVERY_MS[1]) * this.scale;
    else this.special = null;
    for (const fn of this.listeners) fn(from, step.phase, now);
    this.send();
  }

  private between(a: number, b: number) { return a + this.rnd() * (b - a); }

  tick(now: number) {
    if (!this.enabled) return;
    if (!this.started) {
      this.started = true;
      // A fresh server begins with a short "good morning" and then the first class.
      let i = DAY_PLAN.length - 1;
      if (this.startPhase) {
        const found = DAY_PLAN.findIndex((s) => s.phase === this.startPhase);
        if (found >= 0) i = found;
      }
      this.idx = (i + DAY_PLAN.length - 1) % DAY_PLAN.length;
      this.dayStartAt = now;
      this.enter(i, now);
      if (i === DAY_PLAN.length - 1) this.endsAt = now + Math.min(DAY_PLAN[i].ms, 15_000) * this.scale;
      this.send();
      return;
    }
    if (now >= this.endsAt) return this.enter((this.idx + 1) % DAY_PLAN.length, now);
    // free time: every few minutes something is on offer
    if (this.phase === 'free') {
      if (this.special && this.special.endsAt <= now) { this.special = null; this.send(); }
      else if (!this.special && now >= this.nextSpecialAt && this.endsAt - now > SPECIAL_MS * this.scale * 0.8) {
        const def = SPECIALS[Math.floor(this.rnd() * SPECIALS.length)];
        this.special = { def, endsAt: now + SPECIAL_MS * this.scale };
        this.nextSpecialAt = this.special.endsAt + this.between(SPECIAL_EVERY_MS[0], SPECIAL_EVERY_MS[1]) * this.scale;
        const door = CAMPUS_MAP.venue.door;
        this.world.events.emit('buzz', def.banner, { x: (door.x + 0.5) * CAMPUS_MAP.tile, y: (door.y + 0.5) * CAMPUS_MAP.tile }, { key: `special:${def.id}`, cooldownMs: 10_000, tone: 'fun', priority: true });
        this.world.broadcast({ t: 'notice', text: `⭐ ${def.banner}`, tone: 'fun' });
        this.send();
      }
    }
  }
}
