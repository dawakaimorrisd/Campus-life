import {
  CAMPUS_MAP, DJ_CLOSE_LINES, DJ_EMPTY_LINES, DJ_HYPE_LINES, DJ_OPEN_LINES, TRACKS, TRACK_MS, zoneAt,
  type DjState, type Vec
} from '@campus/shared';
import type { ServerPlayer, World } from './world';

export interface PartyOptions {
  /** 'auto' alternates party and quiet; 'always' keeps the party on; 'off' never runs it. */
  mode?: 'clock' | 'auto' | 'always' | 'off';
  onMs?: number;
  offMs?: number;
  /** Start in the "on" phase (handy while testing). */
  startOn?: boolean;
  rnd?: () => number;
}

const DANCE_WINDOW_MS = 6000;

/**
 * The NPC DJ. While the party is on, every 15 seconds the DJ picks a random track (never the same one twice
 * in a row) and says something. The same message tells every client what to play and when it started.
 *
 * The on/off schedule here is a simple repeating one so the Student Center is alive while we test.
 * Event nights with an entry fee and a guard (Phase D) will replace it.
 */
export class DjEngine {
  private on = false;
  private track = 0;
  private startedAt = 0;
  private endsAt = 0;
  private nextAt = 0;
  private energy = 0;
  private lastSentEnergy = -1;
  private lastTrack = -1;
  private nextSlotAt = 0;
  private nextEnergyCheck = 0;
  private lastHypeAt = 0;
  private lastEmptyAt = 0;
  private dancing = new Map<string, number>();
  private readonly mode: 'clock' | 'auto' | 'always' | 'off';
  private readonly onMs: number;
  private readonly offMs: number;
  private readonly rnd: () => number;
  private started = false;
  /** Someone is performing on stage: keeps the room lively. Set by the night engine. */
  stageActive = false;
  private startOn: boolean;

  constructor(private world: World, o: PartyOptions = {}) {
    this.mode = o.mode ?? 'auto';
    this.onMs = o.onMs ?? 4 * 60_000;
    this.offMs = o.offMs ?? 4 * 60_000;
    this.rnd = o.rnd ?? Math.random;
    this.startOn = o.startOn ?? true;
  }

  get isOn() { return this.on; }
  /** When the party closes (0 if it never does or is off). */
  get closeAt() { return this.on ? this.endsAt : 0; }
  /** When the next party opens (0 if unknown or already on). */
  get nextOpenAt() {
    if (this.mode === 'clock') return !this.on && this.world.clock.phase === 'dusk' ? this.world.clock.endsAtMs : 0;
    return this.on ? 0 : this.nextAt;
  }
  /** Let the DJ say something to the whole room right now. */
  shout(text: string) { if (this.on) this.send(text); }

  /** Where the party is, for the "something is happening" arrow. */
  private get door(): Vec {
    const d = CAMPUS_MAP.venue.door;
    return { x: (d.x + 0.5) * CAMPUS_MAP.tile, y: (d.y + 0.5) * CAMPUS_MAP.tile };
  }

  /** The current state, as the message every client receives. */
  state(shout: string | null = null): DjState {
    const now = this.world.now();
    return {
      on: this.on, track: this.track, bpm: TRACKS[this.track].bpm, startedAt: this.startedAt, now, trackMs: TRACK_MS,
      endsAt: this.endsAt, nextAt: this.nextAt, energy: Math.round(this.energy * 10) / 10, shout
    };
  }

  private send(shout: string | null = null) {
    this.lastSentEnergy = Math.round(this.energy * 10) / 10;
    this.world.broadcast({ t: 'dj', ...this.state(shout) });
  }

  /** Someone danced: remember it for a few seconds so the floor can feel alive. */
  noteDance(id: string, now: number) {
    this.dancing.set(id, now + DANCE_WINDOW_MS);
  }

  private pick(): number {
    let t = Math.floor(this.rnd() * TRACKS.length);
    if (t === this.lastTrack) t = (t + 1 + Math.floor(this.rnd() * (TRACKS.length - 1))) % TRACKS.length;
    return t;
  }

  private line(lines: readonly string[]) {
    return lines[Math.floor(this.rnd() * lines.length)];
  }

  private open(now: number) {
    this.on = true;
    this.endsAt = this.mode === 'always' ? 0 : this.mode === 'clock' ? this.world.clock.endsAtMs : now + this.onMs;
    this.nextAt = 0;
    this.lastTrack = -1;
    this.nextSlot(now, this.line(DJ_OPEN_LINES));
    this.world.night.opened(now, this.endsAt);
    this.world.events.emit('music', 'The party is on at the Student Center!', this.door, { key: 'party', cooldownMs: 30_000, tone: 'fun', priority: true });
  }

  private close(now: number) {
    this.on = false;
    this.energy = 0;
    this.endsAt = 0;
    this.nextAt = now + this.offMs;
    for (const p of this.world.players.values()) if (p.doing === 'dance') this.world.setDance(p, false);
    this.send(this.line(DJ_CLOSE_LINES));
    this.world.night.closed(now);
  }

  private nextSlot(now: number, openLine: string | null = null) {
    this.track = this.pick();
    this.lastTrack = this.track;
    this.startedAt = now;
    this.nextSlotAt = now + TRACK_MS;
    this.send(openLine ?? TRACKS[this.track].intro);
  }

  /** Called about once a second by the world. */
  tick(now: number) {
    if (this.mode === 'off') return;
    if (this.mode === 'clock') {
      const party = this.world.clock.phase === 'party';
      if (party && !this.on) this.open(now);
      else if (!party && this.on) return this.close(now);
      if (!this.on) return;
      if (now >= this.nextSlotAt) this.nextSlot(now);
      if (now >= this.nextEnergyCheck) { this.nextEnergyCheck = now + 1000; this.updateEnergy(now); }
      return;
    }
    if (!this.started) {
      this.started = true;
      if (this.mode === 'always' || this.startOn) this.open(now);
      else this.nextAt = now + this.offMs;
      return;
    }
    if (!this.on) {
      if (this.nextAt && now >= this.nextAt) this.open(now);
      return;
    }
    if (this.endsAt && now >= this.endsAt) return this.close(now);
    if (now >= this.nextSlotAt) this.nextSlot(now);

    if (now >= this.nextEnergyCheck) {
      this.nextEnergyCheck = now + 1000;
      this.updateEnergy(now);
    }
  }

  /** Standing on the dance floor while the music plays: you dance. */
  private autoDance(p: ServerPlayer) {
    if (p.doing || p.seat || p.moving) return;
    const f = CAMPUS_MAP.venue.danceFloor;
    const T = CAMPUS_MAP.tile;
    if (p.x < f.x * T || p.x > (f.x + f.w) * T || p.y < f.y * T || p.y > (f.y + f.h) * T) return;
    this.world.setDance(p, true);
  }

  private updateEnergy(now: number) {
    let inside = 0;
    let dancers = 0;
    for (const p of this.world.players.values()) {
      if (zoneAt(CAMPUS_MAP, p.x, p.y)?.id !== 'student_center') continue;
      inside++;
      this.autoDance(p);
      if (p.doing === 'dance' || (this.dancing.get(p.id) ?? 0) > now) dancers += this.world.market.hasGlow(p) ? 2 : 1;
    }
    for (const [id, until] of this.dancing) if (until <= now) this.dancing.delete(id);
    // A few people dancing already feels like a party; a full floor is the top of the scale.
    const target = Math.max(this.stageActive ? 0.55 : 0, Math.min(1, (inside * 0.4 + dancers * 1.6) / 10));
    this.energy += (target - this.energy) * 0.5;
    if (Math.abs(this.energy - target) < 0.03) this.energy = target;
    let shout: string | null = null;
    if (this.energy >= 0.7 && now - this.lastHypeAt > 40_000) {
      this.lastHypeAt = now;
      shout = this.line(DJ_HYPE_LINES);
    } else if (inside >= 1 && dancers === 0 && this.energy < 0.2 && now - this.lastEmptyAt > 45_000) {
      this.lastEmptyAt = now;
      shout = this.line(DJ_EMPTY_LINES);
    }
    if (shout || Math.round(this.energy * 10) / 10 !== this.lastSentEnergy) this.send(shout);
  }
}
