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
export const GROUND_H = 78;
export const UPPER_Y0 = 84;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;

import { FOOD_PRICE, MOTO_PRICE, MUSIC_PRICE } from './constants';
import { CAROUSEL_PRICE } from './games';

export type Facing = 'up' | 'down' | 'left' | 'right';
export type Level = 'ground' | 'upper';

export type ZoneId =
  | 'admin_hall'
  | 'admin_hallway'
  | 'student_hall'
  | 'staircase'
  | 'student_center'
  | 'upstairs_hallway'
  | 'college_cj'
  | 'college_nursing'
  | 'college_business'
  | 'college_agri'
  | 'college_education'
  | 'library'
  | 'palaver_hut'
  | 'back_palaver'
  | 'marketplace'
  | 'recreation'
  | 'social_ground'
  | 'lecture_area'
  | 'sprint_track';

export const ZONE_IDS: readonly ZoneId[] = [
  'admin_hall',
  'admin_hallway',
  'student_hall',
  'staircase',
  'student_center',
  'upstairs_hallway',
  'college_cj',
  'college_nursing',
  'college_business',
  'college_agri',
  'college_education',
  'library',
  'palaver_hut',
  'back_palaver',
  'marketplace',
  'recreation',
  'social_ground',
  'lecture_area',
  'sprint_track'
];
/** Enclosed rooms. Voices get muffled between indoors and outdoors (the huts are open-air). */
export const INDOOR_ZONES: readonly ZoneId[] = [
  'admin_hall',
  'admin_hallway',
  'student_hall',
  'staircase',
  'student_center',
  'upstairs_hallway',
  'college_cj',
  'college_nursing',
  'college_business',
  'college_agri',
  'college_education',
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
  | 'post'
  | 'stage'
  | 'dj_booth'
  | 'speaker'
  | 'dance_floor'
  | 'rope_post'
  | 'goal'
  | 'noticeboard'
  | 'jobskiosk'
  | 'lectern'
  | 'carousel'
  | 'track';
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
  /** Plaques: which way the sign faces (default: towards whichever side is open). */
  face?: 'north' | 'south';
  /** Plaques: width in metres (default 1.3). */
  w?: number;
}
export interface Portal {
  from: Vec;
  to: Vec;
}
export type TreeKind = 'palm' | 'tree';
export type NpcRole = 'security' | 'instructor' | 'administrator' | 'dj' | 'dancer' | 'singer' | 'vendor' | 'reveler' | 'clerk';
/** A non-player person who stands somewhere on campus. Scenery for now; real behaviour comes with later phases. */
export interface Npc {
  id: string;
  role: NpcRole;
  label: string;
  /** tile coordinates (may be fractional) */
  x: number;
  y: number;
  facing: Facing;
  level: Level;
  skin: number;
  shirt: number;
  hair: number;
  gender: 0 | 1;
  /** Standing height in metres (dancers stand on the stage). */
  elev?: number;
}
/** The Student Center's show area, for the event systems to use later. */
export interface Venue {
  stage: Rect;
  danceFloor: Rect;
  dj: Vec;
  door: Rect;
}
export type SpotKind = 'food' | 'music' | 'moto' | 'work' | 'jobs' | 'market' | 'lectern' | 'study' | 'race' | 'carousel' | 'instructor' | 'games';
/** Something you can do while standing next to it (buy food, play music, ride, work). */
export interface Spot {
  id: string;
  kind: SpotKind;
  label: string;
  price: number;
  rect: Rect;
}

/** The Recreation Ground: a small football pitch with a shared ball. */
export interface Recreation {
  /** Playing area (tiles). Goals are one tile deep, outside the left and right ends. */
  pitch: Rect;
  /** Rows (tiles, half open) that count as the goal mouth. */
  goalY0: number;
  goalY1: number;
  /** Where the ball starts and restarts (tiles). */
  start: Vec;
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
  npcs: Npc[];
  venue: Venue;
  rec: Recreation;
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
    { id: 'admin', rect: R(7, 46, 24, 14), level: 'ground', style: 'admin' },
    { id: 'student_block', rect: R(30, 24, 25, 19), level: 'ground', style: 'student' },
    { id: 'student_center', rect: R(41, 3, 19, 17), level: 'ground', style: 'center' },
    { id: 'upstairs', rect: R(22, 84, 26, 23), level: 'upper', style: 'upper' }
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
    // Administrative Block: hallway along the south, one big hall to the north.
    R(8, 55, 22, 1),
    // Student Block: staircase room on the east side of the Student Hall.
    R(49, 25, 1, 17),
    // Upstairs: a hallway (rows 95-98) with three rooms north and three south.
    // North: Criminal Justice | Nursing & Midwifery | Business & Public Admin.
    // South (opposite): Library | Agriculture | Education.
    R(23, 94, 24, 1),
    R(23, 99, 24, 1),
    R(30, 85, 1, 9),
    R(38, 85, 1, 9),
    R(33, 100, 1, 6),
    R(40, 100, 1, 6)
  ];
  for (const p of partitions) each(p, (x, y) => wall(x, y, 2));

  // Doors (carved last so they cut through walls).
  const doors: Door[] = [
    { rect: R(17, 59, 2, 1), kind: 'exterior' }, // Admin Block entrance
    { rect: R(22, 55, 2, 1), kind: 'interior' }, // hallway -> Administrative Hall
    { rect: R(36, 42, 2, 1), kind: 'exterior' }, // Student Hall, entrance 1 (the main road leads straight to it)
    { rect: R(43, 42, 2, 1), kind: 'exterior' }, // Student Hall, entrance 2
    { rect: R(49, 38, 1, 2), kind: 'interior' }, // Student Hall -> staircase
    { rect: R(41, 8, 1, 2), kind: 'exterior' }, // Student Center entrance (west wall, facing the Back Palaver road)
    { rect: R(26, 94, 2, 1), kind: 'interior' }, // hallway -> College of Criminal Justice
    { rect: R(34, 94, 2, 1), kind: 'interior' }, // hallway -> College of Nursing and Midwifery
    { rect: R(42, 94, 2, 1), kind: 'interior' }, // hallway -> College of Business and Public Administration
    { rect: R(27, 99, 2, 1), kind: 'interior' }, // hallway -> Library
    { rect: R(36, 99, 2, 1), kind: 'interior' }, // hallway -> College of Agriculture
    { rect: R(43, 99, 2, 1), kind: 'interior' } // hallway -> College of Education
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
  const PAL = { cx: 45.5, cy: 61.5 };
  const BACK = { cx: 26.5, cy: 11.5 };
  makeHut('palaver_hut', PAL.cx, PAL.cy, 5.2, 4.5, 8, 22.5);
  makeHut('back_palaver', BACK.cx, BACK.cy, 6.7, 6.0, 12, 15);

  // ---------- furniture ----------
  const furniture: Furniture[] = [];
  const add = (kind: FurnitureKind, x: number, y: number, w: number, h: number, blocking = true, facing?: Facing) =>
    furniture.push({ kind, rect: R(x, y, w, h), blocking, facing });

  // Administrative Block: one hall with a reception counter (the administrator stands behind it) and meeting tables.
  add('counter', 16, 48, 6, 1);
  add('stacked_chairs', 9, 48, 1, 5, false);
  for (const x of [12, 18, 24]) add('table', x, 51, 4, 2);

  // Student Hall: chairs with writing tablets in rows, whiteboard at the front.
  add('whiteboard', 35, 25, 10, 1);
  for (const y of [28, 31, 34, 37]) for (const x of [33, 35, 37, 42, 44, 46]) add('desk', x, y, 1, 1);
  add('stairs', 50, 26, 4, 14, false, 'up');

  // Student Center (behind the Student Block). Everyday: food, seats, chat. Event night: stage, DJ, dance floor.
  // Layout (interior x 42..58, y 4..18): door on the west wall, guard post just inside, a dance floor in the
  // middle, the stage and DJ booth against the east wall, seating along the south and west.
  add('counter', 43, 4, 6, 1); // snack counter (the jukebox until the DJ takes over in Phase C)
  add('small_table', 42, 5, 2, 1); // guard's table and cash box
  add('rope_post', 44, 7, 1, 1, false);
  add('rope_post', 44, 10, 1, 1, false);
  add('dance_floor', 45, 6, 8, 8, false);
  add('stage', 55, 4, 4, 8); // raised 0.6 m; only performers use it (Phase D)
  add('speaker', 54, 4, 1, 2);
  add('speaker', 54, 10, 1, 2);
  add('dj_booth', 53, 6, 1, 4);
  for (const [x, y] of [[45, 15], [49, 15]] as const) add('table', x, y, 2, 2);
  add('bench', 53, 17, 4, 1, false, 'up');
  add('bench', 42, 11, 1, 4, false, 'right');
  for (const [x, y, f] of [
    [43, 16, 'right'], [43, 18, 'right'], [54, 15, 'up'], [57, 15, 'left'], [57, 18, 'up'], [52, 15, 'up']
  ] as const) add('chair', x, y, 1, 1, false, f);

  // Student Hall: the jobs board on the west wall, where students pick up small paid errands.
  add('noticeboard', 31, 29, 1, 5, false, 'right');

  // Marketplace (west of the Student Block): a long stall and a road in front of it.
  add('stall', 6, 36, 10, 3);
  // The Campus Jobs Board (blueprint section 9): a roofed kiosk beside the stall where students post and claim paid jobs.
  add('jobskiosk', 19, 36, 9, 3);
  add('bench', 19, 41, 4, 1, false, 'up');
  add('bench', 24, 41, 4, 1, false, 'up');

  // Lecture and Presentation Area (blueprint section 14): a lectern, a board behind it and benches facing it.
  add('whiteboard', 62, 6, 6, 1);
  add('lectern', 64, 8, 2, 1);
  for (const y of [11, 13, 15, 17]) { add('bench', 61, y, 3, 1, false, 'up'); add('bench', 66, y, 3, 1, false, 'up'); }

  // Recreation Ground: goals at both ends of a small football pitch.
  add('track', 3, 14, 15, 6, false);
  add('carousel', 8, 9, 4, 4, false);
  add('goal', 3, 25, 1, 5, false, 'right');
  add('goal', 24, 25, 1, 5, false, 'left');

  // Social Ground (east of the coconut palms): benches around a big shade tree.
  add('bench', 61, 35, 1, 5, false, 'right');
  add('bench', 69, 35, 1, 5, false, 'left');
  add('bench', 63, 31, 5, 1, false, 'down');
  add('bench', 63, 44, 5, 1, false, 'up');
  add('table', 63, 40, 3, 2);

  // Upstairs hallway: stairs arrive at the west end; benches and a bucket make it a place to wait and talk.
  add('stairs', 23, 95, 2, 4, false, 'left');
  add('small_table', 31, 96, 2, 1);
  add('bucket', 45, 97, 1, 1, false);
  add('bench', 28, 98, 4, 1, false, 'up');
  add('bench', 36, 95, 4, 1, false, 'down');

  // North classrooms: board on the north wall, desks facing it, a teacher's table up front.
  const classNorth = (boardX: number, boardW: number, leftX: number, rightX: number, tableX: number) => {
    add('whiteboard', boardX, 85, boardW, 1);
    add('small_table', tableX, 86, 2, 1);
    for (const y of [88, 90, 92]) for (const x of [leftX, leftX + 1, rightX, rightX + 1]) add('desk', x, y, 1, 1);
  };
  classNorth(24, 5, 24, 28, 28); // Criminal Justice  (x23-29)
  classNorth(32, 5, 32, 36, 36); // Nursing and Midwifery (x31-37)
  classNorth(40, 6, 40, 44, 44); // Business and Public Administration (x39-46)

  // South classrooms: board on the south wall, desks turned to face it.
  const classSouth = (boardX: number, boardW: number, leftX: number, rightX: number, tableX: number) => {
    add('whiteboard', boardX, 105, boardW, 1, true, 'up');
    add('small_table', tableX, 104, 2, 1);
    for (const y of [101, 103]) for (const x of [leftX, leftX + 1, rightX, rightX + 1]) add('desk', x, y, 1, 1, true, 'down');
  };
  classSouth(35, 4, 34, 38, 34); // Agriculture (x34-39)
  classSouth(42, 4, 41, 45, 45); // Education (x41-46)

  // Library: shelves on both long walls, two reading tables, a quiet corner.
  for (const [x, w] of [[23, 4], [29, 4]] as const) add('shelf', x, 100, w, 1);
  for (const [x, w] of [[23, 5], [29, 4]] as const) add('shelf', x, 105, w, 1);
  add('table', 24, 102, 4, 2);
  add('table', 29, 102, 4, 2);

  // Back Palaver (behind the Student Block): serving stall on the north edge, tables under the roof.
  add('stall', 21, 2, 10, 3);
  for (const [x, y] of [[22, 8], [28, 8], [20, 12], [24, 12], [28, 12]] as const) add('table', x, y, 2, 2);

  // Concrete benches: around the Palaver Hut, and outside the buildings.
  for (const deg of [35, 55, 125, 145, 215, 235, 305, 325]) {
    const a = (deg * Math.PI) / 180;
    const px = PAL.cx + 7 * Math.cos(a);
    const py = PAL.cy + 7 * Math.sin(a);
    if (Math.abs(Math.cos(a)) > Math.abs(Math.sin(a))) {
      add('bench', Math.round(px - 0.5), Math.round(py - 1.5), 1, 3, false, px < PAL.cx ? 'right' : 'left');
    } else {
      add('bench', Math.round(px - 1.5), Math.round(py - 0.5), 3, 1, false, py < PAL.cy ? 'down' : 'up');
    }
  }
  // Benches between the Palaver Hut and the coconut trees, and outside the buildings.
  add('bench', 53, 56, 1, 3, false, 'right');
  add('bench', 53, 63, 1, 3, false, 'right');
  add('bench', 10, 60, 3, 1, false, 'down');
  add('bench', 13, 60, 3, 1, false, 'down');
  add('bench', 39, 46, 3, 1, false, 'up');
  add('bench', 48, 46, 3, 1, false, 'up');

  // The BCC entrance gate: posts, a security booth and a barrier hedge; a blue car and a motorbike nearby.
  add('post', 33, 73, 1, 1);
  add('post', 38, 73, 1, 1);
  add('counter', 28, 72, 3, 1); // security booth desk
  add('hedge', 44, 72, 10, 1);
  add('car', 45, 74, 4, 2); // blue car behind the hedge
  add('motorcycle', 29, 74, 2, 1);
  add('loader', 61, 12, 5, 3); // yellow front-end loader behind the Student Center

  for (const f of furniture) {
    if (!f.blocking) continue;
    each(f.rect, (x, y) => (blocked[idx(x, y)] = 1));
  }

  // ---------- spots (things you can do next to) ----------
  const spots: Spot[] = [
    { id: 'food', kind: 'food', label: 'Buy a plate', price: FOOD_PRICE, rect: R(21, 5, 10, 1) },
    { id: 'music', kind: 'music', label: 'Play music', price: MUSIC_PRICE, rect: R(43, 4, 6, 1) },
    { id: 'moto', kind: 'moto', label: 'Ride the moto', price: MOTO_PRICE, rect: R(29, 74, 2, 1) },
    { id: 'work_library', kind: 'work', label: 'Shelve books', price: 0, rect: R(23, 101, 5, 1) },
    { id: 'read_library', kind: 'study', label: 'Read a book', price: 0, rect: R(28, 101, 5, 1) },
    { id: 'study_library', kind: 'study', label: 'Study at the tables', price: 0, rect: R(24, 104, 9, 1) },
    { id: 'work_admin', kind: 'work', label: 'Stack chairs', price: 0, rect: R(9, 48, 1, 5) },
    { id: 'jobs', kind: 'jobs', label: 'Jobs board', price: 0, rect: R(31, 29, 1, 5) },
    { id: 'market', kind: 'market', label: 'Market stall', price: 0, rect: R(6, 39, 10, 1) },
    { id: 'jobs_market', kind: 'jobs', label: 'Campus Jobs Board', price: 0, rect: R(19, 39, 9, 1) },
    { id: 'race_start', kind: 'race', label: 'Join the sprint race', price: 0, rect: R(3, 15, 2, 5) },
    { id: 'games_desk', kind: 'games', label: 'Games desk', price: 0, rect: R(12, 20, 5, 2) },
    { id: 'carousel', kind: 'carousel', label: 'Ride the carousel', price: CAROUSEL_PRICE, rect: R(8, 9, 4, 4) },
    { id: 'lectern', kind: 'lectern', label: 'Give a talk', price: 0, rect: R(64, 9, 2, 1) }
  ];

  // ---------- zones ----------
  const zones: Zone[] = [
    { id: 'admin_hall', name: 'Administrative Hall', rect: R(8, 47, 22, 8), gather: { x: 20, y: 54 }, level: 'ground' },
    { id: 'admin_hallway', name: 'Admin Hallway', rect: R(8, 55, 22, 4), gather: { x: 20, y: 57 }, level: 'ground' },
    { id: 'student_hall', name: 'Student Hall', rect: R(31, 25, 18, 17), gather: { x: 39, y: 40 }, level: 'ground' },
    { id: 'staircase', name: 'Staircase', rect: R(50, 25, 4, 17), gather: { x: 51, y: 32 }, level: 'ground' },
    { id: 'student_center', name: 'Student Center', rect: R(42, 4, 17, 15), gather: { x: 49, y: 10 }, level: 'ground' },
    { id: 'college_cj', name: 'College of Criminal Justice', rect: R(23, 85, 7, 9), gather: { x: 26, y: 87 }, level: 'upper' },
    { id: 'college_nursing', name: 'College of Nursing and Midwifery', rect: R(31, 85, 7, 9), gather: { x: 34, y: 87 }, level: 'upper' },
    { id: 'college_business', name: 'College of Business and Public Administration', rect: R(39, 85, 8, 9), gather: { x: 42, y: 87 }, level: 'upper' },
    { id: 'upstairs_hallway', name: 'Upstairs Hallway', rect: R(23, 95, 24, 4), gather: { x: 35, y: 96 }, level: 'upper' },
    { id: 'library', name: 'Library', rect: R(23, 100, 10, 6), gather: { x: 28, y: 101 }, level: 'upper' },
    { id: 'college_agri', name: 'College of Agriculture', rect: R(34, 100, 6, 6), gather: { x: 37, y: 101 }, level: 'upper' },
    { id: 'college_education', name: 'College of Education', rect: R(41, 100, 6, 6), gather: { x: 44, y: 101 }, level: 'upper' },
    { id: 'palaver_hut', name: 'Palaver Hut', rect: R(36, 52, 19, 19), circle: { cx: PAL.cx, cy: PAL.cy, r: 9 }, gather: { x: 45, y: 61 }, level: 'ground' },
    { id: 'marketplace', name: 'Marketplace and Jobs Board', rect: R(3, 34, 27, 10), gather: { x: 22, y: 40 }, level: 'ground' },
    { id: 'sprint_track', name: 'Sprint Track', rect: R(3, 13, 16, 8), gather: { x: 6, y: 17 }, level: 'ground' },
    { id: 'lecture_area', name: 'Lecture Area', rect: R(60, 6, 10, 13), gather: { x: 67, y: 15 }, level: 'ground' },
    { id: 'recreation', name: 'Recreation Ground', rect: R(3, 21, 22, 13), gather: { x: 14, y: 27 }, level: 'ground' },
    { id: 'social_ground', name: 'Social Ground', rect: R(61, 28, 9, 22), gather: { x: 65, y: 38 }, level: 'ground' },
    { id: 'back_palaver', name: 'Back Palaver', rect: R(18, 2, 17, 18), circle: { cx: BACK.cx, cy: BACK.cy, r: 8 }, gather: { x: 26, y: 11 }, level: 'ground' }
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
      for (let i = 0; i < w; i++) {
        if (f.facing === 'down') addSeat(x + i, y - 1, 'down');
        else addSeat(x + i, y + 1, 'up');
      }
    } else if (f.kind === 'table') {
      for (let i = 0; i < w; i++) {
        addSeat(x + i, y - 1, 'down');
        addSeat(x + i, y + h, 'up');
      }
    }
  }

  // ---------- staircases ----------
  const portals: Portal[] = [
    { from: { x: 50, y: 26 }, to: { x: 25, y: 95 } },
    { from: { x: 51, y: 26 }, to: { x: 25, y: 96 } },
    { from: { x: 52, y: 26 }, to: { x: 25, y: 97 } },
    { from: { x: 53, y: 26 }, to: { x: 25, y: 98 } },
    { from: { x: 23, y: 95 }, to: { x: 51, y: 27 } },
    { from: { x: 23, y: 96 }, to: { x: 51, y: 27 } },
    { from: { x: 23, y: 97 }, to: { x: 52, y: 27 } },
    { from: { x: 23, y: 98 }, to: { x: 52, y: 27 } }
  ];
  const portalIndex = new Map<number, number>();
  for (const p of portals) portalIndex.set(idx(p.from.x, p.from.y), idx(p.to.x, p.to.y));

  // ---------- outdoors ----------
  const paths: Rect[] = [
    R(34, 43, 4, 35), // main entrance road: from the gate straight to the Student Hall doors
    R(32, 43, 17, 3), // apron in front of the Student Hall doors
    R(17, 60, 17, 3), // Admin Block door -> main road
    R(34, 69, 26, 3), // cross road: main road -> the side road
    R(57, 21, 3, 50), // the side road, beyond the coconut trees, heading straight up the campus
    R(26, 21, 34, 3), // back road behind the Student Block
    R(25, 18, 3, 4), // back road -> Back Palaver
    R(33, 7, 9, 3), // Back Palaver -> Student Center
    R(5, 43, 27, 3), // market road: from the Student Hall apron west to the Marketplace
    R(60, 37, 2, 3), // side road -> Social Ground
    R(60, 19, 6, 3) // side road -> Lecture Area
  ];
  const spawn = R(34, 74, 4, 3);

  const signs: Sign[] = [
    { text: 'Administrative Block', x: 19, y: 45.3, kind: 'label' },
    { text: 'Student Block', x: 42.5, y: 23.3, kind: 'label' },
    { text: 'Student Center', x: 50.5, y: 2.3, kind: 'label' },
    { text: 'Palaver Hut', x: PAL.cx, y: PAL.cy - 7.3, kind: 'label' },
    { text: 'Back Palaver', x: BACK.cx, y: 1.2, kind: 'label' },
    { text: 'Student Block (upstairs)', x: 35, y: 83.2, kind: 'label' },
    { text: 'WELCOME  /  BCC  /  ENTRANCE', x: 36, y: 72.2, kind: 'banner' },
    { text: 'SECURITY', x: 29.5, y: 71.5, kind: 'label' },
    { text: 'Marketplace', x: 11, y: 34.6, kind: 'label' },
    { text: 'Lecture Area', x: 65, y: 5.3, kind: 'label' },
    { text: 'Recreation Ground', x: 14, y: 20.6, kind: 'label' },
    { text: 'Social Ground', x: 65, y: 27.3, kind: 'label' },
    { text: 'ADMIN HALL', x: 23, y: 55.5, kind: 'plaque' },
    { text: 'COLLEGE OF\nCRIMINAL JUSTICE', x: 28.9, y: 94.5, kind: 'plaque', face: 'south', w: 1.9 },
    { text: 'COLLEGE OF NURSING\nAND MIDWIFERY', x: 36.9, y: 94.5, kind: 'plaque', face: 'south', w: 1.9 },
    { text: 'COLLEGE OF BUSINESS AND\nPUBLIC ADMINISTRATION', x: 45, y: 94.5, kind: 'plaque', face: 'south', w: 1.9 },
    { text: 'LIBRARY', x: 25, y: 99.5, kind: 'plaque', face: 'north', w: 1.5 },
    { text: 'COLLEGE OF\nAGRICULTURE', x: 34.7, y: 99.5, kind: 'plaque', face: 'north', w: 1.9 },
    { text: 'COLLEGE OF\nEDUCATION', x: 41.7, y: 99.5, kind: 'plaque', face: 'north', w: 1.9 }
  ];

  // Trees: the campus is clean and open. The only trees are coconut palms in ONE straight line, standing
  // between the Palaver Hut and the side road. The map edge is blocked too, drawn as a low perimeter wall.
  const rng = mulberry32(2026);
  const trees: Array<Vec & { kind: TreeKind }> = [];
  for (let y = 0; y < GROUND_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const border = x === 0 || y === 0 || x === MAP_W - 1 || y === GROUND_H - 1;
      if (border && !(y === GROUND_H - 1 && x >= 34 && x <= 37)) blocked[idx(x, y)] = 1; // the gate stays open
    }
  }
  const palm = (x: number, y: number) => {
    if (!inBounds(x, y) || blocked[idx(x, y)]) return;
    if (paths.some((r) => inRect(r, x, y))) return; // never block a road
    blocked[idx(x, y)] = 1;
    trees.push({ x, y, kind: 'palm' });
  };
  for (let y = 46; y <= 76; y += 3) palm(55, y);
  // One big shade tree in the middle of the Social Ground.
  if (!blocked[idx(65, 37)]) {
    blocked[idx(65, 37)] = 1;
    trees.push({ x: 65, y: 37, kind: 'tree' });
  }

  // ---------- people who stand around (scenery now; behaviour in later phases) ----------
  const npcs: Npc[] = [];
  const npc = (role: NpcRole, label: string, x: number, y: number, facing: Facing, look: [number, number, number, 0 | 1]) =>
    npcs.push({ id: `npc${npcs.length}`, role, label, x, y, facing, level: levelOfRow(Math.floor(y)), skin: look[0], shirt: look[1], hair: look[2], gender: look[3] });
  npc('security', 'Security', 32.5, 73.6, 'down', [3, 9, 0, 0]);
  npc('security', 'Security', 38.5, 73.6, 'down', [4, 9, 0, 0]);
  npc('administrator', 'Administrator', 19, 47.6, 'down', [2, 5, 0, 1]);
  let k = 0;
  for (const f of furniture) {
    if (f.kind !== 'whiteboard' || f.rect.x >= 60) continue; // (the Lecture Area whiteboard has no staff instructor)
    const r = f.rect;
    const south = f.facing === 'up';
    const hall = r.y < 30;
    const x = hall ? r.x + r.w / 2 : south ? r.x + r.w - 1.2 : r.x + 1.2;
    const y = hall ? r.y + 2.2 : south ? r.y - 0.9 : r.y + 1.9;
    npc('instructor', 'Instructor', x, y, south ? 'up' : 'down', [3 + (k % 2), 8, 4, (k++ % 2) as 0 | 1]);
  }

  // "Talk to the instructor" spots: office hours happen at the board when there is no lesson.
  for (const n of npcs) {
    if (n.role !== 'instructor') continue;
    const zid = zones.find((z) => inZone(z, Math.floor(n.x), Math.floor(n.y)))?.id;
    if (!zid) continue;
    spots.push({ id: `office_${zid}`, kind: 'instructor', label: 'Talk to the instructor', price: 0, rect: R(Math.floor(n.x) - 1, Math.floor(n.y) - 1, 3, 3) });
  }
  npc('security', 'Security', 43.5, 7.3, 'left', [3, 9, 0, 0]);
  npc('vendor', 'Market Seller', 10.5, 35.8, 'down', [2, 6, 3, 1]);
  npc('clerk', 'Jobs Clerk', 23.5, 37.7, 'down', [3, 5, 1, 0]);
  npc('clerk', 'Games Attendant', 14.5, 20.3, 'down', [2, 3, 2, 0]);
  npc('dj', 'DJ', 54.5, 7.6, 'left', [2, 7, 5, 0]);
  for (const [x, y, g] of [[56.2, 5.4, 1], [57.6, 7.6, 0], [56.2, 9.8, 1]] as const) {
    npcs.push({ id: `npc${npcs.length}`, role: 'dancer', label: 'Dancer', x, y, facing: 'left', level: 'ground', skin: 3 + (g ? 0 : 1), shirt: g ? 7 : 3, hair: g ? 1 : 0, gender: g, elev: 0.6 });
  }
  // The house singer: takes the microphone whenever no booked performer is on stage.
  npcs.push({ id: `npc${npcs.length}`, role: 'singer', label: 'House Singer', x: 58.3, y: 7.6, facing: 'left', level: 'ground', skin: 2, shirt: 4, hair: 2, gender: 1, elev: 0.6 });
  // Party-goers who fill the dance floor while the music plays (the client only shows them during the party).
  let rv = 0;
  for (const [x, y] of [[46.5, 7.5], [48.5, 12.5], [50.5, 8.5], [47.5, 10.5], [51.5, 12.5], [49.5, 6.8], [46.6, 13], [51.6, 10]] as const) {
    const g = (rv % 2) as 0 | 1;
    npcs.push({ id: `npc${npcs.length}`, role: 'reveler', label: ['Kofi', 'Mercy', 'Joe', 'Ruth', 'Prince', 'Grace', 'Emmanuel', 'Hawa'][rv] ?? 'Guest', x, y, facing: 'right', level: 'ground', skin: 1 + (rv % 4), shirt: (rv * 3 + 1) % 10, hair: rv % 6, gender: g });
    rv++;
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
    foodCounter: R(21, 5, 10, 1),
    spots,
    npcs,
    venue: { stage: R(55, 4, 4, 8), danceFloor: R(45, 6, 8, 8), dj: { x: 54.5, y: 7.6 }, door: R(41, 8, 1, 2) },
    rec: { pitch: R(4, 22, 20, 11), goalY0: 25, goalY1: 30, start: { x: 14, y: 27.5 } }
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
