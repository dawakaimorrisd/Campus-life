import { CAMPUS_MAP, GROUP_LINK, GROUP_MIN, levelAt, zoneAt, type GroupInfo, type ZoneId } from '@campus/shared';
import type { ServerPlayer } from './world';

export interface Cluster {
  ids: string[];
  x: number;
  y: number;
  r: number;
  n: number;
  kind: GroupInfo['kind'];
  zone: ZoneId | null;
  level: 'ground' | 'upper';
}

const STUDY: ZoneId[] = ['library', 'classroom_a', 'classroom_b'];

/**
 * Social gravity: people standing close together form a cluster. There is no
 * "form squad" button. Groups just exist because people chose to stay near each other.
 */
export function computeClusters(players: Iterable<ServerPlayer>, now: number): Cluster[] {
  const list = [...players];
  const parent = list.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (levelAt(list[i].y) !== levelAt(list[j].y)) continue;
      if (Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y) <= GROUP_LINK) parent[find(i)] = find(j);
    }
  }
  const buckets = new Map<number, ServerPlayer[]>();
  list.forEach((p, i) => {
    const r = find(i);
    (buckets.get(r) ?? buckets.set(r, []).get(r)!).push(p);
  });

  const out: Cluster[] = [];
  for (const members of buckets.values()) {
    if (members.length < 2) continue;
    const x = members.reduce((s, m) => s + m.x, 0) / members.length;
    const y = members.reduce((s, m) => s + m.y, 0) / members.length;
    const r = Math.max(...members.map((m) => Math.hypot(m.x - x, m.y - y))) + 44;
    const zone = zoneAt(CAMPUS_MAP, x, y)?.id ?? null;
    const eating = members.filter((m) => m.held === 'plate' || m.eatingUntil > now).length >= 2;
    const walking = members.filter((m) => m.moving).length >= Math.ceil(members.length / 2);
    const kind: Cluster['kind'] = eating ? 'eating' : walking ? 'walking' : zone && STUDY.includes(zone) ? 'study' : 'chat';
    out.push({ ids: members.map((m) => m.id), x, y, r, n: members.length, kind, zone, level: levelAt(y) });
  }
  return out;
}

/** What clients see: only real gatherings (3 or more), rounded so it only changes when it matters. */
export function publicGroups(clusters: Cluster[]): GroupInfo[] {
  return clusters
    .filter((c) => c.n >= GROUP_MIN)
    .map((c) => ({ x: Math.round(c.x / 8) * 8, y: Math.round(c.y / 8) * 8, r: Math.round(c.r / 8) * 8, n: c.n, kind: c.kind, level: c.level }));
}
