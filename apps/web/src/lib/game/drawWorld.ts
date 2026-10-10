import Phaser from 'phaser';
import {
  CAMPUS_MAP, GROUND_H, MAP_H, MAP_W, TILE, UPPER_Y0, WORLD_H, WORLD_W, inRect, inZone,
  type Furniture, type Hut, type Sign, type ZoneId
} from '@campus/shared';

export const FONT = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", sans-serif';
const T = TILE;

/** Cheap deterministic per-tile noise so ground has texture but never flickers. */
function hash(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const C = {
  void: 0x14171f,
  grass: [0x4d8a47, 0x54914d, 0x468041],
  laterite: [0xa8603d, 0xb06a45, 0x9c5836],
  terracotta: [0xb4623f, 0xbb6a46, 0xad5a39],
  concrete: 0x6d7076,
  slab: 0xb8b4aa,
  cream: 0xe9ddb0,
  creamDark: 0xcfc08f,
  teal: 0x20a6a8,
  tealDark: 0x167e80,
  plaster: 0xe7e2d3,
  wood: 0x4a2f1d,
  woodLight: 0x6b4630,
  red: 0xb23a2e
};

export interface WorldLayers {
  roofs: Array<{ zone: ZoneId; img: Phaser.GameObjects.Image }>;
}

/**
 * Paints the whole campus once into a single texture ('world') plus a few
 * overhead layers (hut roofs). No image files: swap this for Tiled maps and
 * sprite sheets later without touching gameplay code.
 */
export function drawWorld(scene: Phaser.Scene): WorldLayers {
  const M = CAMPUS_MAP;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  g.fillStyle(C.void, 1).fillRect(0, 0, WORLD_W, WORLD_H);

  // ---- grass ----
  for (let y = 0; y < GROUND_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const v = hash(x, y);
      g.fillStyle(C.grass[Math.floor(v * 3)], 1).fillRect(x * T, y * T, T, T);
      if (v > 0.88) g.fillStyle(0x3b7539, 1).fillRect(x * T + 6 + ((v * 97) % 14), y * T + 9, 3, 8);
      if (v < 0.04) g.fillStyle(0x6fa65f, 1).fillCircle(x * T + 16, y * T + 16, 5);
    }
  }

  // ---- laterite roads and paths ----
  for (const r of M.paths) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const v = hash(x + 7, y + 3);
        g.fillStyle(C.laterite[Math.floor(v * 3)], 1).fillRect(x * T, y * T, T, T);
        if (v > 0.7) g.fillStyle(0x7e4429, 0.55).fillRect(x * T + 5 + ((v * 53) % 18), y * T + 8 + ((v * 31) % 14), 4, 3);
        if (v < 0.18) g.fillStyle(0xc9a07a, 0.8).fillRect(x * T + 10, y * T + 20, 3, 2);
      }
    }
  }
  for (const p of M.puddles) {
    g.fillStyle(0x5a7a8c, 0.75).fillEllipse(p.x * T + 16, p.y * T + 18, 26, 14);
    g.fillStyle(0x8fb0c2, 0.6).fillEllipse(p.x * T + 13, p.y * T + 15, 10, 5);
  }

  // ---- building floors ----
  for (const b of M.buildings) {
    for (let y = b.rect.y; y < b.rect.y + b.rect.h; y++) {
      for (let x = b.rect.x; x < b.rect.x + b.rect.w; x++) {
        const v = hash(x, y + 11);
        const upstairsGrey = b.style === 'upper' && y === 93;
        g.fillStyle(upstairsGrey ? C.concrete : C.terracotta[Math.floor(v * 3)], 1).fillRect(x * T, y * T, T, T);
        g.lineStyle(1, 0x000000, upstairsGrey ? 0.14 : 0.1).strokeRect(x * T + 0.5, y * T + 0.5, T - 1, T - 1);
        const z = M.zones.find((zz) => inZone(zz, x, y));
        if (!upstairsGrey && z?.id === 'admin_hallway' && (x + y) % 2 === 0) {
          g.fillStyle(0xd9a37a, 0.45).fillTriangle(x * T + 16, y * T + 6, x * T + 26, y * T + 16, x * T + 16, y * T + 26);
          g.fillStyle(0xd9a37a, 0.45).fillTriangle(x * T + 16, y * T + 6, x * T + 6, y * T + 16, x * T + 16, y * T + 26);
        }
        if (z?.id === 'student_center' && v < 0.06) g.fillStyle(0xf4f1ea, 0.8).fillRect(x * T + 8 + ((v * 300) % 12), y * T + 12, 6, 4); // wrappers
      }
    }
  }
  // Administrative Hall: beige circular wallpaper along its east wall.
  for (let y = 7; y < 14; y++) {
    g.fillStyle(0xcdb48a, 1).fillRect(26 * T - 7, y * T, 7, T);
    g.fillStyle(0xa8895c, 1).fillCircle(26 * T - 3, y * T + 16, 4);
  }

  // ---- huts: concrete slab + pillars ----
  for (const h of M.huts) drawHutBase(g, h);

  // ---- furniture ----
  for (const f of M.furniture) drawFurniture(g, f);
  for (const s of M.seats) drawChairIfNeeded(g, s.x, s.y, s.facing);

  // ---- walls and doors ----
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const w = M.walls[y * MAP_W + x];
      if (!w) continue;
      const b = M.buildings.find((bb) => inRect(bb.rect, x, y));
      if (w === 1) {
        g.fillStyle(C.creamDark, 1).fillRect(x * T, y * T, T, T);
        g.fillStyle(C.cream, 1).fillRect(x * T, y * T, T, T - 8);
        g.fillStyle(b?.style === 'center' ? C.red : C.teal, 1).fillRect(x * T, y * T, T, 7);
        g.fillStyle(0x000000, 0.12).fillRect(x * T, y * T + T - 3, T, 3);
      } else {
        g.fillStyle(0xbab4a4, 1).fillRect(x * T, y * T, T, T);
        g.fillStyle(C.plaster, 1).fillRect(x * T + 3, y * T + 3, T - 6, T - 6);
      }
    }
  }
  for (const d of M.doors) {
    for (let y = d.rect.y; y < d.rect.y + d.rect.h; y++) {
      for (let x = d.rect.x; x < d.rect.x + d.rect.w; x++) {
        g.fillStyle(C.wood, 1).fillRect(x * T, y * T, T, T);
        g.fillStyle(C.woodLight, 1).fillRect(x * T + 3, y * T + 3, T - 6, T - 6);
        g.fillStyle(0xd7b46a, 1).fillCircle(x * T + (d.rect.w > 1 ? (x === d.rect.x ? 26 : 6) : 16), y * T + 17, 2.5);
      }
    }
  }
  // Notices on the Admin Hallway wall.
  for (const [nx, ny, col] of [[7, 14, 0xf4f1ea], [12, 14, 0xf2d13b], [17, 14, 0xf4f1ea], [23, 14, 0xe5a0a0]] as const) {
    g.fillStyle(col, 1).fillRect(nx * T + 6, ny * T + 14, 12, 10);
  }
  // Fluorescent strips along corridor ceilings.
  for (const [x, y, w] of [[7, 16, 5], [15, 16, 5], [23, 16, 3], [24, 93, 5], [32, 93, 4], [39, 93, 6]] as const) {
    g.fillStyle(0xf8f8e8, 0.35).fillRoundedRect(x * T, y * T + 10, w * T, 8, 3);
  }

  // ---- trees (kept off the roads; bases shaded) ----
  for (const t of M.trees) drawTree(g, t.x, t.y, t.kind);

  g.generateTexture('world', WORLD_W, WORLD_H);
  g.destroy();

  for (const s of M.signs) addSign(scene, s);

  // Hut roofs sit above players but fade when you walk under them.
  const roofs: WorldLayers['roofs'] = [];
  for (const h of M.huts) {
    const key = `roof:${h.zone}`;
    makeRoofTexture(scene, key, h);
    const img = scene.add.image(h.cx * T, h.cy * T, key).setDepth(50000).setAlpha(0.3);
    roofs.push({ zone: h.zone, img });
  }
  return { roofs };
}

function drawHutBase(g: Phaser.GameObjects.Graphics, h: Hut) {
  const cx = h.cx * T;
  const cy = h.cy * T;
  g.fillStyle(0x000000, 0.18).fillCircle(cx + 4, cy + 6, h.r * T);
  g.fillStyle(C.slab, 1).fillCircle(cx, cy, h.r * T);
  g.lineStyle(3, 0x8e8a80, 1).strokeCircle(cx, cy, h.r * T - 1.5);
  g.lineStyle(1, 0x9d998f, 0.8);
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI) / 4;
    g.lineBetween(cx, cy, cx + Math.cos(ang) * h.r * T, cy + Math.sin(ang) * h.r * T);
  }
  for (const p of h.pillars) {
    g.fillStyle(0x000000, 0.2).fillCircle(p.x * T + 19, p.y * T + 22, 12);
    g.fillStyle(C.tealDark, 1).fillCircle(p.x * T + 16, p.y * T + 16, 12);
    g.fillStyle(C.teal, 1).fillCircle(p.x * T + 14, p.y * T + 14, 9);
  }
}

function makeRoofTexture(scene: Phaser.Scene, key: string, h: Hut) {
  if (scene.textures.exists(key)) return;
  const R = (h.r + 1.1) * T;
  const size = Math.ceil(R * 2) + 4;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const c = size / 2;
  g.fillStyle(C.red, 1).fillCircle(c, c, R);
  g.fillStyle(0x6e4a33, 1).fillCircle(c, c, R - 8);
  for (let ring = 1; ring <= 5; ring++) {
    const rr = (R - 8) * (1 - ring * 0.17);
    g.lineStyle(2, 0x543725, 0.7).strokeCircle(c, c, rr);
  }
  g.lineStyle(2, 0x543725, 0.65);
  for (let a = 0; a < 24; a++) {
    const ang = (a * Math.PI * 2) / 24;
    g.lineBetween(c + Math.cos(ang) * 14, c + Math.sin(ang) * 14, c + Math.cos(ang) * (R - 8), c + Math.sin(ang) * (R - 8));
  }
  g.fillStyle(0x3a2619, 1).fillCircle(c, c, 8);
  g.generateTexture(key, size, size);
  g.destroy();
}

function drawTree(g: Phaser.GameObjects.Graphics, tx: number, ty: number, kind: 'palm' | 'tree') {
  const cx = tx * T + 16;
  const cy = ty * T + 16;
  g.fillStyle(0x000000, 0.2).fillEllipse(cx + 3, cy + 11, 28, 11);
  if (kind === 'tree') {
    g.fillStyle(0x2f6b3a, 1).fillCircle(cx, cy - 2, 15);
    g.fillStyle(0x3e8a4a, 1).fillCircle(cx - 3, cy - 5, 9);
    return;
  }
  g.lineStyle(5, 0x6b4a2b, 1).lineBetween(cx, cy + 10, cx + 2, cy - 4);
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + hash(tx, ty) * 2;
    const len = 17;
    g.lineStyle(5, i % 2 ? 0x2f7d3b : 0x3d9448, 1).lineBetween(cx + 2, cy - 5, cx + 2 + Math.cos(a) * len, cy - 5 + Math.sin(a) * len * 0.8);
  }
  g.fillStyle(0x2a6b34, 1).fillCircle(cx + 2, cy - 5, 4);
}

/** Dark wooden chair under a seat tile (benches and sofas draw their own seating). */
function drawChairIfNeeded(g: Phaser.GameObjects.Graphics, px: number, py: number, facing: string) {
  const M = CAMPUS_MAP;
  const tx = Math.floor(px / T);
  const ty = Math.floor(py / T);
  if (M.furniture.some((f) => f.kind === 'bench' && inRect(f.rect, tx, ty))) return;
  const x = tx * T;
  const y = ty * T;
  g.fillStyle(0x000000, 0.18).fillRoundedRect(x + 7, y + 10, 20, 19, 4);
  g.fillStyle(C.wood, 1).fillRoundedRect(x + 6, y + 8, 20, 18, 4);
  g.fillStyle(C.woodLight, 1).fillRoundedRect(x + 9, y + 11, 14, 12, 3);
  g.fillStyle(C.wood, 1);
  if (facing === 'up') g.fillRect(x + 7, y + 22, 18, 5);
  else if (facing === 'down') g.fillRect(x + 7, y + 7, 18, 5);
  else if (facing === 'left') g.fillRect(x + 21, y + 8, 5, 18);
  else g.fillRect(x + 6, y + 8, 5, 18);
}

function drawFurniture(g: Phaser.GameObjects.Graphics, f: Furniture) {
  const x = f.rect.x * T;
  const y = f.rect.y * T;
  const w = f.rect.w * T;
  const h = f.rect.h * T;
  switch (f.kind) {
    case 'desk': // writing tablet on a heavy chair arm
      g.fillStyle(0x000000, 0.2).fillRoundedRect(x + 5, y + 10, 24, 18, 3);
      g.fillStyle(C.wood, 1).fillRoundedRect(x + 4, y + 8, 24, 18, 3);
      g.fillStyle(0x8a6240, 1).fillRoundedRect(x + 6, y + 10, 20, 12, 2);
      break;
    case 'whiteboard':
      g.fillStyle(0x000000, 0.2).fillRect(x, y + h - 6, w, 6);
      g.fillStyle(0x8e8a80, 1).fillRect(x + 2, y + 3, w - 4, h - 6);
      g.fillStyle(0xf7f8f5, 1).fillRect(x + 5, y + 6, w - 10, h - 13);
      g.fillStyle(0x3b82f6, 0.55).fillRect(x + 12, y + 12, Math.min(48, w - 30), 2);
      g.fillStyle(0xe5484d, 0.55).fillRect(x + 12, y + 18, Math.min(30, w - 30), 2);
      break;
    case 'table':
    case 'small_table':
      g.fillStyle(0x000000, 0.2).fillRoundedRect(x + 3, y + 7, w - 3, h - 3, 6);
      g.fillStyle(C.wood, 1).fillRoundedRect(x + 1, y + 3, w - 2, h - 5, 6);
      g.fillStyle(0x7a5236, 1).fillRoundedRect(x + 5, y + 7, w - 10, h - 13, 4);
      if (f.kind === 'table' && hash(f.rect.x, f.rect.y) > 0.45) g.fillStyle(0xf4f1ea, 1).fillRect(x + 10, y + 12, 9, 6); // papers
      break;
    case 'bench':
      g.fillStyle(0x000000, 0.18).fillRoundedRect(x + 2, y + 6, w - 2, h - 2, 5);
      g.fillStyle(0x8f8c83, 1).fillRoundedRect(x + 1, y + 3, w - 2, h - 5, 5);
      g.fillStyle(0xaaa69b, 1).fillRoundedRect(x + 4, y + 6, w - 8, h - 11, 4);
      break;
    case 'counter':
      g.fillStyle(0x000000, 0.2).fillRect(x + 2, y + 8, w - 2, h - 3);
      g.fillStyle(0x6a4a2e, 1).fillRoundedRect(x + 1, y + 3, w - 2, h - 5, 3);
      g.fillStyle(0xcfae7a, 1).fillRoundedRect(x + 3, y + 5, w - 6, h - 13, 2);
      break;
    case 'stall': // Back Palaver serving stall with food pots and a teal canopy edge
      g.fillStyle(0x000000, 0.2).fillRect(x + 2, y + 8, w - 2, h - 2);
      g.fillStyle(0x5a3d27, 1).fillRoundedRect(x, y + 2, w, h - 3, 4);
      g.fillStyle(0xcfae7a, 1).fillRect(x + 4, y + h - 22, w - 8, 14);
      for (let i = 0; i < w / T - 1; i++) {
        g.fillStyle(0x2b2f3a, 1).fillCircle(x + 22 + i * T, y + 28, 9);
        g.fillStyle([0xd2691e, 0xe5b84b, 0x9c3b2e][i % 3], 1).fillCircle(x + 22 + i * T, y + 27, 6);
      }
      g.fillStyle(C.teal, 1).fillRect(x, y + 2, w, 5);
      break;
    case 'shelf': {
      g.fillStyle(0x3d2616, 1).fillRoundedRect(x + 1, y + 3, w - 2, h - 4, 2);
      const cols = [0xe5484d, 0xf5a524, 0x3b82f6, 0x3fb26b, 0xf4f1ea, 0x6e56cf, 0x2fa8a0];
      for (let i = 0; i < w - 8; i += 5) {
        const col = cols[Math.floor(hash(f.rect.x + i, f.rect.y) * cols.length)];
        g.fillStyle(col, 1).fillRect(x + 4 + i, y + 6 + (i % 3), 4, h - 12);
      }
      break;
    }
    case 'filing':
      g.fillStyle(0x000000, 0.2).fillRect(x + 2, y + 8, w - 2, h - 3);
      g.fillStyle(0x8a9097, 1).fillRect(x + 1, y + 3, w - 2, h - 5);
      for (let i = 0; i < w / T * 2; i++) g.fillStyle(0x6c7279, 1).fillRect(x + 4 + i * 16, y + 8, 12, 4);
      break;
    case 'stacked_chairs':
      for (let k = 0; k < f.rect.h; k++) {
        g.fillStyle(0x000000, 0.18).fillRoundedRect(x + 5, y + k * T + 6, 24, 24, 3);
        g.fillStyle(C.wood, 1).fillRoundedRect(x + 3, y + k * T + 3, 24, 24, 3);
        g.fillStyle(C.woodLight, 1).fillRoundedRect(x + 7, y + k * T + 7, 16, 16, 2);
      }
      break;
    case 'bucket':
      g.fillStyle(0x000000, 0.2).fillEllipse(x + 18, y + 25, 18, 8);
      g.fillStyle(0xc0392b, 1).fillCircle(x + 16, y + 17, 9);
      g.fillStyle(0x7a1f16, 1).fillCircle(x + 16, y + 17, 6);
      break;
    case 'stairs': {
      const horizontal = f.facing === 'up' || f.facing === 'down';
      g.fillStyle(0xe8e4d8, 1).fillRect(x, y, w, h);
      const n = horizontal ? Math.floor(h / 14) : Math.floor(w / 14);
      for (let i = 0; i < n; i++) {
        if (horizontal) {
          g.fillStyle(0x4a2f1d, 1).fillRect(x + 3, y + i * 14 + 3, w - 6, 8);
          g.fillStyle(0xd9d5c9, 1).fillRect(x + 3, y + i * 14 + 11, w - 6, 3);
        } else {
          g.fillStyle(0x4a2f1d, 1).fillRect(x + i * 14 + 3, y + 3, 8, h - 6);
          g.fillStyle(0xd9d5c9, 1).fillRect(x + i * 14 + 11, y + 3, 3, h - 6);
        }
      }
      g.lineStyle(3, 0xffffff, 1);
      if (horizontal) { g.lineBetween(x + 1, y, x + 1, y + h); g.lineBetween(x + w - 1, y, x + w - 1, y + h); }
      else { g.lineBetween(x, y + 1, x + w, y + 1); g.lineBetween(x, y + h - 1, x + w, y + h - 1); }
      break;
    }
    case 'hedge':
      g.fillStyle(0x000000, 0.2).fillRoundedRect(x + 2, y + 9, w, h - 2, 8);
      g.fillStyle(0x2f6b3a, 1).fillRoundedRect(x, y + 3, w, h - 4, 8);
      g.fillStyle(0x3e8a4a, 1).fillRoundedRect(x + 3, y + 6, w - 6, h - 12, 6);
      break;
    case 'car':
      g.fillStyle(0x000000, 0.25).fillRoundedRect(x + 4, y + 8, w, h - 2, 10);
      g.fillStyle(0x2f5fb3, 1).fillRoundedRect(x, y + 3, w, h - 5, 10);
      g.fillStyle(0x9ec9ef, 1).fillRoundedRect(x + 22, y + 8, w - 44, h - 15, 6);
      g.fillStyle(0x234a8e, 1).fillRoundedRect(x + 30, y + 12, w - 60, h - 23, 5);
      break;
    case 'motorcycle':
      g.fillStyle(0x000000, 0.22).fillEllipse(x + w / 2, y + 22, w - 6, 12);
      g.fillStyle(0x1b1d22, 1).fillRoundedRect(x + 5, y + 10, w - 10, 12, 5);
      g.fillStyle(0xc0392b, 1).fillRoundedRect(x + 18, y + 8, 24, 10, 4);
      break;
    case 'loader':
      g.fillStyle(0x000000, 0.25).fillRoundedRect(x + 5, y + 9, w, h - 2, 6);
      g.fillStyle(0xf2b705, 1).fillRoundedRect(x, y + 3, w - 40, h - 5, 6);
      g.fillStyle(0x2b2f3a, 1).fillRect(x + 14, y + 12, 36, 24);
      g.fillStyle(0xf2b705, 1).fillRoundedRect(x + w - 44, y + 12, 42, h - 26, 4);
      g.fillStyle(0x1b1d22, 1).fillRect(x + w - 8, y + 8, 6, h - 16);
      break;
    case 'post':
      g.fillStyle(0x000000, 0.2).fillEllipse(x + 18, y + 26, 22, 9);
      g.fillStyle(0x9a968c, 1).fillRoundedRect(x + 6, y + 4, 20, 24, 4);
      g.fillStyle(C.teal, 1).fillRect(x + 6, y + 4, 20, 6);
      break;
    case 'chair':
      break;
  }
}

function addSign(scene: Phaser.Scene, s: Sign) {
  const style =
    s.kind === 'label'
      ? { fontSize: '18px', fontStyle: 'bold', color: '#ffffff', stroke: '#151a38', strokeThickness: 5 }
      : s.kind === 'banner'
        ? { fontSize: '16px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#167e80', padding: { x: 14, y: 6 } }
        : { fontSize: '9px', fontStyle: 'bold', color: '#1d1d1d', backgroundColor: '#e6d9a8', padding: { x: 4, y: 2 } };
  scene.add
    .text(s.x * T, s.y * T, s.text, { fontFamily: FONT, ...style })
    .setOrigin(0.5, s.kind === 'label' ? 1 : 0.5)
    .setDepth(s.kind === 'label' ? 100000 : 5);
}

/** Camera bounds for a level, in world pixels. */
export const LEVEL_BOUNDS = {
  ground: { x: 0, y: 0, w: WORLD_W, h: GROUND_H * T },
  upper: { x: 0, y: (UPPER_Y0 - 8) * T, w: WORLD_W, h: (MAP_H - (UPPER_Y0 - 8)) * T }
} as const;
