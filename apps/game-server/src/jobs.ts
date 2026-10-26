import { CAMPUS_MAP, JOBS, JOB_SLOTS, zoneAt, type ActiveJob, type JobSlot } from '@campus/shared';
import type { ServerPlayer, World } from './world';

interface Slot { jobId: string; takenBy: string | null }
interface Active { slot: number; jobId: string; endsAt: number }

/**
 * The jobs board in the Student Hall. Three errands at a time; each is a delivery to somewhere on campus with a
 * time limit. One student per errand. Reaching the place in time pays; running out of time just frees the errand.
 */
export class JobsEngine {
  private slots: Slot[] = [];
  private active = new Map<string, Active>();
  private lastJson = '';
  private readonly rnd: () => number;

  constructor(private world: World, rnd?: () => number) {
    this.rnd = rnd ?? Math.random;
    for (let i = 0; i < JOB_SLOTS; i++) this.slots.push({ jobId: this.pickNew(), takenBy: null });
  }

  private pickNew(): string {
    const used = new Set(this.slots.map((s) => s.jobId));
    const free = JOBS.filter((j) => !used.has(j.id));
    return free[Math.floor(this.rnd() * free.length)].id;
  }

  list(): JobSlot[] {
    return this.slots.map((s, i) => {
      const j = JOBS.find((x) => x.id === s.jobId)!;
      const who = s.takenBy ? this.world.players.get(s.takenBy)?.name ?? 'someone' : null;
      return { slot: i, id: j.id, label: j.label, pay: j.pay * this.world.clock.mult('jobs'), secs: j.secs, takenBy: who };
    });
  }

  private publish() {
    const slots = this.list();
    const json = JSON.stringify(slots);
    if (json === this.lastJson) return;
    this.lastJson = json;
    this.world.broadcast({ t: 'jobs', slots });
  }

  private pushJob(p: ServerPlayer) {
    const a = this.active.get(p.id);
    const j = a ? JOBS.find((x) => x.id === a.jobId) : null;
    const job: ActiveJob | null = a && j ? { label: j.label, to: j.to, pay: j.pay * this.world.clock.mult('jobs'), endsAt: a.endsAt, now: this.world.now() } : null;
    this.world.send(p, { t: 'job', job });
  }

  /** Called when someone stands at the board. */
  open(p: ServerPlayer) {
    this.world.send(p, { t: 'open', what: 'jobs' });
    this.world.send(p, { t: 'jobs', slots: this.list() });
    this.pushJob(p);
  }

  take(p: ServerPlayer, slot: number) {
    const s = this.slots[slot];
    if (!s) return;
    if (this.active.has(p.id)) return this.world.notice(p, 'Finish your current errand first.', 'warn');
    if (s.takenBy) return this.world.notice(p, 'Someone already took that one.', 'warn');
    const j = JOBS.find((x) => x.id === s.jobId)!;
    if (zoneAt(CAMPUS_MAP, p.x, p.y)?.id === j.to) return this.world.notice(p, 'You are already there! Pick another errand.', 'info');
    s.takenBy = p.id;
    this.active.set(p.id, { slot, jobId: s.jobId, endsAt: this.world.now() + j.secs * 1000 });
    this.world.notice(p, `Errand taken. You have ${j.secs} seconds. Go!`, 'fun');
    this.pushJob(p);
    this.publish();
  }

  drop(p: ServerPlayer, why = 'You gave the errand back.') {
    const a = this.active.get(p.id);
    if (!a) return;
    this.active.delete(p.id);
    const s = this.slots[a.slot];
    if (s && s.takenBy === p.id) { s.takenBy = null; }
    this.world.notice(p, why, 'info');
    this.pushJob(p);
    this.publish();
  }

  tick(now: number) {
    for (const [id, a] of [...this.active]) {
      const p = this.world.players.get(id);
      const j = JOBS.find((x) => x.id === a.jobId)!;
      if (!p) { this.release(id, a); continue; }
      if (zoneAt(CAMPUS_MAP, p.x, p.y)?.id === j.to) {
        this.active.delete(id);
        const pay = j.pay * this.world.clock.mult('jobs');
        this.world.credit(p, pay);
        this.world.notice(p, `Delivered! +${pay} LD`, 'good');
        this.world.log('did_job', p.id);
        this.replace(a);
        this.pushJob(p);
      } else if (now >= a.endsAt) {
        this.active.delete(id);
        this.world.notice(p, 'Too slow. The errand went back on the board.', 'warn');
        const s = this.slots[a.slot];
        if (s && s.takenBy === id) s.takenBy = null;
        this.pushJob(p);
      }
    }
    this.publish();
  }

  private replace(a: Active) {
    const s = this.slots[a.slot];
    if (s) { s.jobId = this.pickNew(); s.takenBy = null; }
  }
  private release(id: string, a: Active) {
    this.active.delete(id);
    const s = this.slots[a.slot];
    if (s && s.takenBy === id) s.takenBy = null;
  }

  removed(id: string) {
    const a = this.active.get(id);
    if (a) this.release(id, a);
  }
}
