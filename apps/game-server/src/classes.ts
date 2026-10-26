import {
  ATTEND_FRAC, ATTEND_PAY, CAMPUS_MAP, CLASS_ROOMS, LATE_PAY, MARK_ABSENT, MARK_LATE, MARK_LEFT_EARLY, MARK_ON_TIME, zoneAt
} from '@campus/shared';
import type { World } from './world';

interface Attendance { ms: number; late: boolean; zone: string }

/**
 * Attendance. The campus clock decides when the bell rings; this class counts who was in a classroom.
 * Being in a classroom for at least half the lesson earns a mark and a small payment; arriving after the first 15
 * seconds counts as late and pays half. The server does all the counting.
 */
export class ClassEngine {
  private inSessionNow = false;
  private startedAt = 0;
  private endsAt = 0;
  private lastTick = 0;
  private marks = new Map<string, Attendance>();
  /** Who was on campus when the bell rang (to notice who never came). */
  private roster = new Set<string>();

  constructor(private world: World) {
    world.clock.onPhase((from, to, now) => {
      if (to === 'class') this.startClass(now);
      else if (from === 'class') this.endClass(now);
    });
  }

  get inSession() { return this.inSessionNow; }

  isRoom(z: string | null | undefined) { return !!z && (CLASS_ROOMS as readonly string[]).includes(z); }
  private roomOf(p: { x: number; y: number }) {
    const z = zoneAt(CAMPUS_MAP, p.x, p.y)?.id;
    return z && this.isRoom(z) ? z : null;
  }

  tick(now: number) {
    const dt = Math.min(2000, now - this.lastTick || 0);
    this.lastTick = now;
    if (!this.inSessionNow) return;
    for (const p of this.world.players.values()) {
      const room = this.roomOf(p);
      if (!room) continue;
      let a = this.marks.get(p.id);
      if (!a) {
        a = { ms: 0, late: now - this.startedAt > this.world.academics.lateAfterMs, zone: room };
        this.marks.set(p.id, a);
        if (a.late) this.world.notice(p, 'You came in late. The instructor noted it.', 'warn');
      }
      a.ms += dt;
      a.zone = room;
    }
  }

  private startClass(now: number) {
    this.inSessionNow = true;
    this.startedAt = now;
    this.endsAt = this.world.clock.endsAtMs;
    this.marks.clear();
    this.roster = new Set([...this.world.players.keys()].filter((id) => !id.startsWith('bot-')));
    this.lastTick = now;
    const r = CAMPUS_MAP.doors.find((d) => d.rect.x === 36 && d.rect.y === 42)!.rect;
    this.world.events.emit('buzz', 'The bell rang. Class is starting.', { x: (r.x + 1) * CAMPUS_MAP.tile, y: (r.y + 0.5) * CAMPUS_MAP.tile }, { key: 'bell', cooldownMs: 20_000, tone: 'info', priority: false });
  }

  private endClass(now: number) {
    this.inSessionNow = false;
    const need = (this.endsAt - this.startedAt) * ATTEND_FRAC;
    const present: string[] = [];
    for (const id of this.roster) {
      const p = this.world.players.get(id);
      if (!p) continue;
      if (this.world.academics.isGraduate(p)) continue;
      const a = this.marks.get(id);
      if (!a) {
        this.world.academics.lessonResult(p, MARK_ABSENT, false, null, 0);
        this.world.notice(p, 'You missed class today. It counts against your GPA.', 'warn');
      } else if (a.ms >= need) {
        const base = a.late ? LATE_PAY : ATTEND_PAY;
        const { extra, parts } = this.world.academics.lessonResult(p, a.late ? MARK_LATE : MARK_ON_TIME, true, a.zone, base);
        this.world.credit(p, base + extra);
        const more = parts.length ? ` (+${parts.join(', +')})` : '';
        this.world.notice(p, a.late ? `Marked present, but late. +${base + extra} LD${more}` : `Attendance marked. +${base + extra} LD${more}`, 'good');
        this.world.log('attended', p.id);
        present.push(id);
      } else {
        this.world.academics.lessonResult(p, MARK_LEFT_EARLY, false, null, 0);
        this.world.notice(p, 'You left class too early, so no attendance mark.', 'warn');
      }
    }
    this.marks.clear();
    this.roster.clear();
    this.world.academics.classEnded(present);
    void now;
  }
}
