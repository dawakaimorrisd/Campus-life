import {
  CAMPUS_MAP, EVENT_GLOBAL_GAP_MS, GATHERING_AGE_MS, GATHERING_COOLDOWN_MS, GATHERING_MIN, GROUP_LEFT_DISTANCE, PLACE_NAMES,
  SITTING_TOGETHER_MS, zoneAt, type CampusEventKind, type NoticeTone, type Vec
} from '@campus/shared';
import type { Cluster } from './groups';
import type { World } from './world';

export interface CampusEvent {
  id: number;
  kind: CampusEventKind;
  text: string;
  x: number;
  y: number;
  tone: NoticeTone;
  at: number;
}
interface EmitOpts {
  key: string;
  cooldownMs: number;
  tone?: NoticeTone;
  /** Priority events skip the global spacing so a theft is never swallowed by a gathering. */
  priority?: boolean;
}

/**
 * The campus notices when something interesting happens and tells everyone, carefully.
 * It amplifies what players are already doing. It never invents activity.
 */
export class EventEngine {
  readonly recent: CampusEvent[] = [];
  private cooldowns = new Map<string, number>();
  private firstSeen = new Map<string, number>();
  private walkers = new Map<string, { x: number; y: number; zone: string | null }>();
  private lastAny = -Infinity;
  private nextId = 1;

  constructor(private world: World) {}

  placeOf(at: Vec): string {
    const z = zoneAt(CAMPUS_MAP, at.x, at.y)?.id;
    return z ? PLACE_NAMES[z] : 'the campus grounds';
  }

  emit(kind: CampusEventKind, text: string, at: Vec, o: EmitOpts): boolean {
    const now = this.world.now();
    if (now < (this.cooldowns.get(o.key) ?? 0)) return false;
    if (!o.priority && now - this.lastAny < EVENT_GLOBAL_GAP_MS) return false;
    this.cooldowns.set(o.key, now + o.cooldownMs);
    this.lastAny = now;
    const ev: CampusEvent = { id: this.nextId++, kind, text, x: Math.round(at.x), y: Math.round(at.y), tone: o.tone ?? 'fun', at: now };
    this.recent.push(ev);
    if (this.recent.length > 30) this.recent.shift();
    this.world.broadcast({ t: 'campus_event', id: ev.id, kind, text, x: ev.x, y: ev.y, tone: ev.tone });
    return true;
  }

  /** Reacts to things players just did (the same hook that feeds social memory). */
  onInteraction(kind: string, a: string, b: string | null) {
    const p = this.world.players.get(a);
    const v = b ? this.world.players.get(b) : undefined;
    switch (kind) {
      case 'stole': {
        const at = v ?? p;
        if (at) this.emit('steal', `Someone just stole food at ${this.placeOf(at)} 😂`, at, { key: `steal:${this.placeOf(at)}`, cooldownMs: 25_000, priority: true });
        break;
      }
      case 'asked_find':
        if (p) this.emit('looking', `Someone is looking for something near ${this.placeOf(p)}`, p, { key: `find:${a}`, cooldownMs: 90_000, tone: 'info' });
        break;
      case 'played_music':
        if (p) this.emit('music', `Music is playing at ${this.placeOf(p)} 🎶`, p, { key: `music:${this.placeOf(p)}`, cooldownMs: 60_000, priority: true });
        break;
      default:
        break;
    }
  }

  /** Runs once a second against the current clusters. */
  tick(now: number, clusters: Cluster[]) {
    const seenKeys = new Set<string>();
    for (const c of clusters) {
      const place = this.placeOf(c);
      const zoneKey = c.zone ?? 'outside';
      if (c.n >= GATHERING_MIN) {
        const key = `gather:${zoneKey}`;
        seenKeys.add(key);
        const since = this.firstSeen.get(key) ?? this.firstSeen.set(key, now).get(key)!;
        if (now - since >= GATHERING_AGE_MS) {
          const text = c.kind === 'eating' ? `Students are eating together at ${place} 👀` : `Something is happening at ${place} 👀`;
          this.emit(c.kind === 'eating' ? 'eating' : 'gathering', text, c, { key, cooldownMs: GATHERING_COOLDOWN_MS });
        }
      }
      if (c.n >= 3 && c.kind !== 'walking') {
        const key = `sit:${zoneKey}`;
        seenKeys.add(key);
        const since = this.firstSeen.get(key) ?? this.firstSeen.set(key, now).get(key)!;
        const seated = c.ids.filter((id) => this.world.players.get(id)?.seat).length;
        if (seated >= 3 && now - since >= SITTING_TOGETHER_MS) {
          this.emit('gathering', `${c.n} students have been sitting together at ${place}`, c, { key, cooldownMs: 300_000, tone: 'info' });
        }
      }
    }
    for (const k of [...this.firstSeen.keys()]) if (!seenKeys.has(k)) this.firstSeen.delete(k);

    // A group walking away from where they started.
    const leaders = new Map<string, number>();
    for (const p of this.world.players.values()) if (p.following) leaders.set(p.following, (leaders.get(p.following) ?? 0) + 1);
    for (const [leaderId, followers] of leaders) {
      const leader = this.world.players.get(leaderId);
      if (!leader || followers < 2) continue;
      const origin = this.walkers.get(leaderId) ?? this.walkers.set(leaderId, { x: leader.x, y: leader.y, zone: zoneAt(CAMPUS_MAP, leader.x, leader.y)?.id ?? null }).get(leaderId)!;
      if (Math.hypot(leader.x - origin.x, leader.y - origin.y) >= GROUP_LEFT_DISTANCE) {
        this.emit('group_left', `A group just left ${this.placeOf(origin)}`, origin, { key: `left:${leaderId}`, cooldownMs: 120_000 });
        this.walkers.set(leaderId, { x: leader.x, y: leader.y, zone: zoneAt(CAMPUS_MAP, leader.x, leader.y)?.id ?? null });
      }
    }
    for (const id of [...this.walkers.keys()]) if (!leaders.has(id)) this.walkers.delete(id);
  }
}
