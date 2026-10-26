import * as THREE from 'three';
import type { CampusMap, Furniture } from '@campus/shared';
import { Geo, rgb, shade, type V3 } from './geo';

/**
 * The Student Center show area: stage, DJ booth, speakers, rope posts (static props that live in the
 * normal merged geometry) plus the parts that change with the party (dance floor tiles, string lights,
 * LED strips, spotlight beams). Everyday mode is calm; party mode pulses with the beat.
 */

const STAGE_H = 0.6;
const TRUSS_Y = 2.8;
const BRASS = rgb(0xb08d3c);
const DARK = rgb(0x17181c);
const METAL = rgb(0x5d646b);

/** Static prop: the raised stage with a curtain backdrop and a lighting truss. */
export function stageInto(P: Geo, f: Furniture) {
  const { x, y, w, h } = f.rect;
  P.box(x, 0, y, x + w, STAGE_H, y + h, rgb(0x6e4a33), 0.5, 0.5);
  P.box(x - 0.02, 0.0, y, x + 0.04, STAGE_H + 0.02, y + h, rgb(0x8c1f2a)); // red front edge
  // curtain against the east wall, in folds
  const strips = 10;
  for (let i = 0; i < strips; i++) {
    const z0 = y + (i / strips) * h;
    const z1 = y + ((i + 1) / strips) * h;
    const k = i % 2 ? 0.8 : 1.05;
    P.box(x + w - 0.32 + (i % 2) * 0.06, STAGE_H, z0, x + w - 0.04, 3.05, z1, shade(rgb(0x4a1a66), k));
  }
  // lighting truss over the stage, and one in front of it
  for (const tx of [x + 0.7, x + w - 1.2]) {
    P.box(tx, TRUSS_Y, y + 0.1, tx + 0.14, TRUSS_Y + 0.14, y + h - 0.1, METAL);
    for (let i = 0; i <= 8; i++) P.box(tx + 0.03, TRUSS_Y - 0.02, y + 0.1 + (i * (h - 0.3)) / 8, tx + 0.11, TRUSS_Y + 0.16, y + 0.14 + (i * (h - 0.3)) / 8, DARK);
    for (const zz of [y + 0.6, y + h - 0.6]) P.box(tx + 0.05, TRUSS_Y - 1.1, zz, tx + 0.09, TRUSS_Y + 0.1, zz + 0.04, METAL);
  }
  // a little step at the front
  P.box(x - 0.55, 0, y + h / 2 - 0.8, x - 0.02, 0.3, y + h / 2 + 0.8, rgb(0x5a3a26));
}

/** Static prop: a tall PA speaker facing the dance floor (west). */
export function speakerInto(P: Geo, f: Furniture) {
  const { x, y, w, h } = f.rect;
  P.box(x + 0.08, 0, y + 0.08, x + w - 0.08, 1.75, y + h - 0.08, DARK);
  P.box(x + 0.06, 1.75, y + 0.06, x + w - 0.06, 1.8, y + h - 0.06, shade(DARK, 1.6));
  const cz = y + h / 2;
  const cone = (cy: number, r: number) => {
    const g = new THREE.CylinderGeometry(r, r * 0.8, 0.07, 18);
    P.add(g, new THREE.Matrix4().makeTranslation(x + 0.09, cy, cz).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)), shade(DARK, 2.2));
    g.dispose();
    const c = new THREE.CylinderGeometry(r * 0.4, r * 0.3, 0.09, 12);
    P.add(c, new THREE.Matrix4().makeTranslation(x + 0.085, cy, cz).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)), shade(DARK, 0.7));
    c.dispose();
  };
  cone(0.55, 0.3);
  cone(1.25, 0.24);
  cone(1.62, 0.07);
}

/** Static prop: the DJ's table with turntables, a mixer and a laptop. The LED front panel is in the glow mesh. */
export function djBoothInto(P: Geo, f: Furniture) {
  const { x, y, w, h } = f.rect;
  P.box(x + 0.04, 0, y + 0.1, x + w - 0.04, 1.08, y + h - 0.1, rgb(0x232329));
  P.box(x, 1.08, y + 0.05, x + w, 1.13, y + h - 0.05, METAL);
  const cz = y + h / 2;
  // two turntables and the mixer between them
  for (const dz of [-1.25, 1.25]) {
    P.box(x + 0.15, 1.13, cz + dz - 0.4, x + w - 0.15, 1.18, cz + dz + 0.4, rgb(0x2b2c32));
    const disc = new THREE.CylinderGeometry(0.33, 0.33, 0.03, 20);
    P.add(disc, new THREE.Matrix4().makeTranslation(x + w / 2, 1.2, cz + dz), rgb(0x0b0b0d));
    disc.dispose();
    const lab = new THREE.CylinderGeometry(0.09, 0.09, 0.035, 12);
    P.add(lab, new THREE.Matrix4().makeTranslation(x + w / 2, 1.21, cz + dz), rgb(0xd33a2e));
    lab.dispose();
  }
  P.box(x + 0.15, 1.13, cz - 0.42, x + w - 0.15, 1.26, cz + 0.42, rgb(0x3a3b44));
  for (let i = 0; i < 4; i++) P.box(x + 0.25, 1.26, cz - 0.34 + i * 0.2, x + 0.33, 1.3, cz - 0.24 + i * 0.2, rgb(0xe9e6dc));
  // laptop on the side
  P.obox(x + w / 2, 1.14, y + 0.35, 0.34, 0.02, 0.24, rgb(0x8a8d92), 0.2);
  P.obox(x + w / 2, 1.26, y + 0.22, 0.34, 0.2, 0.012, rgb(0x2a2d33), 0.2, -0.25);
}

/** Static prop: a brass rope post. */
export function ropePostInto(P: Geo, f: Furniture) {
  const { x, y } = f.rect;
  const cx = x + 0.5;
  const cz = y + 0.5;
  P.cyl(cx, 0, cz, 0.15, 0.03, BRASS, 0.15, 12);
  P.cyl(cx, 0.03, cz, 0.035, 0.97, BRASS, 0.035, 8);
  const ball = new THREE.SphereGeometry(0.07, 10, 8);
  P.add(ball, new THREE.Matrix4().makeTranslation(cx, 1.04, cz), BRASS);
  ball.dispose();
}

/** A velvet rope sagging between two posts. */
export function ropesInto(P: Geo, posts: Furniture[]) {
  for (let i = 0; i + 1 < posts.length; i += 2) {
    const a = posts[i].rect;
    const b = posts[i + 1].rect;
    const ax = a.x + 0.5;
    const az = a.y + 0.5;
    const bx = b.x + 0.5;
    const bz = b.y + 0.5;
    const segs = 8;
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs;
      const t1 = (s + 1) / segs;
      const p = (t: number): V3 => [ax + (bx - ax) * t, 0.98 - Math.sin(Math.PI * t) * 0.18, az + (bz - az) * t];
      const p0 = p(t0);
      const p1 = p(t1);
      const mx = (p0[0] + p1[0]) / 2;
      const my = (p0[1] + p1[1]) / 2;
      const mz = (p0[2] + p1[2]) / 2;
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      const yaw = Math.atan2(p1[0] - p0[0], p1[2] - p0[2]);
      const tilt = -Math.asin((p1[1] - p0[1]) / len);
      P.obox(mx, my, mz, 0.05, 0.05, len + 0.02, rgb(0x8c1f2a), yaw, tilt);
    }
  }
}

export interface Venue {
  group: THREE.Group;
  /** Turn the party look on or off. */
  setParty(on: boolean): void;
  isParty(): boolean;
  /** Call every frame. `t` is wall seconds; `beat` is seconds since the current track began (so lights hit the beat). */
  update(t: number, beat?: number): void;
  /** How alive the floor is, 0 to 1: brighter beams, and confetti when it is full. */
  setEnergy(e: number): void;
  /** Beats per second of the lights (the DJ's track can change it later). */
  bpm: number;
  dispose(): void;
}

export function createVenue(M: CampusMap): Venue {
  const group = new THREE.Group();
  group.name = 'venue';
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const keep = <T extends THREE.BufferGeometry>(g: T) => (geos.push(g), g);
  const keepM = <T extends THREE.Material>(m: T) => (mats.push(m), m);

  const stage = M.furniture.find((f) => f.kind === 'stage');
  const booth = M.furniture.find((f) => f.kind === 'dj_booth');
  const floor = M.furniture.find((f) => f.kind === 'dance_floor');
  const speakers = M.furniture.filter((f) => f.kind === 'speaker');
  const bulbCols: V3[] = [rgb(0xff4d5a), rgb(0xffc933), rgb(0x4dd16a), rgb(0x4da3ff), rgb(0xff6fd0)];

  // ---- dance floor: two interleaved sets of tiles, tinted differently every beat
  const tilesA = new Geo();
  const tilesB = new Geo();
  if (floor) {
    const r = floor.rect;
    for (let j = 0; j < r.h; j++) {
      for (let i = 0; i < r.w; i++) {
        ((i + j) % 2 ? tilesB : tilesA).floor(r.x + i + 0.04, r.y + j + 0.04, r.x + i + 0.96, r.y + j + 0.96, 0.035, 1, 1);
      }
    }
  }
  const floorMatA = keepM(new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x555555 }));
  const floorMatB = keepM(new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x333333 }));
  if (!tilesA.empty) group.add(new THREE.Mesh(keep(tilesA.build()), floorMatA));
  if (!tilesB.empty) group.add(new THREE.Mesh(keep(tilesB.build()), floorMatB));

  // ---- glowing bits: string lights, truss lamps, LED strips on the booth and the stage edge
  const glow = new Geo();
  const wires = new Geo();
  if (stage && floor) {
    const x0 = 42.4;
    const x1 = stage.rect.x - 0.6;
    for (const [zi, zz] of [6.0, 10.5, 15.0].entries()) {
      const n = Math.round((x1 - x0) / 0.85);
      let prev: V3 | null = null;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const px = x0 + (x1 - x0) * t;
        const py = 3.0 - Math.sin(Math.PI * t) * 0.32;
        const pt: V3 = [px, py, zz];
        glow.box(px - 0.05, py - 0.12, zz - 0.05, px + 0.05, py - 0.02, zz + 0.05, bulbCols[(i + zi) % bulbCols.length]);
        if (prev) {
          const len = Math.hypot(pt[0] - prev[0], pt[1] - prev[1]);
          wires.obox((pt[0] + prev[0]) / 2, (pt[1] + prev[1]) / 2, zz, len + 0.02, 0.014, 0.014, [0.05, 0.05, 0.05], 0, 0);
          // tilt about Z would be nicer; the sag is gentle so flat segments read fine
        }
        prev = pt;
      }
    }
    // truss lamps
    const sr = stage.rect;
    for (const tx of [sr.x + 0.7, sr.x + sr.w - 1.2]) {
      for (const [k, zz] of [sr.y + 0.6, sr.y + sr.h / 2, sr.y + sr.h - 0.6].entries()) {
        glow.box(tx + 0.02, TRUSS_Y - 0.28, zz - 0.07, tx + 0.12, TRUSS_Y - 0.1, zz + 0.07, bulbCols[(k + (tx > sr.x + 1 ? 2 : 0)) % bulbCols.length]);
      }
    }
    // stage edge LED strip
    glow.box(sr.x - 0.045, 0.42, sr.y + 0.05, sr.x - 0.02, 0.5, sr.y + sr.h - 0.05, rgb(0xff4dd2));
  }
  if (booth) {
    const b = booth.rect;
    // front panel LED equaliser bars (facing the dance floor, west)
    const bars = 12;
    for (let i = 0; i < bars; i++) {
      const z = b.y + 0.35 + (i * (b.h - 0.7)) / (bars - 1);
      glow.box(b.x - 0.02, 0.18, z - 0.06, b.x + 0.02, 0.35 + ((i * 5) % 6) * 0.1, z + 0.06, bulbCols[i % bulbCols.length]);
    }
  }
  for (const s of speakers) {
    glow.box(s.rect.x + 0.07, 1.6, s.rect.y + s.rect.h / 2 - 0.3, s.rect.x + 0.09, 1.66, s.rect.y + s.rect.h / 2 + 0.3, rgb(0x4dd1ff));
  }
  const glowMat = keepM(new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x555555 }));
  if (!glow.empty) group.add(new THREE.Mesh(keep(glow.build()), glowMat));
  if (!wires.empty) group.add(new THREE.Mesh(keep(wires.build()), keepM(new THREE.MeshBasicMaterial({ vertexColors: true }))));

  // ---- spotlight beams (only while partying)
  const beams: Array<{ g: THREE.Group; m: THREE.MeshBasicMaterial; k: number }> = [];
  if (stage && floor) {
    const sr = stage.rect;
    const cone = keep(new THREE.CylinderGeometry(0.06, 1.25, 3.2, 14, 1, true));
    cone.translate(0, -1.6, 0);
    const target = { x: floor.rect.x + floor.rect.w / 2, z: floor.rect.y + floor.rect.h / 2 };
    for (let k = 0; k < 4; k++) {
      const m = keepM(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      const g = new THREE.Group();
      const px = sr.x + (k < 2 ? 0.8 : sr.w - 1.1);
      const pz = sr.y + (k % 2 ? sr.h - 0.6 : 0.6);
      g.position.set(px, TRUSS_Y - 0.2, pz);
      const mesh = new THREE.Mesh(cone, m);
      mesh.frustumCulled = false;
      g.add(mesh);
      g.userData = { base: Math.atan2(px - target.x, 2.6), pz, tz: target.z };
      g.visible = false;
      group.add(g);
      beams.push({ g, m, k });
    }
  }

  // ---- confetti, when the floor is full
  const CONF = 140;
  const confPos = new Float32Array(CONF * 3);
  const confVel = new Float32Array(CONF * 2);
  const confCol = new Float32Array(CONF * 3);
  const palette: V3[] = [rgb(0xff4d5a), rgb(0xffc933), rgb(0x4dd16a), rgb(0x4da3ff), rgb(0xff6fd0), rgb(0xffffff)];
  const cx0 = floor ? floor.rect.x - 1 : 44;
  const cz0 = floor ? floor.rect.y - 1 : 5;
  const cw = floor ? floor.rect.w + 2 : 10;
  const cd = floor ? floor.rect.h + 2 : 10;
  for (let i = 0; i < CONF; i++) {
    confPos[i * 3] = cx0 + ((i * 37) % 100) / 100 * cw;
    confPos[i * 3 + 1] = ((i * 53) % 100) / 100 * 3;
    confPos[i * 3 + 2] = cz0 + ((i * 71) % 100) / 100 * cd;
    confVel[i * 2] = 0.5 + ((i * 29) % 100) / 100 * 0.7;
    confVel[i * 2 + 1] = (((i * 17) % 100) / 100 - 0.5) * 0.8;
    const c = palette[i % palette.length];
    confCol.set(c, i * 3);
  }
  const confGeo = keep(new THREE.BufferGeometry());
  confGeo.setAttribute('position', new THREE.BufferAttribute(confPos, 3));
  confGeo.setAttribute('color', new THREE.BufferAttribute(confCol, 3));
  const confMat = keepM(new THREE.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
  const confetti = new THREE.Points(confGeo, confMat);
  confetti.frustumCulled = false;
  confetti.visible = false;
  group.add(confetti);
  let energy = 0;
  let lastT = 0;

  let on = false;
  const v: Venue = {
    group,
    bpm: 112,
    setParty(b: boolean) {
      on = b;
      if (!b) {
        confetti.visible = false;
        floorMatA.color.setScalar(0.34);
        floorMatB.color.setScalar(0.2);
        glowMat.color.setScalar(0.32);
        for (const bm of beams) bm.g.visible = false;
      } else {
        for (const bm of beams) bm.g.visible = true;
      }
    },
    isParty: () => on,
    setEnergy(e: number) {
      energy = Math.min(1, Math.max(0, e));
    },
    update(t: number, beat?: number) {
      if (!on) return;
      const dt = Math.min(0.1, Math.max(0, t - lastT));
      lastT = t;
      if (energy >= 0.6) {
        confetti.visible = true;
        for (let i = 0; i < CONF; i++) {
          confPos[i * 3 + 1] -= confVel[i * 2] * dt;
          confPos[i * 3] += confVel[i * 2 + 1] * dt + Math.sin(t * 2 + i) * 0.004;
          if (confPos[i * 3 + 1] < 0.05) confPos[i * 3 + 1] = 3.0;
        }
        (confGeo.getAttribute('position') as THREE.BufferAttribute & { needsUpdate: boolean }).needsUpdate = true;
      } else confetti.visible = false;
      const bps = v.bpm / 60;
      const bt = beat ?? t;
      const ph = (bt * bps) % 1;
      const pulse = Math.pow(1 - ph, 3);
      const bar = Math.floor(bt * bps);
      const hue = ((bar * 0.17) % 1 + (t * 0.02)) % 1;
      floorMatA.color.setHSL(hue, 0.85, 0.28 + 0.1 * energy + 0.26 * pulse);
      floorMatB.color.setHSL((hue + 0.42) % 1, 0.85, 0.28 + 0.24 * (1 - pulse));
      glowMat.color.setScalar(0.7 + 0.3 * pulse);
      for (const bm of beams) {
        const d = bm.g.userData as { base: number; pz: number; tz: number };
        bm.g.rotation.set(Math.sin(t * 1.3 + bm.k * 1.7) * 0.45 - Math.atan2(d.tz - d.pz, 2.6), 0, d.base * -1 + Math.sin(t * 0.9 + bm.k) * 0.25);
        bm.m.color.setHSL((hue + bm.k * 0.23) % 1, 0.9, 0.6);
        bm.m.opacity = 0.07 + 0.08 * energy + 0.1 * pulse;
      }
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    }
  };
  v.setParty(false);
  return v;
}
