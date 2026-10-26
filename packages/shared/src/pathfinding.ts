import { isBlockedTile, type CampusMap, type Vec, type Waypoint } from './map';

class MinHeap {
  private idx: number[] = [];
  private pri: number[] = [];
  get size() {
    return this.idx.length;
  }
  push(i: number, p: number) {
    this.idx.push(i);
    this.pri.push(p);
    let c = this.idx.length - 1;
    while (c > 0) {
      const parent = (c - 1) >> 1;
      if (this.pri[parent] <= this.pri[c]) break;
      this.swap(parent, c);
      c = parent;
    }
  }
  pop(): number {
    const top = this.idx[0];
    const lastI = this.idx.pop()!;
    const lastP = this.pri.pop()!;
    if (this.idx.length) {
      this.idx[0] = lastI;
      this.pri[0] = lastP;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1;
        const r = l + 1;
        let m = c;
        if (l < this.idx.length && this.pri[l] < this.pri[m]) m = l;
        if (r < this.idx.length && this.pri[r] < this.pri[m]) m = r;
        if (m === c) break;
        this.swap(m, c);
        c = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.idx[a], this.idx[b]] = [this.idx[b], this.idx[a]];
    [this.pri[a], this.pri[b]] = [this.pri[b], this.pri[a]];
  }
}

function nearestWalkable(map: CampusMap, tx: number, ty: number, maxR: number): { tx: number; ty: number } | null {
  if (!isBlockedTile(map, tx, ty)) return { tx, ty };
  for (let r = 1; r <= maxR; r++) {
    let best: { tx: number; ty: number } | null = null;
    let bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (isBlockedTile(map, tx + dx, ty + dy)) continue;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = { tx: tx + dx, ty: ty + dy };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

const DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2]
];

/**
 * A* over the tile grid (8-directional, no corner cutting).
 * Returns pixel waypoints (excluding the start tile). Empty array = nowhere to go.
 * If the clicked tile is blocked, heads for the nearest walkable tile instead.
 */
export function findPath(map: CampusMap, sx: number, sy: number, ex: number, ey: number): Waypoint[] {
  const T = map.tile;
  const W = map.width;
  const clickTx = Math.floor(ex / T);
  const clickTy = Math.floor(ey / T);
  const start = nearestWalkable(map, Math.floor(sx / T), Math.floor(sy / T), 3);
  const end = nearestWalkable(map, clickTx, clickTy, 6);
  if (!start || !end) return [];

  const exact = end.tx === clickTx && end.ty === clickTy;
  const endPoint: Waypoint = exact ? { x: ex, y: ey } : { x: (end.tx + 0.5) * T, y: (end.ty + 0.5) * T };

  if (start.tx === end.tx && start.ty === end.ty) return [endPoint];

  const N = W * map.height;
  const g = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = new MinHeap();
  const startI = start.ty * W + start.tx;
  const endI = end.ty * W + end.tx;
  const sameLevel = (a: number, b: number) => (a >= 70) === (b >= 70);
  const h = (tx: number, ty: number) => {
    if (!sameLevel(ty, end.ty)) return 0;
    const dx = Math.abs(tx - end.tx);
    const dy = Math.abs(ty - end.ty);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };

  g[startI] = 0;
  heap.push(startI, h(start.tx, start.ty));

  let found = false;
  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === endI) {
      found = true;
      break;
    }
    const cx = cur % W;
    const cy = (cur / W) | 0;
    const warpTo = map.portalIndex.get(cur);
    if (warpTo !== undefined && !closed[warpTo] && g[cur] + 1 < g[warpTo]) {
      g[warpTo] = g[cur] + 1;
      came[warpTo] = cur;
      heap.push(warpTo, g[warpTo] + h(warpTo % W, (warpTo / W) | 0));
    }
    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (isBlockedTile(map, nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (isBlockedTile(map, cx + dx, cy) || isBlockedTile(map, cx, cy + dy))) continue;
      const ni = ny * W + nx;
      if (closed[ni]) continue;
      const ng = g[cur] + cost;
      if (ng < g[ni]) {
        g[ni] = ng;
        came[ni] = cur;
        heap.push(ni, ng + h(nx, ny));
      }
    }
  }
  if (!found) return [];

  const tiles: number[] = [];
  for (let i = endI; i !== -1 && i !== startI; i = came[i]) tiles.push(i);
  tiles.reverse();
  const out: Waypoint[] = tiles.map((i) => {
    const p: Waypoint = { x: ((i % W) + 0.5) * T, y: (((i / W) | 0) + 0.5) * T };
    // Arrived here by taking a staircase, not by walking.
    if (map.portalIndex.get(came[i]) === i && Math.abs((came[i] % W) - (i % W)) + Math.abs(((came[i] / W) | 0) - ((i / W) | 0)) > 1) p.warp = true;
    return p;
  });
  out[out.length - 1] = endPoint;
  return out;
}
