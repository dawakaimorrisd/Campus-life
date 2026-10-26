import {
  ANNOUNCE_MS, CAMPUS_MAP, CHARM_SNEAK_BONUS, CHEER_CAP, CHEER_PAY, CLOSING_MS, ENTRY_FEE, FIRST_SLOT_DELAY_MS, GUARD_CAUGHT_LINES,
  GUARD_ENTRY_LINES, GUARD_LET_IN_LINES, PACKAGE_PRICE, SLOT_COUNT, SLOT_MS, SNEAK_CHANCE, SNEAK_LOCKOUT_MS, zoneAt,
  type EmoteKind, type NightPhase, type NightSlot, type NightState, type PerformerKind
} from '@campus/shared';
import type { ServerPlayer, World } from './world';

const T = CAMPUS_MAP.tile;
/** Where a performer stands (centre of the stage) and where they step down to afterwards. */
const STAGE_SPOT = { x: 56.5 * T, y: 8 * T };
const DROP_SPOT = { x: 51.5 * T, y: 8.5 * T };
/** Just inside the door, where people walk in to after paying. */
const INSIDE_SPOT = { x: 44 * T, y: 9.5 * T };
const CHEERS: readonly EmoteKind[] = ['clap', 'dance', 'laugh', 'wave'];
const MAX_CHEERS_PER_PERSON = 3;
const GATE_PROMPT_COOLDOWN_MS = 3000;
const DOOR_REACH = 110;

const pickOf = <T,>(a: readonly T[], rnd: () => number): T => a[Math.floor(rnd() * a.length)];

export interface NightOptions { fee?: number; rnd?: () => number }

/**
 * Event nights: the guard at the door, tickets, and the stage.
 * The DJ engine decides when the party opens and closes; this class decides who may come in and who may perform.
 * Everything is checked here, so a modified client gains nothing.
 */
export class NightEngine {
  private phase: NightPhase = 'off';
  private opensAt = 0;
  private closesAt = 0;
  private slots: NightSlot[] = [];
  private tickets = new Set<string>();
  private sneakLock = new Map<string, number>();
  private promptAt = new Map<string, number>();
  private cheers = new Map<string, number>();
  private cheeredBy = new Map<string, number>();
  private current: { slot: NightSlot; id: string } | null = null;
  private lastJson = '';
  private announced = false;
  private warned = false;
  readonly fee: number;
  private readonly rnd: () => number;

  constructor(private world: World, o: NightOptions = {}) {
    this.fee = Math.max(0, Math.floor(o.fee ?? ENTRY_FEE));
    this.rnd = o.rnd ?? Math.random;
  }

  private get door() {
    const d = CAMPUS_MAP.venue.door;
    return { x: (d.x + 0.5) * T, y: (d.y + 0.5) * T };
  }

  private inside(p: { x: number; y: number }) {
    return zoneAt(CAMPUS_MAP, p.x, p.y)?.id === 'student_center';
  }

  hasTicket(p: ServerPlayer) { return this.tickets.has(p.id); }

  /** Is the door being guarded right now? */
  private get guarded() { return this.fee > 0 && (this.phase === 'open' || this.phase === 'closing'); }

  state(): NightState {
    const cur = this.current;
    const who = cur ? this.world.players.get(cur.id) : undefined;
    return {
      phase: this.phase, now: this.world.now(), opensAt: this.opensAt, closesAt: this.closesAt, fee: this.fee,
      prices: { ...PACKAGE_PRICE }, slots: this.slots.map((s) => ({ ...s })),
      onStage: cur && who && cur.slot.kind ? { name: who.name, kind: cur.slot.kind, endsAt: cur.slot.endsAt } : null
    };
  }

  /** Send the night to everybody if anything visible changed. */
  private publish(force = false) {
    const s = this.state();
    const json = JSON.stringify({ ...s, now: 0 });
    if (!force && json === this.lastJson) return;
    this.lastJson = json;
    this.world.broadcast({ t: 'night', ...s });
  }

  // ---------- life cycle (called by the DJ engine) ----------
  opened(now: number, closesAt: number) {
    this.phase = 'open';
    this.opensAt = now;
    this.closesAt = closesAt;
    this.announced = true;
    this.warned = false;
    this.tickets = new Set();
    this.sneakLock.clear();
    // Anyone already inside when the doors open is not turned away.
    for (const p of this.world.players.values()) if (this.inside(p)) this.tickets.add(p.id);
    this.makeSlots(now + FIRST_SLOT_DELAY_MS);
    this.pushTickets();
    this.publish(true);
  }

  closed(now: number) {
    void now;
    this.endPerformance(false);
    this.phase = 'off';
    this.closesAt = 0;
    this.slots = [];
    this.tickets = new Set();
    this.announced = false;
    this.pushTickets();
    this.publish(true);
  }

  private makeSlots(firstStart: number) {
    this.slots = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const startsAt = firstStart + i * SLOT_MS;
      this.slots.push({ i, startsAt, endsAt: startsAt + SLOT_MS, kind: null, name: null, by: null });
    }
  }

  private pushTickets() {
    for (const p of this.world.players.values()) this.world.pushSelf(p);
  }

  /** About once a second. */
  tick(now: number) {
    const dj = this.world.dj;
    if (dj.isOn) {
      const left = dj.closeAt ? dj.closeAt - now : Infinity;
      if (this.phase === 'open' && left <= CLOSING_MS) {
        this.phase = 'closing';
        if (!this.warned) { this.warned = true; dj.shout('Last dance, everybody! The night is almost over.'); }
      }
      this.runStage(now);
    } else if (dj.nextOpenAt && dj.nextOpenAt - now <= ANNOUNCE_MS && this.phase === 'off') {
      this.phase = 'announced';
      this.opensAt = dj.nextOpenAt;
      if (!this.announced) {
        this.announced = true;
        this.world.events.emit('music', this.fee > 0 ? `Event night at the Student Center soon. Entry ${this.fee} LD.` : 'Event night at the Student Center soon.', this.door, { key: 'night-soon', cooldownMs: 30_000, tone: 'fun', priority: true });
        dj.shout(this.fee > 0 ? `Event night soon! Entry is ${this.fee} LD at the door.` : 'Event night soon! Everybody welcome.');
      }
    }
    this.publish();
  }

  // ---------- the guard ----------
  /** Does the guard stop this player from stepping from (px,py) to (nx,ny)? Called for every move. */
  blocks(p: ServerPlayer, nx: number, ny: number): boolean {
    if (this.world.clock.phase === 'bedtime' && this.inside({ x: nx, y: ny }) && !this.inside(p)) { this.prompt(p, true); return true; }
    if (!this.guarded || this.tickets.has(p.id)) return false;
    if (this.inside({ x: nx, y: ny }) && !this.inside(p)) { this.prompt(p); return true; }
    return false;
  }

  /** Tell a player the guard is asking. */
  prompt(p: ServerPlayer, closed = false) {
    const now = this.world.now();
    if ((this.promptAt.get(p.id) ?? 0) > now) return;
    this.promptAt.set(p.id, now + GATE_PROMPT_COOLDOWN_MS);
    const wait = Math.max(0, (this.sneakLock.get(p.id) ?? 0) - now);
    this.world.send(p, {
      t: 'gate', fee: this.fee, money: p.money, line: pickOf(GUARD_ENTRY_LINES, this.rnd),
      canSneak: p.allowMischief && !closed, sneakWaitMs: wait, ...(closed ? { closed: true, line: 'The party is over. Everybody goes to bed now. Come back tomorrow night!' } : {})
    });
  }

  private atDoor(p: ServerPlayer) {
    return Math.hypot(p.x - this.door.x, p.y - this.door.y) <= DOOR_REACH;
  }

  private admit(p: ServerPlayer) {
    this.tickets.add(p.id);
    this.world.pushSelf(p);
    this.world.moveTo(p, INSIDE_SPOT.x, INSIDE_SPOT.y);
  }

  payEntry(p: ServerPlayer) {
    if (!this.guarded) return;
    if (this.tickets.has(p.id)) return this.world.notice(p, 'You already have your ticket.', 'info');
    if (!this.atDoor(p)) return this.world.notice(p, 'Walk to the Student Center door first.', 'info');
    if (p.money < this.fee) return this.world.notice(p, `Entry is ${this.fee} LD and you have ${Math.floor(p.money)} LD. Do some work first.`, 'warn');
    p.money -= this.fee;
    this.admit(p);
    this.world.notice(p, `${pickOf(GUARD_LET_IN_LINES, this.rnd)} (-${this.fee} LD)`, 'good');
    this.world.log('paid_entry', p.id);
  }

  sneakIn(p: ServerPlayer) {
    if (!this.guarded || this.tickets.has(p.id)) return;
    if (!this.atDoor(p)) return this.world.notice(p, 'Walk to the Student Center door first.', 'info');
    if (!p.allowMischief) return this.world.notice(p, 'Turn mischief on in your settings if you want to try sneaking in.', 'info');
    const now = this.world.now();
    const wait = (this.sneakLock.get(p.id) ?? 0) - now;
    if (wait > 0) return this.world.notice(p, `The guard is watching you. Try again in ${Math.ceil(wait / 1000)}s, or pay.`, 'warn');
    if (this.rnd() < SNEAK_CHANCE + (this.world.market.hasCharm(p) ? CHARM_SNEAK_BONUS : 0)) {
      this.admit(p);
      this.world.notice(p, 'You slipped past the guard!', 'fun');
      this.world.log('sneaked_in', p.id);
    } else {
      this.sneakLock.set(p.id, now + SNEAK_LOCKOUT_MS);
      p.path = [];
      p.x = Math.max(0, this.door.x - 2.2 * T);
      this.world.pushState(p);
      this.world.notice(p, pickOf(GUARD_CAUGHT_LINES, this.rnd), 'warn');
      this.world.log('caught_sneaking', p.id);
    }
  }

  // ---------- the stage ----------
  bookSlot(p: ServerPlayer, kind: PerformerKind) {
    const now = this.world.now();
    if (this.phase !== 'open' && this.phase !== 'closing') return this.world.notice(p, 'There is no event night right now.', 'info');
    if (this.fee > 0 && !this.tickets.has(p.id)) return this.world.notice(p, 'Get your ticket at the door first.', 'warn');
    if (!this.inside(p)) return this.world.notice(p, 'Go inside the Student Center to book the stage.', 'info');
    if (this.slots.some((s) => s.by === p.id && s.endsAt > now)) return this.world.notice(p, 'You already have a slot tonight.', 'info');
    const slot = this.slots.find((s) => !s.by && s.startsAt - now > 3000);
    if (!slot) return this.world.notice(p, 'All the slots are taken. Maybe next time!', 'warn');
    const price = PACKAGE_PRICE[kind];
    if (p.money < price) return this.world.notice(p, `The ${kind} package is ${price} LD and you have ${Math.floor(p.money)} LD.`, 'warn');
    p.money -= price;
    slot.kind = kind;
    slot.name = p.name;
    slot.by = p.id;
    this.world.pushSelf(p);
    const secs = Math.max(0, Math.round((slot.startsAt - now) / 1000));
    this.world.notice(p, `Booked! You are on stage as a ${kind} in about ${secs}s. Stay inside. (-${price} LD)`, 'good');
    this.world.log('booked_stage', p.id);
    this.publish();
  }

  /** A cheer from the crowd while someone is on stage. */
  noteEmote(p: ServerPlayer, kind: EmoteKind) {
    const cur = this.current;
    if (!cur || p.id === cur.id || !CHEERS.includes(kind) || !this.inside(p)) return;
    const mine = this.cheeredBy.get(p.id) ?? 0;
    if (mine >= MAX_CHEERS_PER_PERSON) return;
    this.cheeredBy.set(p.id, mine + 1);
    this.cheers.set(cur.id, (this.cheers.get(cur.id) ?? 0) + 1);
  }

  private runStage(now: number) {
    const cur = this.current;
    if (cur) {
      const who = this.world.players.get(cur.id);
      if (!who) return this.endPerformance(false);
      if (now >= cur.slot.endsAt) this.endPerformance(true);
      return;
    }
    const next = this.slots.find((s) => s.by && now >= s.startsAt && now < s.endsAt - 5000 && !this.finished.has(s.i));
    if (!next) {
      // Keep the night rolling when it has no fixed end.
      if (this.closesAt === 0 && this.slots.length && now > this.slots[this.slots.length - 1].endsAt) this.makeSlots(now + FIRST_SLOT_DELAY_MS);
      return;
    }
    const who = next.by ? this.world.players.get(next.by) : undefined;
    this.finished.add(next.i);
    if (!who || !this.inside(who)) {
      if (who) this.world.notice(who, 'You missed your slot because you were not inside. No refund.', 'warn');
      return;
    }
    this.startPerformance(who, next, now);
  }
  private finished = new Set<number>();

  private startPerformance(p: ServerPlayer, slot: NightSlot, now: number) {
    this.world.stand(p);
    p.path = []; p.dirX = 0; p.dirY = 0;
    p.x = STAGE_SPOT.x; p.y = STAGE_SPOT.y; p.facing = 'left'; p.moving = false;
    p.doing = 'perform'; p.doingUntil = slot.endsAt + 3000;
    this.current = { slot, id: p.id };
    this.cheers.set(p.id, 0);
    this.cheeredBy.clear();
    this.world.dj.stageActive = true;
    this.world.dj.shout(`On stage: ${p.name}, our ${slot.kind}! Make some noise!`);
    this.world.broadcast({ t: 'snap', tick: this.world.tick, moves: [{ id: p.id, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, f: p.facing, m: false }] });
    this.world.pushState(p);
    this.world.notice(p, `You are on! ${slot.kind === 'singer' ? 'Sing' : 'Dance'} your heart out.`, 'fun');
    void now;
    this.publish(true);
  }

  private endPerformance(paid: boolean) {
    const cur = this.current;
    if (!cur) return;
    this.current = null;
    this.world.dj.stageActive = false;
    const p = this.world.players.get(cur.id);
    const cheers = Math.min(this.cheers.get(cur.id) ?? 0, CHEER_CAP);
    this.cheers.delete(cur.id);
    if (!p) return this.publish(true);
    p.doing = null;
    p.x = DROP_SPOT.x; p.y = DROP_SPOT.y; p.facing = 'left'; p.moving = false;
    if (paid && cur.slot.kind) {
      const price = PACKAGE_PRICE[cur.slot.kind];
      const pay = price + cheers * CHEER_PAY;
      this.world.credit(p, pay);
      this.world.notice(p, cheers > 0 ? `The crowd cheered ${cheers} time${cheers === 1 ? '' : 's'}! You earned ${pay} LD.` : `Nice set. You earned ${pay} LD.`, 'good');
      this.world.dj.shout(cheers >= 4 ? `Give it up for ${p.name}!` : `Thank you, ${p.name}!`);
      this.world.log('performed', p.id);
    }
    this.world.broadcast({ t: 'snap', tick: this.world.tick, moves: [{ id: p.id, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, f: p.facing, m: false }] });
    this.world.pushState(p);
    this.publish(true);
  }

  /** A player left the game. */
  removed(id: string) {
    this.tickets.delete(id);
    this.promptAt.delete(id);
    this.sneakLock.delete(id);
  }
}
