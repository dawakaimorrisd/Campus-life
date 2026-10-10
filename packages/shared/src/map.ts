/**
 * The Campus Life map: a real-feeling campus (Bomi, Liberia) with two levels.
 *
 * Deterministic: client and server both call buildCampusMap() and get the same
 * collision grid, so there is one source of truth.
 *
 * Levels: the ground campus occupies rows 0..GROUND_H-1. The upstairs floor of
 * the Student Block is an "island" far below it (rows UPPER_Y0..). Staircase
 * portals link the two, and pathfinding routes through them, so following or
 * inviting someone upstairs "just works". Players on different levels are
 * naturally too far apart to see or hear each other.
 *
 * Coordinates are in tiles unless a name says px. 1 tile = TILE pixels.
 */
export const TILE = 32;
export const MAP_W = 72;
export const MAP_H = 111;
export const GROUND_H = 64;
export const UPPER_Y0 = 84;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;

import { FOOD_PRICE, MOTO_PRICE, MUSIC_PRICE } from './constants';

export type Facing = 'up' | 'down' | 'left' | 'right';
export type Level = 'ground' | 'upper';

export type ZoneId =
  | 'agri_office'
  | 'admin_hall'
  | 'admin_hallway'
  | 'student_hall'
  | 'staircase'
  | 'student_center'
  | 'classroom_a'
  | 'classroom_b'
  | 'upstairs_corridor'
  | 'library'
  | 'palaver_hut'
  | 'back_palaver';

export const ZONE_IDS: readonly ZoneId[] = [
  'agri_office',
  'admin_hall',
  'admin_hallway',
  'student_hall',
  'staircase',
  'student_center',
  'classroom_a',
  'classroom_b',
  'upstairs_corridor',
  'library',
  'palaver_hut',
  'back_palaver'
];
/** Enclosed rooms. Voices get muffled between indoors and outdoors (the huts are open-air). */
export const INDOOR_ZONES: readonly ZoneId[] = [
  'agri_office',
  'admin_hall',
  'admin_hallway',
  'student_hall',
  'staircase',
  'student_center',
  'classroom_a',
  'classroom_b',
  'upstairs_corridor',
  'library'
];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Vec {
  x: number;
  y: number;
}
/** A path point. `warp` means "teleport here" (taking a staircase). */
export interface Waypoint extends Vec {
  warp?: boolean;
}
export interface Zone {
  id: ZoneId;
  name: string;
  rect: Rect;
  /** Circular zones (the open-air huts) also carry a centre/radius in tiles. */
  circle?: { cx: number; cy: number; r: number };
  /** Where people gather when invited here (tile coords, walkable). */
  gather: Vec;
  level: Level;
}
export interface Seat {
  id: string;
  x: number;
  y: number;
  facing: Facing;
  zone: ZoneId | null;
}
export type FurnitureKind =
  | 'desk'
  | 'whiteboard'
  | 'chair'
  | 'table'
  | 'small_table'
  | 'bench'
  | 'counter'
  | 'stall'
  | 'shelf'
  | 'filing'
  | 'stacked_chairs'
  | 'bucket'
  | 'stairs'
  | 'hedge'
  | 'car'
  | 'motorcycle'
  | 'loader'
  | 'post';
export interface Furniture {
  kind: FurnitureKind;
  rect: Rect;
  blocking: boolean;
  facing?: Facing;
}
export type BuildingStyle = 'admin' | 'student' | 'center' | 'upper';
export interface Building {
  id: string;
  rect: Rect;
  level: Level;
  style: BuildingStyle;
}
export interface Door {
  rect: Rect;
  kind: 'exterior' | 'interior';
}
export interface Hut {
  zone: ZoneId;
  cx: number;
  cy: number;
  /** Radius of the concrete slab (tiles). */
  r: number;
  pillars: Vec[];
}
export interface Sign {
  text: string;
  x: number;
  y: number;
  kind: 'label' | 'plaque' | 'banner';
}
export interface Portal {
  from: Vec;
  to: Vec;
}
export type TreeKind = 'palm' | 'tree';
export type SpotKind = 'food' | 'music' | 'moto' | 'work';
/** Something you can do while standing next to it (buy food, play music, ride, work). */
export interface Spot {
  id: string;
  kind: SpotKind;
  label: string;
  price: number;
  rect: Rect;
}

export interface CampusMap {
  width: number;
  height: number;
  tile: number;
  /** 1 = blocked (walls, furniture, void), 0 = walkable. Index = ty * width + tx. */
  blocked: Uint8Array;
  /** 0 none, 1 exterior wall, 2 interior partition (for drawing). */
  walls: Uint8Array;
  zones: Zone[];
  buildings: Building[];
  doors: Door[];
  furniture: Furniture[];
  huts: Hut[];
  signs: Sign[];
  trees: Array<Vec & { kind: TreeKind }>;
  paths: Rect[];
  puddles: Vec[];
  portals: Portal[];
  /** from-tile index -> to-tile index, for pathfinding. */
  portalIndex: Map<number, number>;
  spawn: Rect;
  seats: Seat[];
  /** The Back Palaver serving counter (tiles). Stand in front of it to get food. */
  foodCounter: Rect;
  spots: Spot[];
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function inRect(r: Rect, tx: number, ty: number): boolean {
  return tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
}
const grow = (r: Rect, n: number): Rect => ({ x: r.x - n, y: r.y - n, w: r.w + n * 2, h: r.h + n * 2 });
const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export function inZone(z: Zone, tx: number, ty: number): boolean {
  if (z.circle) return Math.hypot(tx + 0.5 - z.circle.cx, ty + 0.5 - z.circle.cy) <= z.circle.r;
  return inRect(z.rect, tx, ty);
}

export const levelOfRow = (ty: number): Level => (ty >= UPPER_Y0 - 6 ? 'upper' : 'ground');

export function buildCampusMap(): CampusMap {
  const N = MAP_W * MAP_H;
  const blocked = new Uint8Array(N).fill(1); // everything starts as void
  const walls = new Uint8Array(N);
  const idx = (x: number, y: number) => y * MAP_W + x;
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  const each = (r: Rect, fn: (x: number, y: number) => void) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inBounds(x, y)) fn(x, y);
  };
  const open = (r: Rect) => each(r, (x, y) => (blocked[idx(x, y)] = 0));
  const wall = (x: number, y: number, kind: 1 | 2) => {
    blocked[idx(x, y)] = 1;
    walls[idx(x, y)] = kind;
  };

  // ---------- ground campus: open grass ----------
  open(R(0, 0, MAP_W, GROUND_H));

  // ---------- buildings ----------
  const buildings: Building[] = [
    { id: 'admin', rect: R(4, 5, 24, 14), level: 'ground', style: 'admin' },
    { id: 'student_block', rect: R(34, 4, 25, 19), level: 'ground', style: 'student' },
    { id: 'student_center', rect: R(50, 36, 19, 17), level: 'ground', style: 'center' },
    { id: 'upstairs', rect: R(22, 84, 26, 21), level: 'upper', style: 'upper' }
  ];
  for (const b of buildings) {
    open(b.rect);
    each(b.rect, (x, y) => {
      const edge = x === b.rect.x || y === b.rect.y || x === b.rect.x + b.rect.w - 1 || y === b.rect.y + b.rect.h - 1;
      if (edge) wall(x, y, 1);
    });
  }

  // Interior partitions.
  const partitions: Rect[] = [
    // Administrative Block: hallway along the south, office + hall to the north.
    R(5, 14, 22, 1),
    R(13, 6, 1, 8),
    // Student Block: staircase room on the east side of the Student Hall.
    R(53, 5, 1, 17),
    // Upstairs: corridor in the middle, classrooms north, library south.
    R(23, 91, 24, 1),
    R(23, 95, 24, 1),
    R(35, 85, 1, 6)
  ];
  for (const p of partitions) each(p, (x, y) => wall(x, y, 2));

  // Doors (carved last so they cut through walls).
  const doors: Door[] = [
    { rect: R(14, 18, 2, 1), kind: 'exterior' }, // Admin Block entrance
    { rect: R(8, 14, 2, 1), kind: 'interior' }, // hallway -> Dept of Agriculture
    { rect: R(19, 14, 2, 1), kind: 'interior' }, // hallway -> Administrative Hall
    { rect: R(40, 22, 2, 1), kind: 'exterior' }, // Student Hall, entrance 1
    { rect: R(47, 22, 2, 1), kind: 'exterior' }, // Student Hall, entrance 2
    { rect: R(53, 18, 1, 2), kind: 'interior' }, // Student Hall -> staircase
    { rect: R(50, 41, 1, 2), kind: 'exterior' }, // Student Center entrance
    { rect: R(28, 91, 2, 1), kind: 'interior' }, // corridor -> Classroom 1
    { rect: R(40, 91, 2, 1), kind: 'interior' }, // corridor -> Classroom 2
    { rect: R(33, 95, 2, 1), kind: 'interior' } // corridor -> Library
  ];
  for (const d of doors) each(d.rect, (x, y) => {
    blocked[idx(x, y)] = 0;
    walls[idx(x, y)] = 0;
  });

  // ---------- open-air huts ----------
  const huts: Hut[] = [];
  const makeHut = (zone: ZoneId, cx: number, cy: number, r: number, pillarR: number, count: number, offsetDeg: number) => {
    const pillars: Vec[] = [];
    for (let k = 0; k < count; k++) {
      const a = ((offsetDeg + (360 / count) * k) * Math.PI) / 180;
      const tx = Math.floor(cx + pillarR * Math.cos(a));
      const ty = Math.floor(cy + pillarR * Math.sin(a));
      blocked[idx(tx, ty)] = 1;
      pillars.push({ x: tx, y: ty });
    }
    huts.push({ zone, cx, cy, r, pillars });
  };
  const PAL = { cx: 36.5, cy: 41.5 };
  const BACK = { cx: 14.5, cy: 43.5 };
  makeHut('palaver_hut', PAL.cx, PAL.cy, 5.2, 4.5, 8, 22.5);
  makeHut('back_palaver', BACK.cx, BACK.cy, 6.7, 6.0, 12, 15);

  // ---------- furniture ----------
  const furniture: Furniture[] = [];
  const add = (kind: FurnitureKind, x: number, y: number, w: number, h: number, blocking = true, facing?: Facing) =>
    furniture.push({ kind, rect: R(x, y, w, h), blocking, facing });

  // Administrative Block
  add('filing', 5, 6, 3, 1);
  add('desk', 7, 8, 2, 1); // Dept of Agriculture desk, visitors sit in front
  add('stacked_chairs', 14, 7, 1, 5, false);
  add('table', 16, 9, 4, 2); // Administrative Hall: chairs pulled down around tables
  add('table', 21, 9, 4, 2);

  // Student Hall: chairs with writing tablets in rows, whiteboard at the front.
  add('whiteboard', 39, 5, 10, 1);
  for (const y of [8, 11, 14, 17]) for (const x of [37, 39, 41, 46, 48, 50]) add('desk', x, y, 1, 1);
  add('stairs', 54, 6, 4, 14, false, 'up');

  // Student Center: relaxed, scattered, louder.
  add('counter', 52, 37, 6, 1);
  for (const [x, y] of [[53, 40], [59, 40], [64, 43], [55, 46], [61, 47]] as const) add('table', x, y, 2, 2);
  for (const [x, y, f] of [
    [57, 44, 'left'], [58, 45, 'down'], [52, 49, 'right'], [66, 38, 'down'],
    [63, 49, 'up'], [67, 47, 'left'], [56, 50, 'up'], [60, 44, 'right']
  ] as const) add('chair', x, y, 1, 1, false, f);

  // Upstairs: two classrooms from the same template, a long corridor, the library.
  add('stairs', 23, 92, 2, 3, false, 'left');
  add('small_table', 30, 92, 2, 1);
  add('bucket', 39, 94, 1, 1, false);
  add('whiteboard', 26, 85, 6, 1);
  for (const y of [87, 89]) for (const x of [24, 26, 31, 33]) add('desk', x, y, 1, 1);
  add('whiteboard', 38, 85, 6, 1);
  for (const y of [87, 89]) for (const x of [37, 39, 44, 46]) add('desk', x, y, 1, 1);
  for (const [x, w] of [[24, 4], [29, 3], [36, 4], [41, 4]] as const) add('shelf', x, 97, w, 1);
  for (const [x, w] of [[24, 4], [29, 4], [34, 4], [39, 4], [44, 2]] as const) add('shelf', x, 103, w, 1);
  for (const x of [24, 29, 36, 41]) add('table', x, 99, 4, 2);

  // Back Palaver: serving stall on the north edge, tables under the roof.
  add('stall', 9, 34, 10, 3);
  for (const [x, y] of [[10, 40], [16, 40], [8, 44], [12, 44], [16, 44]] as const) add('table', x, y, 2, 2);

  // Concrete benches: around the Palaver Hut, and outside the buildings.
  for (const deg of [35, 55, 125, 145, 215, 235, 305, 325]) {
    const a = (deg * Math.PI) / 180;
    const px = PAL.cx + 7.6 * Math.cos(a);
    const py = PAL.cy + 7.6 * Math.sin(a);
    if (Math.abs(Math.cos(a)) > Math.abs(Math.sin(a))) {
      add('bench', Math.round(px - 0.5), Math.round(py - 1.5), 1, 3, false, px < PAL.cx ? 'right' : 'left');
    } else {
      add('bench', Math.round(px - 1.5), Math.round(py - 0.5), 3, 1, false, py < PAL.cy ? 'down' : 'up');
    }
  }
  add('bench', 10, 20, 3, 1, false, 'down');
  add('bench', 17, 20, 3, 1, false, 'down');
  add('bench', 36, 26, 3, 1, false, 'up');
  add('bench', 51, 26, 3, 1, false, 'up');

  // Landmarks that make it feel like a real, still-developing campus.
  add('post', 33, 59, 1, 1); // entrance gate posts
  add('post', 38, 59, 1, 1);
  add('hedge', 40, 54, 12, 1);
  add('car', 44, 52, 4, 2); // blue car behind the hedge
  add('motorcycle', 30, 55, 2, 1);
  add('loader', 61, 55, 5, 3); // yellow front-end loader near the Student Center

  for (const f of furniture) {
    if (!f.blocking) continue;
    each(f.rect, (x, y) => (blocked[idx(x, y)] = 1));
  }

  // ---------- spots (things you can do next to) ----------
  const spots: Spot[] = [
    { id: 'food', kind: 'food', label: 'Buy a plate', price: FOOD_PRICE, rect: R(9, 36, 10, 1) },
    { id: 'music', kind: 'music', label: 'Play music', price: MUSIC_PRICE, rect: R(52, 37, 6, 1) },
    { id: 'moto', kind: 'moto', label: 'Ride the moto', price: MOTO_PRICE, rect: R(30, 55, 2, 1) },
    { id: 'work_library', kind: 'work', label: 'Shelve books', price: 0, rect: R(24, 97, 21, 1) },
    { id: 'work_admin', kind: 'work', label: 'Stack chairs', price: 0, rect: R(14, 7, 1, 5) }
  ];

  // ---------- zones ----------
  const zones: Zone[] = [
    { id: 'agri_office', name: 'Dept of Agriculture', rect: R(5, 6, 8, 8), gather: { x: 10, y: 11 }, level: 'ground' },
    { id: 'admin_hall', name: 'Administrative Hall', rect: R(14, 6, 13, 8), gather: { x: 20, y: 7 }, level: 'ground' },
    { id: 'admin_hallway', name: 'Admin Hallway', rect: R(5, 14, 22, 4), gather: { x: 20, y: 16 }, level: 'ground' },
    { id: 'student_hall', name: 'Student Hall', rect: R(35, 5, 18, 17), gather: { x: 43, y: 20 }, level: 'ground' },
    { id: 'staircase', name: 'Staircase', rect: R(54, 5, 4, 17), gather: { x: 55, y: 12 }, level: 'ground' },
    { id: 'student_center', name: 'Student Center', rect: R(51, 37, 17, 15), gather: { x: 58, y: 43 }, level: 'ground' },
    { id: 'classroom_a', name: 'Classroom 1', rect: R(23, 85, 12, 6), gather: { x: 29, y: 86 }, level: 'upper' },
    { id: 'classroom_b', name: 'Classroom 2', rect: R(36, 85, 11, 6), gather: { x: 41, y: 86 }, level: 'upper' },
    { id: 'upstairs_corridor', name: 'Upstairs Corridor', rect: R(23, 92, 24, 3), gather: { x: 28, y: 93 }, level: 'upper' },
    { id: 'library', name: 'Library', rect: R(23, 96, 24, 8), gather: { x: 33, y: 97 }, level: 'upper' },
    { id: 'palaver_hut', name: 'Palaver Hut', rect: R(27, 32, 19, 19), circle: { cx: PAL.cx, cy: PAL.cy, r: 9 }, gather: { x: 36, y: 41 }, level: 'ground' },
    { id: 'back_palaver', name: 'Back Palaver', rect: R(6, 34, 17, 19), circle: { cx: BACK.cx, cy: BACK.cy, r: 8 }, gather: { x: 14, y: 41 }, level: 'ground' }
  ];
  const zoneOfTile = (tx: number, ty: number): ZoneId | null => zones.find((z) => inZone(z, tx, ty))?.id ?? null;

  // ---------- seats (derived from furniture so they always match what is drawn) ----------
  const seats: Seat[] = [];
  const seatTiles = new Set<string>();
  const addSeat = (tx: number, ty: number, facing: Facing) => {
    const key = `${tx},${ty}`;
    if (!inBounds(tx, ty) || seatTiles.has(key) || blocked[idx(tx, ty)]) return;
    seatTiles.add(key);
    seats.push({ id: `s${seats.length}`, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, facing, zone: zoneOfTile(tx, ty) });
  };
  for (const f of furniture) {
    const { x, y, w, h } = f.rect;
    if (f.kind === 'bench') {
      for (let i = 0; i < Math.max(w, h); i++) addSeat(w >= h ? x + i : x, w >= h ? y : y + i, f.facing ?? 'down');
    } else if (f.kind === 'chair') {
      addSeat(x, y, f.facing ?? 'down');
    } else if (f.kind === 'desk') {
      for (let i = 0; i < w; i++) addSeat(x + i, y + 1, 'up');
    } else if (f.kind === 'table') {
      for (let i = 0; i < w; i++) {
        addSeat(x + i, y - 1, 'down');
        addSeat(x + i, y + h, 'up');
      }
    }
  }

  // ---------- staircases ----------
  const portals: Portal[] = [
    { from: { x: 54, y: 6 }, to: { x: 25, y: 92 } },
    { from: { x: 55, y: 6 }, to: { x: 25, y: 93 } },
    { from: { x: 56, y: 6 }, to: { x: 25, y: 93 } },
    { from: { x: 57, y: 6 }, to: { x: 25, y: 94 } },
    { from: { x: 23, y: 92 }, to: { x: 55, y: 7 } },
    { from: { x: 23, y: 93 }, to: { x: 55, y: 7 } },
    { from: { x: 23, y: 94 }, to: { x: 56, y: 7 } }
  ];
  const portalIndex = new Map<number, number>();
  for (const p of portals) portalIndex.set(idx(p.from.x, p.from.y), idx(p.to.x, p.to.y));

  // ---------- outdoors ----------
  const paths: Rect[] = [
    R(34, 23, 4, 41), // main laterite road from the entrance to the Student Block
    R(36, 23, 17, 3), // apron in front of the Student Hall doors
    R(6, 30, 60, 3), // cross road
    R(13, 19, 4, 12), // Admin Block door -> cross road
    R(42, 40, 8, 4), // Palaver Hut -> Student Center
    R(20, 40, 14, 4) // Back Palaver -> Palaver Hut
  ];
  const spawn = R(34, 60, 4, 3);

  const signs: Sign[] = [
    { text: 'Administrative Block', x: 16, y: 4.3, kind: 'label' },
    { text: 'Student Block', x: 46.5, y: 3.3, kind: 'label' },
    { text: 'Student Center', x: 59.5, y: 35.3, kind: 'label' },
    { text: 'Palaver Hut', x: PAL.cx, y: 34.2, kind: 'label' },
    { text: 'Back Palaver', x: BACK.cx, y: 33.2, kind: 'label' },
    { text: 'Student Block (upstairs)', x: 35, y: 83.2, kind: 'label' },
    { text: 'WELCOME  /  BCC  /  ENTRANCE', x: 36, y: 58.2, kind: 'banner' },
    { text: 'DEPT OF AGRICULTURE', x: 9, y: 14.5, kind: 'plaque' },
    { text: 'ADMIN HALL', x: 20, y: 14.5, kind: 'plaque' },
    { text: 'CLASSROOM 1', x: 29, y: 91.5, kind: 'plaque' },
    { text: 'CLASSROOM 2', x: 41, y: 91.5, kind: 'plaque' },
    { text: 'LIBRARY', x: 34, y: 95.5, kind: 'plaque' }
  ];

  // Trees: a border ring (with a gap at the gate) plus seeded scatter that stays off paths and buildings.
  const rng = mulberry32(2026);
  const reserved: Rect[] = [
    ...buildings.filter((b) => b.level === 'ground').map((b) => grow(b.rect, 2)),
    ...paths,
    ...huts.map((h) => R(Math.floor(h.cx - 10), Math.floor(h.cy - 10), 20, 20)),
    R(26, 50, 22, 14),
    R(58, 52, 12, 8),
    grow(spawn, 2)
  ];
  const trees: Array<Vec & { kind: TreeKind }> = [];
  const plant = (x: number, y: number) => {
    blocked[idx(x, y)] = 1;
    trees.push({ x, y, kind: rng() < 0.6 ? 'palm' : 'tree' });
  };
  for (let y = 0; y < GROUND_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const border = x === 0 || y === 0 || x === MAP_W - 1 || y === GROUND_H - 1;
      if (border) {
        if (y === GROUND_H - 1 && x >= 34 && x <= 37) continue; // the gate
        plant(x, y);
        continue;
      }
      if (blocked[idx(x, y)]) continue;
      if (reserved.some((r) => inRect(r, x, y))) continue;
      if (rng() < 0.055) plant(x, y);
    }
  }

  const puddles: Vec[] = [];
  for (let i = 0; i < 40 && puddles.length < 9; i++) {
    const p = paths[Math.floor(rng() * paths.length)];
    const x = p.x + Math.floor(rng() * p.w);
    const y = p.y + Math.floor(rng() * p.h);
    if (!blocked[idx(x, y)]) puddles.push({ x, y });
  }

  return {
    width: MAP_W,
    height: MAP_H,
    tile: TILE,
    blocked,
    walls,
    zones,
    buildings,
    doors,
    furniture,
    huts,
    signs,
    trees,
    paths,
    puddles,
    portals,
    portalIndex,
    spawn,
    seats,
    foodCounter: R(9, 36, 10, 1),
    spots
  };
}

export const CAMPUS_MAP: CampusMap = buildCampusMap();

// ---------- queries ----------

export function isBlockedTile(map: CampusMap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
  return map.blocked[ty * map.width + tx] === 1;
}

/** Can a player's feet stand here? Small footprint (16px wide, 8px deep) so you can't visibly clip into walls. */
export function canStand(map: CampusMap, px: number, py: number): boolean {
  const T = map.tile;
  for (const [ox, oy] of [[-8, -4], [8, -4], [-8, 4], [8, 4]] as const) {
    if (isBlockedTile(map, Math.floor((px + ox) / T), Math.floor((py + oy) / T))) return false;
  }
  return true;
}

/** Which zone is this pixel position in? (null = outdoors / campus grounds). */
export function zoneAt(map: CampusMap, px: number, py: number): Zone | null {
  const tx = Math.floor(px / map.tile);
  const ty = Math.floor(py / map.tile);
  return map.zones.find((z) => inZone(z, tx, ty)) ?? null;
}

export function levelAt(py: number): Level {
  return levelOfRow(Math.floor(py / TILE));
}

/** The staircase destination if this tile is a staircase, else null. */
export function portalAt(map: CampusMap, px: number, py: number): Vec | null {
  const tx = Math.floor(px / map.tile);
  const ty = Math.floor(py / map.tile);
  const dest = map.portalIndex.get(ty * map.width + tx);
  if (dest === undefined) return null;
  return { x: ((dest % map.width) + 0.5) * map.tile, y: (Math.floor(dest / map.width) + 0.5) * map.tile };
}

/** A random walkable pixel position at the entrance gate. */
export function randomSpawn(map: CampusMap, rnd: () => number = Math.random): Vec {
  for (let i = 0; i < 30; i++) {
    const tx = map.spawn.x + Math.floor(rnd() * map.spawn.w);
    const ty = map.spawn.y + Math.floor(rnd() * map.spawn.h);
    if (!isBlockedTile(map, tx, ty)) return { x: (tx + 0.5) * map.tile, y: (ty + 0.5) * map.tile };
  }
  return { x: (map.spawn.x + 1.5) * map.tile, y: (map.spawn.y + 1.5) * map.tile };
}

/** Pixel centre of a zone's gather point, with optional jitter so a crowd doesn't stack. */
export function zoneGather(map: CampusMap, id: ZoneId, jitter = 0, rnd: () => number = Math.random): Vec {
  const z = map.zones.find((zz) => zz.id === id)!;
  const T = map.tile;
  for (let i = 0; i < 8; i++) {
    const x = (z.gather.x + 0.5) * T + (rnd() - 0.5) * 2 * jitter;
    const y = (z.gather.y + 0.5) * T + (rnd() - 0.5) * 2 * jitter;
    if (canStand(map, x, y)) return { x, y };
  }
  return { x: (z.gather.x + 0.5) * T, y: (z.gather.y + 0.5) * T };
}

/** Distance in px from a point to a tile rectangle (0 when inside). */
export function distToRect(map: CampusMap, r: Rect, px: number, py: number): number {
  const T = map.tile;
  const dx = Math.max(r.x * T - px, 0, px - (r.x + r.w) * T);
  const dy = Math.max(r.y * T - py, 0, py - (r.y + r.h) * T);
  return Math.hypot(dx, dy);
}

export function isIndoor(zone: ZoneId | null | undefined): boolean {
  return !!zone && INDOOR_ZONES.includes(zone);
}

/** The nearest spot you are close enough to use, on your own floor. */
export function nearestSpot(map: CampusMap, px: number, py: number, reach = 56): Spot | null {
  const level = levelAt(py);
  let best: Spot | null = null;
  let bd = reach;
  for (const s of map.spots) {
    if (levelOfRow(s.rect.y) !== level) continue;
    const d = distToRect(map, s.rect, px, py);
    if (d <= bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}
