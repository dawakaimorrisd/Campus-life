import { CAMPUS_MAP, DRINK_SPEED, MARKET_ITEMS, distToRect, type MarketItemId } from '@campus/shared';
import type { ServerPlayer, World } from './world';

const REACH = 90;

/** The Marketplace stall: small purchases that change how the next few minutes play. */
export class MarketEngine {
  private glow = new Map<string, number>();
  private charm = new Map<string, number>();

  constructor(private world: World) {}

  hasGlow(p: { id: string }) { return (this.glow.get(p.id) ?? 0) > this.world.now(); }
  hasCharm(p: { id: string }) { return (this.charm.get(p.id) ?? 0) > this.world.now(); }

  open(p: ServerPlayer) { this.world.send(p, { t: 'open', what: 'market' }); }

  buy(p: ServerPlayer, id: MarketItemId) {
    const item = MARKET_ITEMS.find((i) => i.id === id);
    if (!item) return;
    const spot = CAMPUS_MAP.spots.find((s) => s.kind === 'market')!;
    if (distToRect(CAMPUS_MAP, spot.rect, p.x, p.y) > REACH) return this.world.notice(p, 'Walk up to the market stall first.', 'warn');
    const price = Math.max(1, Math.round(item.price * this.world.clock.mult('market')));
    if (p.money < price) return this.world.notice(p, `${item.name} is ${price} LD. You are short.`, 'warn');
    const now = this.world.now();
    p.money -= price;
    if (id === 'drink') { p.boostMul = DRINK_SPEED; p.boostUntil = now + item.ms; }
    else if (id === 'bracelet') { this.glow.set(p.id, now + item.ms); this.world.pushState(p); }
    else this.charm.set(p.id, now + item.ms);
    this.world.pushSelf(p);
    this.world.notice(p, `${item.icon} ${item.name}. ${item.desc}`, 'good');
    this.world.log('bought', p.id);
  }

  tick(now: number) {
    for (const [id, until] of this.glow) {
      if (until > now) continue;
      this.glow.delete(id);
      const p = this.world.players.get(id);
      if (p) this.world.pushState(p);
    }
    for (const [id, until] of this.charm) if (until <= now) this.charm.delete(id);
  }

  removed(id: string) { this.glow.delete(id); this.charm.delete(id); }
}
