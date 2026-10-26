import { CAMPUS_MAP, CAROUSEL_COMPANY_PAY, CAROUSEL_MAX, CAROUSEL_RADIUS, CAROUSEL_TIME_MS, TILE } from '@campus/shared';
import type { ServerPlayer, World } from './world';

/** The Carousel: pay a little, hop on, ride for 12 seconds. Ride with someone else and you get a bonus. */
export class CarouselEngine {
  private slots = new Map<string, number>();
  private peak = new Map<string, number>();
  private cx: number;
  private cy: number;

  constructor(private world: World) {
    const r = CAMPUS_MAP.spots.find((s) => s.id === 'carousel')!.rect;
    this.cx = (r.x + r.w / 2) * TILE;
    this.cy = (r.y + r.h / 2) * TILE;
  }

  get riders() { return this.slots.size; }

  /** Called after the fee is paid. */
  ride(p: ServerPlayer) {
    if (this.slots.size >= CAROUSEL_MAX) return false;
    const taken = new Set(this.slots.values());
    let slot = 0;
    while (taken.has(slot)) slot++;
    this.slots.set(p.id, slot);
    const a = (slot / CAROUSEL_MAX) * Math.PI * 2;
    this.world.stand(p);
    this.world.stopFollowing(p, false);
    p.path = []; p.dirX = 0; p.dirY = 0; p.moving = false;
    p.x = this.cx + Math.cos(a) * CAROUSEL_RADIUS * TILE;
    p.y = this.cy + Math.sin(a) * CAROUSEL_RADIUS * TILE;
    p.doing = 'spin';
    p.doingUntil = this.world.now() + CAROUSEL_TIME_MS;
    this.world.pushState(p);
    this.world.broadcast({ t: 'snap', tick: this.world.tick, moves: [{ id: p.id, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, f: p.facing, m: false }] });
    this.peak.set(p.id, this.slots.size);
    for (const id of this.slots.keys()) this.peak.set(id, Math.max(this.peak.get(id) ?? 0, this.slots.size));
    this.world.notice(p, 'Hold on tight!', 'fun');
    this.world.log('rode', p.id);
    this.world.games.broadcast();
    return true;
  }

  /** The ride ended or was cut short. */
  left(p: ServerPlayer, finished: boolean) {
    if (!this.slots.delete(p.id)) return;
    this.world.games.broadcast();
    const together = (this.peak.get(p.id) ?? 1) >= 2;
    this.peak.delete(p.id);
    if (finished && together) {
      this.world.credit(p, CAROUSEL_COMPANY_PAY);
      this.world.pushSelf(p);
      this.world.notice(p, `That was fun together. +${CAROUSEL_COMPANY_PAY} LD`, 'good');
    } else if (finished) this.world.notice(p, 'Ride over. It is more fun with friends.', 'info');
  }
}
