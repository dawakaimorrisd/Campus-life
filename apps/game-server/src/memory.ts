import { TOGETHER_PAIR_COOLDOWN_MS } from '@campus/shared';
import type { Store } from './store';
import type { World } from './world';

interface Row {
  kind: string;
  a: string;
  b: string;
  count: number;
  delta: number;
  last: number;
  persist: boolean;
}

/** Interactions that are the same in both directions are stored once, with sorted ids. */
const SYMMETRIC = new Set(['ate_together', 'together', 'escaped_together']);
const MEMORABLE = new Set([
  'ate_together', 'together', 'helped', 'gave_food', 'gave_money', 'followed', 'joined',
  'invite_accepted', 'stole', 'reclaimed', 'pranked', 'escaped_together'
]);

const times = (n: number) => (n <= 1 ? 'once' : n <= 4 ? 'a few times' : 'many times');

/**
 * Quiet social memory. There is no friendship number anywhere. The world just remembers
 * who did what with whom, and uses it to make meeting someone again feel like meeting someone.
 */
export class SocialMemory {
  private rows = new Map<string, Row>();
  private byPlayer = new Map<string, Set<string>>();
  private names = new Map<string, string>();
  private cooldown = new Map<string, number>();
  private raw: Array<{ kind: string; a: string; b: string | null; atMs: number }> = [];

  constructor(
    private world: World,
    private store?: Store
  ) {}

  setName(id: string, name: string) {
    this.names.set(id, name);
  }

  async ensureLoaded(id: string) {
    if (!this.store || id.startsWith('bot-')) return;
    const { rows, names } = await this.store.loadRelationships(id);
    for (const [k, v] of Object.entries(names)) if (!this.names.has(k)) this.names.set(k, v);
    for (const r of rows) {
      const key = `${r.kind}|${r.a}|${r.b}`;
      if (this.rows.has(key)) continue;
      this.rows.set(key, { kind: r.kind, a: r.a, b: r.b, count: r.count, delta: 0, last: r.lastMs, persist: true });
      this.index(r.a, key);
      this.index(r.b, key);
    }
  }

  private index(id: string, key: string) {
    (this.byPlayer.get(id) ?? this.byPlayer.set(id, new Set()).get(id)!).add(key);
  }

  record(kind: string, a: string, b: string | null) {
    if (!b || a === b || !MEMORABLE.has(kind)) return;
    const now = this.world.now();
    for (const id of [a, b]) {
      const n = this.world.players.get(id)?.name;
      if (n) this.names.set(id, n);
    }
    let [x, y] = [a, b];
    if (SYMMETRIC.has(kind) && x > y) [x, y] = [y, x];
    if (kind === 'together') {
      const ck = `${x}|${y}`;
      if (now - (this.cooldown.get(ck) ?? 0) < TOGETHER_PAIR_COOLDOWN_MS) return;
      this.cooldown.set(ck, now);
    }
    const key = `${kind}|${x}|${y}`;
    const persist = !x.startsWith('bot-') && !y.startsWith('bot-');
    let row = this.rows.get(key);
    if (!row) {
      row = { kind, a: x, b: y, count: 0, delta: 0, last: now, persist };
      this.rows.set(key, row);
      this.index(x, key);
      this.index(y, key);
    }
    row.count++;
    row.last = now;
    if (persist) {
      row.delta++;
      this.raw.push({ kind, a, b, atMs: now });
    }
  }

  /** How much history two people share (total remembered moments). */
  bond(a: string, b: string): number {
    let n = 0;
    for (const key of this.byPlayer.get(a) ?? []) {
      const r = this.rows.get(key)!;
      if ((r.a === a && r.b === b) || (r.a === b && r.b === a)) n += r.count;
    }
    return n;
  }

  /** A human sentence about what you two have been through, or null if nothing yet. */
  line(me: string, other: string): string | null {
    const name = this.names.get(other) ?? 'They';
    const mine: Row[] = [];
    for (const key of this.byPlayer.get(me) ?? []) {
      const r = this.rows.get(key)!;
      if ((r.a === me && r.b === other) || (r.a === other && r.b === me)) mine.push(r);
    }
    if (!mine.length) return null;
    mine.sort((x, y) => y.count - x.count || y.last - x.last);
    const frags = mine.slice(0, 3).map((r) => {
      const t = times(r.count);
      const iAmA = r.a === me;
      switch (r.kind) {
        case 'ate_together': return `you've eaten together ${t}`;
        case 'together': return `you've hung out ${t}`;
        case 'helped': return iAmA ? `you helped ${name} ${t}` : `${name} helped you ${t}`;
        case 'gave_food': return iAmA ? `you shared your food with ${name} ${t}` : `${name} shared food with you ${t}`;
        case 'gave_money': return iAmA ? `you gave ${name} money ${t}` : `${name} gave you money ${t}`;
        case 'followed': return iAmA ? `you followed ${name} ${t}` : `${name} followed you ${t}`;
        case 'joined': return iAmA ? `you joined ${name} ${t}` : `${name} joined you ${t}`;
        case 'invite_accepted': return iAmA ? `${name} came when you called ${t}` : `you came when ${name} called ${t}`;
        case 'stole': return iAmA ? `you took ${name}'s food ${t}` : `${name} took your food ${t}`;
        case 'reclaimed': return iAmA ? `you took your plate back from ${name} ${t}` : `${name} took a plate back from you ${t}`;
        case 'pranked': return iAmA ? `you got ${name} ${t}` : `${name} got you ${t}`;
        case 'escaped_together': return `you slipped out of class together ${t}`;
        default: return `you have history`;
      }
    });
    const s = frags.length === 1 ? frags[0] : `${frags.slice(0, -1).join(', ')}, and ${frags[frags.length - 1]}`;
    return s.charAt(0).toUpperCase() + s.slice(1) + '.';
  }

  async flush() {
    if (!this.store) return;
    const dirty = [...this.rows.values()].filter((r) => r.persist && r.delta > 0);
    const raw = this.raw;
    this.raw = [];
    try {
      if (dirty.length) {
        const snapshot = dirty.map((r) => ({ r, d: r.delta }));
        await this.store.saveRelationships(snapshot.map(({ r, d }) => ({ kind: r.kind, a: r.a, b: r.b, delta: d, lastMs: r.last })));
        for (const { r, d } of snapshot) r.delta -= d;
      }
      if (raw.length) await this.store.logInteractions(raw);
    } catch {
      this.raw = raw.concat(this.raw);
    }
  }
}
