/**
 * Security patrols. Three guards walk fixed rounds around the grounds. A guard's place is a pure function of time,
 * so the server (who sees what) and every phone (where the guard is drawn) always agree without any messages.
 */
import { findPath } from './pathfinding';
import { zoneGather, type CampusMap, type Facing, type ZoneId } from './map';

export const PATROL_SPEED = 56; // pixels per second (about 1.7 tiles)
export const PATROL_DWELL_MS = 6000;
export const GUARD_SIGHT = 200; // pixels (about 6 tiles)
export const GUARD_CONE = 0.35; // cosine of half the viewing angle (a wide cone in front)
export const GUARD_FINE = 10;
export const GUARD_WARN_COOLDOWN_MS = 60_000;

export interface PatrolDef {
  id: string;
  label: string;
  stops: readonly ZoneId[];
  look: [number, number, number, 0 | 1];
  /** Where in the round this guard starts (0 to 1), so they are spread out. */
  offset: number;
}

export const PATROLS: readonly PatrolDef[] = [
  { id: 'patrol0', label: 'Patrol Guard', stops: ['recreation', 'marketplace', 'palaver_hut', 'marketplace'], look: [3, 9, 0, 0], offset: 0 },
  { id: 'patrol1', label: 'Patrol Guard', stops: ['palaver_hut', 'social_ground', 'lecture_area', 'social_ground'], look: [4, 9, 0, 1], offset: 0.35 },
  { id: 'patrol2', label: 'Patrol Guard', stops: ['back_palaver', 'student_hall', 'palaver_hut', 'student_hall'], look: [2, 9, 0, 0], offset: 0.7 }
];

interface Seg { x0: number; y0: number; x1: number; y1: number; len: number; t0: number; t1: number; dwell: boolean }
export interface Route { def: PatrolDef; segs: Seg[]; period: number }

/** Build every route once (walks the real paths, so a guard never cuts through a wall). */
export function buildRoutes(map: CampusMap): Route[] {
  return PATROLS.map((def) => {
    const stops = def.stops.map((z) => zoneGather(map, z, 0, () => 0.5));
    const segs: Seg[] = [];
    let t = 0;
    const push = (x0: number, y0: number, x1: number, y1: number, dwell: boolean) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const ms = dwell ? PATROL_DWELL_MS : (len / PATROL_SPEED) * 1000;
      if (!dwell && len < 0.5) return;
      segs.push({ x0, y0, x1, y1, len, t0: t, t1: t + ms, dwell });
      t += ms;
    };
    for (let i = 0; i < stops.length; i++) {
      const a = stops[i];
      const b = stops[(i + 1) % stops.length];
      push(a.x, a.y, a.x, a.y, true);
      let cx = a.x, cy = a.y;
      for (const w of findPath(map, a.x, a.y, b.x, b.y)) { push(cx, cy, w.x, w.y, false); cx = w.x; cy = w.y; }
    }
    return { def, segs, period: Math.max(1, t) };
  });
}

export interface GuardPos { id: string; label: string; x: number; y: number; facing: Facing; dx: number; dy: number; moving: boolean }

export function guardAt(route: Route, nowMs: number): GuardPos {
  const tt = (((nowMs + route.def.offset * route.period) % route.period) + route.period) % route.period;
  let s = route.segs[route.segs.length - 1];
  for (const g of route.segs) if (tt < g.t1) { s = g; break; }
  const k = s.t1 > s.t0 ? Math.min(1, Math.max(0, (tt - s.t0) / (s.t1 - s.t0))) : 0;
  const x = s.x0 + (s.x1 - s.x0) * k;
  const y = s.y0 + (s.y1 - s.y0) * k;
  let dx = s.x1 - s.x0, dy = s.y1 - s.y0;
  if (s.dwell || Math.hypot(dx, dy) < 0.01) {
    // standing guards keep looking the way they last walked
    const i = route.segs.indexOf(s);
    for (let j = 1; j <= route.segs.length; j++) {
      const p = route.segs[(i - j + route.segs.length) % route.segs.length];
      if (!p.dwell && Math.hypot(p.x1 - p.x0, p.y1 - p.y0) > 0.01) { dx = p.x1 - p.x0; dy = p.y1 - p.y0; break; }
    }
  }
  const n = Math.hypot(dx, dy) || 1;
  const facing: Facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  return { id: route.def.id, label: route.def.label, x, y, facing, dx: dx / n, dy: dy / n, moving: !s.dwell };
}

/** Can this guard see a person at (px, py)? Within sight, and in front of them. */
export function guardSees(g: GuardPos, px: number, py: number): boolean {
  const vx = px - g.x, vy = py - g.y;
  const d = Math.hypot(vx, vy);
  if (d > GUARD_SIGHT) return false;
  if (d < 24) return true;
  return (vx * g.dx + vy * g.dy) / d >= GUARD_CONE;
}
