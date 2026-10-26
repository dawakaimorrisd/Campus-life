import { BUZZ_HALF_LIFE_MS, BUZZ_KNOWN_FOR, BUZZ_SPIKE_COOLDOWN_MS, BUZZ_TALKED_ABOUT, dist, levelAt } from '@campus/shared';
import type { BuzzRow, Store } from './store';
import type { World } from './world';

type Trait = 'helper' | 'connector' | 'funny' | 'trouble';
interface Profile {
  helper: number;
  connector: number;
  funny: number;
  trouble: number;
  total: number;
  at: number;
}

const TRAITS: Trait[] = ['helper', 'connector', 'funny', 'trouble'];
const LABELS: Record<Trait, string> = {
  helper: 'the one who helps people out',
  connector: 'the one who always knows what is happening',
  funny: 'the funny one',
  trouble: 'the troublemaker'
};

/**
 * Chichi: campus buzz. Never shown as a number. It decays, so being memorable means
 * staying memorable, and it only ever surfaces as how other people talk about you.
 */
export class Chichi {
  private profiles = new Map<string, Profile>();
  private dirty = new Set<string>();
  private lastSpike = new Map<string, number>();

  constructor(
    private world: World,
    private store?: Store
  ) {}

  async ensureLoaded(id: string) {
    if (!this.store || id.startsWith('bot-') || this.profiles.has(id)) return;
    const r = await this.store.loadBuzz(id);
    if (r) this.profiles.set(id, { helper: r.helper, connector: r.connector, funny: r.funny, trouble: r.trouble, total: r.total, at: r.updatedMs });
  }

  private get(id: string): Profile {
    const now = this.world.now();
    let p = this.profiles.get(id);
    if (!p) {
      p = { helper: 0, connector: 0, funny: 0, trouble: 0, total: 0, at: now };
      this.profiles.set(id, p);
    }
    const f = Math.pow(0.5, Math.max(0, now - p.at) / BUZZ_HALF_LIFE_MS);
    if (f < 1) {
      for (const k of [...TRAITS, 'total'] as const) p[k] *= f;
      p.at = now;
    }
    return p;
  }

  private add(id: string, d: Partial<Record<Trait | 'total', number>>) {
    const p = this.get(id);
    for (const [k, v] of Object.entries(d)) p[k as Trait | 'total'] += v as number;
    this.dirty.add(id);
    this.checkSpike(id, p);
  }

  private bystanders(id: string): number {
    const me = this.world.players.get(id);
    if (!me) return 0;
    let n = 0;
    for (const o of this.world.players.values()) {
      if (o !== me && levelAt(o.y) === levelAt(me.y) && dist(o, me) <= 320) n++;
    }
    return n;
  }

  /** Every interaction the world logs lands here and nudges a few quiet numbers. */
  apply(kind: string, a: string, b: string | null) {
    switch (kind) {
      case 'helped': this.add(a, { helper: 4, total: 2 }); if (b) this.add(b, { total: 0.5 }); break;
      case 'invite_accepted': this.add(a, { connector: 2, total: 1 }); break;
      case 'followed': if (b) this.add(b, { connector: 1, total: 0.5 }); break;
      case 'joined': if (b) this.add(b, { connector: 1, total: 0.5 }); break;
      case 'ate_together': this.add(a, { total: 0.5 }); if (b) this.add(b, { total: 0.5 }); break;
      case 'together': this.add(a, { total: 0.3 }); if (b) this.add(b, { total: 0.3 }); break;
      case 'pranked': this.add(a, { funny: 2, total: 1 }); if (b) this.add(b, { total: 0.5 }); break;
      case 'stole': {
        const crowd = this.bystanders(a) >= 2 ? 2 : 0;
        this.add(a, { trouble: 3, total: 2 + crowd });
        if (b) this.add(b, { total: 1 + crowd / 2 });
        break;
      }
      case 'reclaimed': this.add(a, { funny: 1, total: 1 }); if (b) this.add(b, { total: 0.5 }); break;
      case 'escaped_together': this.add(a, { trouble: 1.5, funny: 1, total: 1.5 }); if (b) this.add(b, { total: 1 }); break;
      case 'played_music': this.add(a, { connector: 2, total: 2 }); break;
      case 'gave_food':
      case 'gave_money': this.add(a, { helper: 1.5, total: 1 }); if (b) this.add(b, { total: 0.3 }); break;
      default: break;
    }
  }

  private checkSpike(id: string, p: Profile) {
    if (p.total < BUZZ_TALKED_ABOUT) return;
    const now = this.world.now();
    if (now - (this.lastSpike.get(id) ?? -Infinity) < BUZZ_SPIKE_COOLDOWN_MS) return;
    const pl = this.world.players.get(id);
    if (!pl) return;
    this.lastSpike.set(id, now);
    this.world.events.emit('buzz', `People are talking about ${pl.name} 👀`, pl, { key: `buzz:${id}`, cooldownMs: BUZZ_SPIKE_COOLDOWN_MS, tone: 'fun', priority: true });
  }

  /** "Known as ..." once a pattern is clear, otherwise null. Other players recognise you before the game labels you. */
  knownAs(id: string): string | null {
    const p = this.get(id);
    const ranked = TRAITS.map((t) => [t, p[t]] as const).sort((x, y) => y[1] - x[1]);
    const [top, second] = ranked;
    if (top[1] < BUZZ_KNOWN_FOR || top[1] < second[1] * 1.4) return p.total >= BUZZ_TALKED_ABOUT ? 'Campus is talking about them' : null;
    return `Known as ${LABELS[top[0]]}`;
  }

  /** Raw values for tests and tuning only. Never sent to clients. */
  debug(id: string) {
    return { ...this.get(id) };
  }

  async flush() {
    if (!this.store || !this.dirty.size) return;
    const ids = [...this.dirty].filter((id) => !id.startsWith('bot-'));
    this.dirty.clear();
    if (!ids.length) return;
    const rows: BuzzRow[] = ids.map((id) => {
      const p = this.get(id);
      return { id, helper: p.helper, connector: p.connector, funny: p.funny, trouble: p.trouble, total: p.total, updatedMs: p.at };
    });
    try {
      await this.store.saveBuzz(rows);
    } catch {
      for (const id of ids) this.dirty.add(id);
    }
  }
}
