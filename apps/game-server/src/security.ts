import {
  GUARD_FINE, GUARD_WARN_COOLDOWN_MS, CAMPUS_MAP, buildRoutes, guardAt, guardSees, levelAt, zoneAt,
  type GuardPos, type Route
} from '@campus/shared';
import type { World } from './world';

export interface Incident { id: number; text: string; at: number; kind: 'theft' | 'loitering' }

/**
 * Patrol guards. Three guards walk fixed rounds (their place is a function of time, see shared/patrol.ts).
 * They see what is in front of them: a thief carrying a stolen plate is caught and fined; people loitering outside a
 * classroom during a lesson are told to go to class. Every catch goes in a short incident log.
 */
export class SecurityEngine {
  private routes: Route[] = buildRoutes(CAMPUS_MAP);
  private warned = new Map<string, number>();
  private nextId = 1;
  readonly incidents: Incident[] = [];

  constructor(private world: World) {}

  guards(now = this.world.now()): GuardPos[] { return this.routes.map((r) => guardAt(r, now)); }

  private log(text: string, kind: Incident['kind'], now: number, x: number, y: number) {
    this.incidents.push({ id: this.nextId++, text, at: now, kind });
    if (this.incidents.length > 10) this.incidents.shift();
    this.world.events.emit('buzz', text, { x, y }, { key: `incident:${this.nextId}`, cooldownMs: 0, tone: 'warn', priority: false });
  }

  tick(now: number) {
    const gs = this.guards(now);
    const inClass = this.world.classes.inSession;
    for (const p of this.world.players.values()) {
      if (p.id.startsWith('bot-') || levelAt(p.y) !== 'ground') continue;
      const g = gs.find((x) => guardSees(x, p.x, p.y));
      if (!g) continue;
      if (p.held === 'plate' && p.hotFor) {
        const victim = this.world.players.get(p.hotFor);
        const fine = Math.min(GUARD_FINE, Math.floor(p.money));
        p.money -= fine;
        p.held = null; p.eatingUntil = 0; p.hotFor = null;
        p.mischiefLockUntil = Math.max(p.mischiefLockUntil, now + 60_000);
        if (victim) {
          this.world.credit(victim, fine);
          if (!victim.held) { victim.held = 'plate'; this.world.pushState(victim); }
          this.world.notice(victim, `A guard caught ${p.name} and returned your plate${fine ? `, plus ${fine} LD` : ''}.`, 'good');
          this.world.pushSelf(victim);
          this.world.log('caught', p.id, victim.id);
        }
        this.world.notice(p, `A guard saw you with a stolen plate. Fined ${fine} LD.`, 'warn');
        this.world.pushState(p);
        this.world.pushSelf(p);
        this.log(`${g.label} caught ${p.name} with a stolen plate.`, 'theft', now, p.x, p.y);
        continue;
      }
      if (inClass && !p.doing) {
        const z = zoneAt(CAMPUS_MAP, p.x, p.y)?.id;
        if (!this.world.classes.isRoom(z) && now - (this.warned.get(p.id) ?? -Infinity) > GUARD_WARN_COOLDOWN_MS) {
          this.warned.set(p.id, now);
          this.world.notice(p, `${g.label}: "Class is in session. Off to class!"`, 'warn');
          this.world.log('warned', p.id);
        }
      }
    }
    for (const [id, t] of this.warned) if (now - t > 10 * GUARD_WARN_COOLDOWN_MS) this.warned.delete(id);
  }
}
