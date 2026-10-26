import * as THREE from 'three';
import {
  CAMPUS_MAP,
  GROUND_H,
  MAP_H,
  MAP_W,
  TILE,
  inRect,
  isBlockedTile,
  levelOfRow,
  type Building,
  type Door,
  type Facing,
  type Furniture,
  type Level,
  type Rect
} from '@campus/shared';
import { Geo, mulberry32, rgb, shade, type V3 } from './geo';
import * as T from './textures';
import * as V from './venue3d';

/** World units are metres, and one map tile is one metre. Game positions are in pixels. */
export const U = 1 / TILE;
const M = CAMPUS_MAP;

// ------------------------------------------------------------------ sizes
const WALL_H = 3.2;
const DOOR_H = 2.3;
const STUDENT_TOP = 6.4;
const STAIR_RISE = 3.0;

// ------------------------------------------------------------------ colours (hex, sRGB)
const COL = {
  wood: rgb(0x4a2f1d),
  woodLight: rgb(0x6e4a33),
  woodDark: rgb(0x33200f),
  white: rgb(0xe9e6dc),
  blue: rgb(0x2461b3),
  teal: rgb(0x1fb0b3),
  red: rgb(0xa8281f),
  concrete: rgb(0xb4b1a8),
  metal: rgb(0x5d646b),
  dark: rgb(0x1d1f23),
  green: rgb(0x2f6b34),
  yellow: rgb(0xe8b21c),
  brass: rgb(0xb08d3c)
};

// ------------------------------------------------------------------ "see through what hides the player"
/**
 * Walls, roofs and trees that stand between the camera and the player get
 * a soft, dithered hole. This is what lets the camera sit above a real 3D
 * building and still show you what is happening inside it.
 */
export const cut = {
  a: { value: new THREE.Vector3(0, 100, 0) }, // camera
  b: { value: new THREE.Vector3() }, // player
  r: { value: 2.4 } // hole radius, 0 = off
};

function patchCut<M extends THREE.Material>(mat: M): M {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCutA = cut.a;
    shader.uniforms.uCutB = cut.b;
    shader.uniforms.uCutR = cut.r;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutPos;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 cutLocal = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          cutLocal = instanceMatrix * cutLocal;
        #endif
        vCutPos = ( modelMatrix * cutLocal ).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutPos;\nuniform vec3 uCutA;\nuniform vec3 uCutB;\nuniform float uCutR;')
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        {
          vec3 cutAB = uCutB - uCutA;
          float cutLen = length( cutAB );
          vec3 cutDir = cutAB / max( cutLen, 0.0001 );
          float cutS = dot( vCutPos - uCutA, cutDir );
          if ( uCutR > 0.0 && cutS > 0.0 && cutS < cutLen - 0.9 ) {
            float cutD = length( vCutPos - ( uCutA + cutDir * cutS ) );
            float cutK = smoothstep( uCutR * 0.55, uCutR, cutD );
            float cutN = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
            if ( cutK < cutN ) discard;
          }
        }`
      );
  };
  mat.customProgramCacheKey = () => 'campus-cut';
  return mat;
}

// ------------------------------------------------------------------ public types
export interface BuildingView {
  id: string;
  rect: Rect;
  level: Level;
  mat: THREE.MeshLambertMaterial; // roof material, faded when you walk in
}
export interface HutView {
  zone: string;
  mat: THREE.MeshLambertMaterial;
}
export interface World3D {
  root: THREE.Group;
  ground: THREE.Group;
  upper: THREE.Group;
  sky: THREE.Mesh;
  buildings: BuildingView[];
  huts: HutView[];
  /** Floor height (metres) at a world position, so people walk up the staircase instead of through it. */
  heightAt(x: number, z: number): number;
  /** The Student Center show area: party lights on or off, animated each frame. */
  venue: V.Venue;
  setLevel(level: Level): void;
  /** 0 = broad daylight, 1 = full night: windows and street lamps glow. */
  setNight(n: number): void;
  dispose(): void;
}

type Key =
  | 'grass' | 'path' | 'pathEdge' | 'floor' | 'slab' | 'concrete'
  | 'extWall' | 'extWall2' | 'intWall' | 'window' | 'board' | 'books'
  | 'props' | 'occProps' | 'hedge' | 'puddle';

class LevelGeo {
  private m = new Map<Key, Geo>();
  g(k: Key): Geo {
    let x = this.m.get(k);
    if (!x) this.m.set(k, (x = new Geo()));
    return x;
  }
  entries() {
    return [...this.m.entries()].filter(([, g]) => !g.empty);
  }
}

const yawOf: Record<Facing, number> = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2 };
const dirOf: Record<Facing, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

// ------------------------------------------------------------------ build
export function buildWorld(opts: { anisotropy: number; lowEnd: boolean }): World3D {
  T.setMaxAnisotropy(opts.anisotropy);
  const texSize = opts.lowEnd ? 256 : 512;
  const rnd = mulberry32(2026);

  // ---- textures
  const tex = {
    grass: T.grassTexture(texSize),
    laterite: T.lateriteTexture(texSize),
    concrete: T.concreteTexture(256),
    terracotta: T.terracottaTexture(texSize),
    plaster: T.plasterTexture(256),
    extWall: T.exteriorWallTexture(false),
    extWall2: T.exteriorWallTexture(true),
    window: T.windowTexture(),
    roof: T.metalRoofTexture(),
    shingle: T.shingleTexture(),
    grain: T.grainTexture(),
    hedge: T.hedgeTexture(),
    board: T.whiteboardTexture(),
    books: T.booksTexture(),
    sky: T.skyTexture(),
    tuft: T.tuftTexture()
  };
  tex.shingle.repeat.set(10, 3);
  tex.books.wrapS = tex.books.wrapT = THREE.RepeatWrapping;
  tex.roof.repeat.set(1, 1);

  const lambert = (p: THREE.MeshLambertMaterialParameters) => new THREE.MeshLambertMaterial(p);
  const mats: Record<Key, THREE.Material> = {
    grass: lambert({ map: tex.grass }),
    path: lambert({ map: tex.laterite }),
    pathEdge: lambert({ map: tex.laterite, color: 0xb59582, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    floor: lambert({ map: tex.terracotta }),
    slab: lambert({ map: tex.concrete, color: 0x8f8d88 }),
    concrete: lambert({ map: tex.concrete }),
    extWall: patchCut(lambert({ map: tex.extWall })),
    extWall2: patchCut(lambert({ map: tex.extWall2 })),
    intWall: patchCut(lambert({ map: tex.plaster })),
    window: lambert({ map: tex.window, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    board: lambert({ map: tex.board, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    books: lambert({ map: tex.books, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    props: lambert({ map: tex.grain, vertexColors: true }),
    occProps: patchCut(lambert({ map: tex.grain, vertexColors: true })),
    hedge: lambert({ map: tex.hedge }),
    puddle: new THREE.MeshStandardMaterial({ color: 0x38454e, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.78, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  };
  const UVS: Record<Key, [number, number]> = {
    grass: [1 / 8, 1 / 8], path: [1 / 4, 1 / 4], pathEdge: [1 / 4, 1 / 4], floor: [1 / 2, 1 / 2], slab: [1 / 2, 1 / 2],
    concrete: [1 / 2, 1 / 2], extWall: [1 / 4, 1 / WALL_H], extWall2: [1 / 4, 1 / WALL_H], intWall: [1 / 2, 1 / 2],
    window: [1, 1], board: [1, 1], books: [1, 1], props: [1, 1], occProps: [1, 1], hedge: [1 / 2, 1 / 2], puddle: [1, 1]
  };

  const ground = new LevelGeo();
  const upperG = new LevelGeo();
  const L = (tz: number) => (levelOfRow(Math.floor(tz)) === 'upper' ? upperG : ground);

  const groundGrp = new THREE.Group();
  groundGrp.name = 'ground';
  const upperGrp = new THREE.Group();
  upperGrp.name = 'upper';
  const root = new THREE.Group();
  root.add(groundGrp, upperGrp);

  const disposables: Array<{ dispose(): void }> = [];
  const track = <X extends { dispose(): void }>(x: X): X => (disposables.push(x), x);

  const addMesh = (grp: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, name = ''): THREE.Mesh => {
    const m = new THREE.Mesh(track(geo), mat);
    m.name = name;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    grp.add(m);
    return m;
  };

  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  const wallKind = (x: number, y: number) => (inBounds(x, y) ? M.walls[y * MAP_W + x] : 0);
  const doorSet = new Set<number>();
  for (const d of M.doors) for (let y = d.rect.y; y < d.rect.y + d.rect.h; y++) for (let x = d.rect.x; x < d.rect.x + d.rect.w; x++) doorSet.add(y * MAP_W + x);
  const isDoor = (x: number, y: number) => inBounds(x, y) && doorSet.has(y * MAP_W + x);

  const signMeshes: THREE.Mesh[] = [];
  /** A flat sign: a quad with its own little texture, facing (nx, nz). */
  const sign = (text: string, bg: string, fg: string, tw: number, th: number, a: V3, b: V3, c: V3, d: V3, n: V3, border?: string) => {
    const t = T.signTexture(text, bg, fg, tw, th, border);
    const m = new THREE.MeshLambertMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const g = new Geo();
    g.quad(a, b, c, d, n, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    const mesh = new THREE.Mesh(track(g.build()), track(m));
    track(t);
    (levelOfRow(Math.floor(a[2])) === 'upper' ? upperGrp : groundGrp).add(mesh);
    signMeshes.push(mesh);
  };

  // ============================================================ ground plane
  {
    const g = ground.g('grass');
    g.floor(-220, -220, MAP_W + 220, GROUND_H + 220, -0.02, UVS.grass[0], UVS.grass[1]);
  }

  // ============================================================ paths
  for (const p of M.paths) {
    ground.g('pathEdge').floor(p.x - 0.35, p.y - 0.35, p.x + p.w + 0.35, p.y + p.h + 0.35, 0.006, UVS.pathEdge[0], UVS.pathEdge[1]);
    ground.g('path').floor(p.x, p.y, p.x + p.w, p.y + p.h, 0.012, UVS.path[0], UVS.path[1]);
  }

  // ============================================================ buildings: floors, walls, windows, doors, porches, roofs
  const buildings: BuildingView[] = [];
  const roofColor: Record<string, number> = { admin: 0x56808a, student: 0x667b93, center: 0xa5372b };

  for (const b of M.buildings) {
    const LG = b.level === 'upper' ? upperG : ground;
    const r = b.rect;
    const top = b.style === 'student' ? STUDENT_TOP : WALL_H;
    const isUpper = b.style === 'upper';

    // floor (terracotta everywhere inside, like the real rooms)
    LG.g('floor').floor(r.x + 1, r.y + 1, r.x + r.w - 1, r.y + r.h - 1, 0.02, UVS.floor[0], UVS.floor[1]);

    // walls
    const side = (tx: number, ty: number, nx: number, nz: number, y0: number, y1: number, outside: boolean) => {
      // the face on the (nx,nz) side of tile (tx,ty)
      const x0 = nz !== 0 ? tx : nx > 0 ? tx + 1 : tx;
      const x1 = nz !== 0 ? tx + 1 : x0;
      const z0 = nz !== 0 ? (nz > 0 ? ty + 1 : ty) : ty;
      const z1 = nz !== 0 ? z0 : ty + 1;
      // walk the face so it reads left to right as seen from outside the wall
      const [ax, az, bx, bz] = nz > 0 || nx < 0 ? [x0, z0, x1, z1] : [x1, z1, x0, z0];
      const useExt = outside && !isUpper;
      if (useExt) {
        LG.g('extWall').wall(ax, az, bx, bz, y0, Math.min(y1, WALL_H), nx, nz, UVS.extWall[0], UVS.extWall[1]);
        if (y1 > WALL_H) LG.g('extWall2').wall(ax, az, bx, bz, Math.max(y0, WALL_H), y1, nx, nz, UVS.extWall2[0], UVS.extWall2[1]);
      } else {
        LG.g('intWall').wall(ax, az, bx, bz, y0, Math.min(y1, WALL_H), nx, nz, UVS.intWall[0], UVS.intWall[1]);
      }
    };

    for (let ty = r.y; ty < r.y + r.h; ty++) {
      for (let tx = r.x; tx < r.x + r.w; tx++) {
        const kind = wallKind(tx, ty);
        const door = isDoor(tx, ty);
        if (!kind && !door) continue;
        const exteriorTile = tx === r.x || ty === r.y || tx === r.x + r.w - 1 || ty === r.y + r.h - 1;
        const colTop = kind === 2 ? WALL_H : top;
        const y0 = door ? DOOR_H : 0;
        for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
          const ax = tx + nx;
          const az = ty + nz;
          const outside = !inRect(r, ax, az);
          const nWall = wallKind(ax, az) > 0;
          const nDoor = isDoor(ax, az);
          if (door) {
            if (nWall || nDoor) continue;
            side(tx, ty, nx, nz, y0, colTop, outside);
          } else {
            if (nWall) continue;
            if (nDoor) {
              // the jamb beside an opening: only below the lintel
              side(tx, ty, nx, nz, 0, Math.min(DOOR_H, colTop), false);
            } else side(tx, ty, nx, nz, 0, colTop, outside);
          }
        }
        if (!door) {
          LG.g('concrete').floor(tx, ty, tx + 1, ty + 1, colTop, UVS.concrete[0], UVS.concrete[1]);
          void exteriorTile;
        }
      }
    }

    // windows on exterior walls, like the barred ones in the photos
    const edges: Array<{ n: [number, number]; tiles: Array<[number, number]> }> = [
      { n: [0, -1], tiles: Array.from({ length: r.w }, (_, i) => [r.x + i, r.y] as [number, number]) },
      { n: [0, 1], tiles: Array.from({ length: r.w }, (_, i) => [r.x + i, r.y + r.h - 1] as [number, number]) },
      { n: [-1, 0], tiles: Array.from({ length: r.h }, (_, i) => [r.x, r.y + i] as [number, number]) },
      { n: [1, 0], tiles: Array.from({ length: r.h }, (_, i) => [r.x + r.w - 1, r.y + i] as [number, number]) }
    ];
    const winGeo = LG.g('window');
    const propsG = LG.g('props');
    for (const e of edges) {
      const [nx, nz] = e.n;
      for (let k = 1; k + 2 < e.tiles.length; k += 4) {
        const t0 = e.tiles[k];
        const t1 = e.tiles[k + 1];
        const ok = (t: [number, number]) =>
          wallKind(t[0], t[1]) === 1 && !isDoor(t[0], t[1]) && wallKind(t[0] - nx, t[1] - nz) === 0;
        const near = [e.tiles[k - 1], e.tiles[k + 2]];
        if (!ok(t0) || !ok(t1) || near.some((t) => isDoor(t[0], t[1]))) continue;
        const along = nz !== 0 ? t1[0] : t1[1]; // boundary between the two tiles
        const outerPlane = nz !== 0 ? (nz < 0 ? t0[1] : t0[1] + 1) : nx < 0 ? t0[0] : t0[0] + 1;
        const innerPlane = nz !== 0 ? (nz < 0 ? t0[1] + 1 : t0[1]) : nx < 0 ? t0[0] + 1 : t0[0];
        const hw = 0.8;
        const quadAt = (plane: number, y0: number, y1: number, nxv: number, nzv: number) => {
          const o = plane;
          const a: V3 = nz !== 0 ? [along - hw, y0, o] : [o, y0, along - hw];
          const bq: V3 = nz !== 0 ? [along + hw, y0, o] : [o, y0, along + hw];
          const c: V3 = nz !== 0 ? [along + hw, y1, o] : [o, y1, along + hw];
          const d: V3 = nz !== 0 ? [along - hw, y1, o] : [o, y1, along - hw];
          winGeo.quad(a, bq, c, d, [nxv, 0, nzv], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        };
        // inside face (visible from the rooms) for the ground floor
        const nn = nz !== 0 ? nz : nx;
        quadAt(innerPlane - nn * 0.02, 1.15, 2.55, -nx, -nz);
        if (!isUpper) {
          quadAt(outerPlane + nn * 0.02, 1.15, 2.55, nx, nz);
          if (top > WALL_H) quadAt(outerPlane + nn * 0.02, WALL_H + 1.15, WALL_H + 2.55, nx, nz);
          // painted sill
          const sx = nz !== 0 ? along : outerPlane + nx * 0.1;
          const sz = nz !== 0 ? outerPlane + nz * 0.1 : along;
          propsG.box(sx - (nz !== 0 ? 0.9 : 0.11), 1.08, sz - (nz !== 0 ? 0.11 : 0.9), sx + (nz !== 0 ? 0.9 : 0.11), 1.16, sz + (nz !== 0 ? 0.11 : 0.9), COL.blue);
        }
      }
    }

    // roof
    if (!isUpper) {
      const rg = new Geo();
      const oh = 0.8;
      const X0 = r.x - oh;
      const X1 = r.x + r.w + oh;
      const Z0 = r.y - oh;
      const Z1 = r.y + r.h + oh;
      const rise = b.style === 'student' ? 2.1 : 1.5;
      const e = top;
      const W = X1 - X0;
      const H = Z1 - Z0;
      const cx = (X0 + X1) / 2;
      const cz = (Z0 + Z1) / 2;
      let r0: [number, number];
      let r1: [number, number];
      if (W >= H) {
        r0 = [X0 + H / 2, cz];
        r1 = [X1 - H / 2, cz];
      } else {
        r0 = [cx, Z0 + W / 2];
        r1 = [cx, Z1 - W / 2];
      }
      const ridge = e + rise;
      const centre: V3 = [cx, e - 1, cz];
      const out = (p: V3): V3 => [p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]];
      const uv = (p: V3): [number, number] => [(p[0] + p[2]) / 2, p[1] / 1.2];
      const face = (pts: V3[]) => {
        const mid: V3 = [0, 0, 0];
        for (const p of pts) {
          mid[0] += p[0] / pts.length;
          mid[1] += p[1] / pts.length;
          mid[2] += p[2] / pts.length;
        }
        if (pts.length === 4) rg.quad(pts[0], pts[1], pts[2], pts[3], out(mid), pts.map(uv));
        else rg.tri(pts[0], pts[1], pts[2], out(mid), pts.map(uv));
      };
      const c00: V3 = [X0, e, Z0], c10: V3 = [X1, e, Z0], c11: V3 = [X1, e, Z1], c01: V3 = [X0, e, Z1];
      const p0: V3 = [r0[0], ridge, r0[1]];
      const p1: V3 = [r1[0], ridge, r1[1]];
      if (W >= H) {
        face([c01, c11, p1, p0]);
        face([c10, c00, p0, p1]);
        face([c11, c10, p1]);
        face([c00, c01, p0]);
      } else {
        face([c00, c01, p1, p0]);
        face([c11, c10, p0, p1]);
        face([c10, c00, p0]);
        face([c01, c11, p1]);
      }
      const rm = patchCut(
        new THREE.MeshLambertMaterial({ map: tex.roof, color: roofColor[b.style] ?? 0x667b93, transparent: true, side: THREE.DoubleSide })
      );
      addMesh(groundGrp, rg.build(), track(rm), `roof-${b.id}`);
      buildings.push({ id: b.id, rect: r, level: b.level, mat: rm });

      // painted fascia board around the eaves
      const fg = ground.g('occProps');
      const fy0 = e - 0.12;
      const fy1 = e + 0.28;
      fg.box(X0, fy0, Z0, X1, fy1, Z0 + 0.12, COL.blue);
      fg.box(X0, fy0, Z1 - 0.12, X1, fy1, Z1, COL.blue);
      fg.box(X0, fy0, Z0, X0 + 0.12, fy1, Z1, COL.blue);
      fg.box(X1 - 0.12, fy0, Z0, X1, fy1, Z1, COL.blue);
    }
  }

  // ---- upstairs corridor: dark concrete slab down the middle
  {
    const z = M.zones.find((q) => q.id === 'upstairs_hallway');
    if (z) upperG.g('slab').floor(z.rect.x + 3, z.rect.y + 1, z.rect.x + z.rect.w - 3, z.rect.y + 3, 0.026, UVS.slab[0], UVS.slab[1]);
  }

  // ---- doors: dark wooden frames, open leaves, and a blue porch with a sign on the outside doors
  const buildingOf = (d: Door): Building | undefined => M.buildings.find((b) => inRect(b.rect, d.rect.x, d.rect.y));
  const doorLabels: Record<string, string> = { admin: 'ADMINISTRATIVE BLOCK', student_block: 'STUDENT HALL', student_center: 'STUDENT CENTER' };
  for (const d of M.doors) {
    const dg = L(d.rect.y).g('props');
    const horiz = d.rect.w >= d.rect.h;
    const len = horiz ? d.rect.w : d.rect.h;
    // P maps (along the opening, across the wall) to the map
    const P = (a: number, c: number): [number, number] => (horiz ? [d.rect.x + a, d.rect.y + c] : [d.rect.x + c, d.rect.y + a]);
    const boxAC = (a0: number, c0: number, a1: number, c1: number, y0: number, y1: number, col: V3, g: Geo = dg) => {
      const [x0, z0] = P(a0, c0);
      const [x1, z1] = P(a1, c1);
      g.box(Math.min(x0, x1), y0, Math.min(z0, z1), Math.max(x0, x1), y1, Math.max(z0, z1), col);
    };
    boxAC(0, 0, 0.13, 1, 0, DOOR_H, COL.woodDark);
    boxAC(len - 0.13, 0, len, 1, 0, DOOR_H, COL.woodDark);
    boxAC(0, 0, len, 1, DOOR_H - 0.12, DOOR_H, COL.woodDark);

    if (d.kind !== 'exterior') continue;
    const b = buildingOf(d);
    if (!b) continue;
    // which way is "outside"?
    const cxm = d.rect.x + d.rect.w / 2;
    const czm = d.rect.y + d.rect.h / 2;
    const dists: Array<[number, [number, number]]> = [
      [cxm - b.rect.x, [-1, 0]],
      [b.rect.x + b.rect.w - cxm, [1, 0]],
      [czm - b.rect.y, [0, -1]],
      [b.rect.y + b.rect.h - czm, [0, 1]]
    ];
    dists.sort((p, q) => p[0] - q[0]);
    const [onx, onz] = dists[0][1];
    // across-coordinate of the outer face and which sign "across" grows in
    const acrossOut = (horiz ? onz : onx) > 0 ? 1 : 0; // outer face at across=1 when outside is +, else 0
    const sgn = (horiz ? onz : onx) > 0 ? 1 : -1;
    const outerC = acrossOut;
    // open leaves swung outward
    for (const hinge of [0.13, len - 0.13]) {
      const dir = hinge < len / 2 ? 1 : -1;
      boxAC(hinge, outerC, hinge + dir * 0.06, outerC + sgn * 0.9, 0.05, DOOR_H - 0.12, COL.wood);
    }
    // porch
    const pa0 = -0.6;
    const pa1 = len + 0.6;
    const depth = 1.8;
    const slabG = L(d.rect.y).g('concrete');
    {
      const [x0, z0] = P(pa0, outerC);
      const [x1, z1] = P(pa1, outerC + sgn * depth);
      slabG.floor(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), 0.07, UVS.concrete[0], UVS.concrete[1]);
    }
    const og = L(d.rect.y).g('occProps');
    boxAC(pa0, outerC, pa1, outerC + sgn * depth, DOOR_H, DOOR_H + 0.5, COL.blue, og);
    boxAC(pa0 + 0.05, outerC + sgn * (depth - 0.3), pa0 + 0.3, outerC + sgn * (depth - 0.05), 0.07, DOOR_H, COL.blue, og);
    boxAC(pa1 - 0.3, outerC + sgn * (depth - 0.3), pa1 - 0.05, outerC + sgn * (depth - 0.05), 0.07, DOOR_H, COL.blue, og);
    // sign on the front of the porch roof
    const label = doorLabels[b.id];
    if (label) {
      const [sx0, sz0] = P(pa0, outerC + sgn * (depth + 0.01));
      const [sx1, sz1] = P(pa1, outerC + sgn * (depth + 0.01));
      sign(label, '#1f5cae', '#f4f1e4', 512, 96, [sx0, DOOR_H + 0.04, sz0], [sx1, DOOR_H + 0.04, sz1], [sx1, DOOR_H + 0.46, sz1], [sx0, DOOR_H + 0.46, sz0], [onx, 0, onz]);
    }
  }

  // ============================================================ open-air huts
  const huts: HutView[] = [];
  for (const h of M.huts) {
    const g = ground.g('concrete');
    g.add(new THREE.CylinderGeometry(h.r, h.r + 0.1, 0.18, 36), new THREE.Matrix4().makeTranslation(h.cx, 0.09, h.cy), [1, 1, 1], [UVS.concrete[0], UVS.concrete[1]]);
    const pg = ground.g('occProps');
    for (const p of h.pillars) {
      pg.cyl(p.x + 0.5, 0.18, p.y + 0.5, 0.2, 3.0, COL.teal, 0.17, 12);
      pg.cyl(p.x + 0.5, 0.18, p.y + 0.5, 0.27, 0.22, COL.concrete, 0.27, 12);
    }
    const roofR = h.r + 1.5;
    const rg = new Geo();
    rg.add(new THREE.ConeGeometry(roofR, 2.1, 32, 1, true), new THREE.Matrix4().makeTranslation(h.cx, 3.1 + 1.05, h.cy));
    rg.add(new THREE.CylinderGeometry(roofR, roofR, 0.24, 32, 1, true), new THREE.Matrix4().makeTranslation(h.cx, 3.12, h.cy), shade(COL.red, 1));
    const mat = patchCut(new THREE.MeshLambertMaterial({ map: tex.shingle, vertexColors: true, transparent: true, side: THREE.DoubleSide }));
    // the red edge uses the vertex colour; the cone stays shingle-brown through white vertex colour * texture
    addMesh(groundGrp, rg.build(), track(mat), `hut-roof-${h.zone}`);
    huts.push({ zone: h.zone, mat });
  }

  // ============================================================ furniture
  const benchTiles = new Set<string>();
  for (const f of M.furniture) {
    if (f.kind !== 'bench') continue;
    for (let y = f.rect.y; y < f.rect.y + f.rect.h; y++) for (let x = f.rect.x; x < f.rect.x + f.rect.w; x++) benchTiles.add(`${x},${y}`);
  }

  const furnish = (f: Furniture) => {
    const { x, y, w, h } = f.rect;
    const LG = L(y);
    const P = LG.g('props');
    const O = LG.g('occProps');
    const facing = f.facing ?? 'down';
    switch (f.kind) {
      case 'desk': {
        // a school desk: wooden top with writing tablet, on a steel frame
        P.box(x + 0.06, 0.72, y + 0.12, x + 0.94, 0.78, y + 0.9, COL.woodLight);
        for (const [lx, lz] of [[0.1, 0.16], [0.9, 0.16], [0.1, 0.86], [0.9, 0.86]] as const) P.box(x + lx - 0.025, 0, y + lz - 0.025, x + lx + 0.025, 0.72, y + lz + 0.025, COL.metal);
        P.box(x + 0.1, 0.4, y + 0.2, x + 0.9, 0.43, y + 0.82, COL.wood);
        if (rnd() < 0.3) P.obox(x + 0.3 + rnd() * 0.4, 0.795, y + 0.35 + rnd() * 0.3, 0.2, 0.012, 0.28, [0.95, 0.95, 0.9], rnd() * 1.5);
        break;
      }
      case 'whiteboard': {
        if (facing === 'up') {
          // on a south wall, facing north into the room
          const bz = y + h - 0.045;
          LG.g('board').quad([x + 0.3, 1.0, bz], [x + w - 0.3, 1.0, bz], [x + w - 0.3, 2.35, bz], [x + 0.3, 2.35, bz], [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
          P.box(x + 0.26, 0.96, y + h - 0.07, x + w - 0.26, 1.0, y + h, COL.metal);
          P.box(x + 0.26, 2.35, y + h - 0.05, x + w - 0.26, 2.4, y + h, COL.metal);
          break;
        }
        const bz = y + 0.045;
        LG.g('board').quad([x + 0.3, 1.0, bz], [x + w - 0.3, 1.0, bz], [x + w - 0.3, 2.35, bz], [x + 0.3, 2.35, bz], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        P.box(x + 0.26, 0.96, y, x + w - 0.26, 1.0, y + 0.07, COL.metal);
        P.box(x + 0.26, 2.35, y, x + w - 0.26, 2.4, y + 0.05, COL.metal);
        break;
      }
      case 'table':
      case 'small_table': {
        const hv = f.kind === 'table' ? 0.78 : 0.7;
        P.box(x + 0.05, hv - 0.07, y + 0.05, x + w - 0.05, hv, y + h - 0.05, f.kind === 'table' ? COL.wood : COL.woodLight);
        for (const [lx, lz] of [[0.14, 0.14], [w - 0.14, 0.14], [0.14, h - 0.14], [w - 0.14, h - 0.14]] as const) P.box(x + lx - 0.05, 0, y + lz - 0.05, x + lx + 0.05, hv - 0.07, y + lz + 0.05, COL.woodDark);
        break;
      }
      case 'bench': {
        const horizontal = w >= h;
        const c = LG.g('concrete');
        const bx0 = horizontal ? x + 0.05 : x + 0.2;
        const bx1 = horizontal ? x + w - 0.05 : x + w - 0.2;
        const bz0 = horizontal ? y + 0.2 : y + 0.05;
        const bz1 = horizontal ? y + h - 0.2 : y + h - 0.05;
        c.box(bx0, 0, bz0, bx1, 0.46, bz1, [1, 1, 1], UVS.concrete[0], UVS.concrete[1]);
        // low backrest on the side away from where people face
        const [fx, fz] = dirOf[facing];
        if (horizontal) {
          const zb = fz > 0 ? bz0 : bz1 - 0.12;
          c.box(bx0, 0.46, zb, bx1, 0.78, zb + 0.12, [1, 1, 1], UVS.concrete[0], UVS.concrete[1]);
        } else {
          const xb = fx > 0 ? bx0 : bx1 - 0.12;
          c.box(xb, 0.46, bz0, xb + 0.12, 0.78, bz1, [1, 1, 1], UVS.concrete[0], UVS.concrete[1]);
        }
        break;
      }
      case 'counter': {
        P.box(x + 0.05, 0, y + 0.1, x + w - 0.05, 1.0, y + 0.9, COL.wood);
        P.box(x, 1.0, y + 0.05, x + w, 1.07, y + 0.95, COL.white);
        for (let i = 0; i < 4; i++) P.cyl(x + 0.7 + i * 1.1, 1.07, y + 0.5, 0.14, 0.28, [0.8 + rnd() * 0.2, 0.3 + rnd() * 0.4, 0.2], 0.12, 8);
        break;
      }
      case 'stall': {
        // the Back Palaver food stall: wooden kiosk with a metal canopy, open to the south
        const frontZ = y + h;
        P.box(x, 0, y, x + w, 2.5, y + 0.25, COL.teal);
        P.box(x, 0, y, x + 0.25, 2.5, frontZ - 0.3, COL.teal);
        P.box(x + w - 0.25, 0, y, x + w, 2.5, frontZ - 0.3, COL.teal);
        P.box(x + 0.25, 0, frontZ - 1.0, x + w - 0.25, 1.0, frontZ - 0.2, COL.wood);
        P.box(x + 0.15, 1.0, frontZ - 1.1, x + w - 0.15, 1.07, frontZ - 0.1, COL.woodLight);
        for (let i = 0; i < 6; i++) P.cyl(x + 1.2 + i * 1.5, 1.07, frontZ - 0.65, 0.22, 0.3, [0.25, 0.25, 0.28], 0.2, 10);
        for (let i = 0; i < 3; i++) P.cyl(x + 2 + i * 3, 1.07, frontZ - 0.3, 0.13, 0.05 + i * 0.03, [0.92, 0.92, 0.9], 0.13, 10);
        if (x < 20 && y > 30) {
          // the Marketplace stall: red and yellow striped awning and crates of goods on the counter
          for (let i = 0; i < w; i++) O.box(x - 0.4 + i * ((w + 0.8) / w), 2.5, y - 0.2, x - 0.4 + (i + 1) * ((w + 0.8) / w), 2.6, frontZ + 0.5, i % 2 ? COL.yellow : COL.red);
          for (let i = 0; i < 5; i++) P.box(x + 0.8 + i * 1.8, 1.07, frontZ - 0.85, x + 1.6 + i * 1.8, 1.4, frontZ - 0.4, [0.55 + rnd() * 0.3, 0.4 + rnd() * 0.3, 0.15]);
        } else {
          O.box(x - 0.4, 2.5, y - 0.2, x + w + 0.4, 2.6, frontZ + 0.4, shade(COL.metal, 1.3));
          O.box(x - 0.4, 2.45, frontZ + 0.3, x + w + 0.4, 2.65, frontZ + 0.4, COL.blue);
        }
        break;
      }
      case 'shelf': {
        const zc = M.zones.find((q) => q.id === 'library');
        const faceSouth = zc ? y + 0.5 < zc.rect.y + zc.rect.h / 2 : true;
        const z0 = y + 0.2;
        const z1 = y + 0.8;
        P.box(x, 0, z0, x + w, 2.1, z1, COL.wood);
        const fz = faceSouth ? z1 + 0.012 : z0 - 0.012;
        LG.g('books').quad([x + 0.05, 0.1, fz], [x + w - 0.05, 0.1, fz], [x + w - 0.05, 2.0, fz], [x + 0.05, 2.0, fz], [0, 0, faceSouth ? 1 : -1], [[0, 0], [w / 2, 0], [w / 2, 1], [0, 1]]);
        break;
      }
      case 'filing': {
        P.box(x, 0, y + 0.2, x + w, 1.45, y + 0.8, rgb(0x7b8a86));
        for (let i = 0; i <= w; i++) P.box(x + i - 0.01 + (i === w ? -0.02 : 0), 0.05, y + 0.8, x + i + 0.02, 1.4, y + 0.82, COL.dark);
        for (let i = 0; i < w; i++) for (const yy of [0.35, 0.75, 1.1]) P.box(x + i + 0.35, yy, y + 0.82, x + i + 0.65, yy + 0.04, y + 0.86, COL.dark);
        break;
      }
      case 'stacked_chairs': {
        for (let i = 0; i < Math.max(w, h); i++) {
          const cxm = w >= h ? x + i + 0.5 : x + 0.5;
          const czm = w >= h ? y + 0.5 : y + i + 0.5;
          for (let k = 0; k < 5; k++) chairInto(P, cxm + (rnd() - 0.5) * 0.04, 0.1 * k, czm + (rnd() - 0.5) * 0.04, Math.PI / 2 + (rnd() - 0.5) * 0.1, COL.wood);
        }
        break;
      }
      case 'bucket':
        P.cyl(x + 0.5, 0, y + 0.5, 0.2, 0.34, rgb(0xc42b25), 0.26, 12);
        break;
      case 'hedge': {
        const hg = LG.g('hedge');
        hg.box(x, 0, y + 0.1, x + w, 0.95, y + 0.9, [1, 1, 1], UVS.hedge[0], UVS.hedge[1]);
        break;
      }
      case 'post': {
        const c = LG.g('concrete');
        c.box(x + 0.1, 0, y + 0.1, x + 0.9, 2.4, y + 0.9, [1, 1, 1], UVS.concrete[0], UVS.concrete[1]);
        c.box(x, 2.4, y, x + 1, 2.55, y + 1, [1, 1, 1], UVS.concrete[0], UVS.concrete[1]);
        O.box(x + 0.1, 0.5, y + 0.1, x + 0.9, 1.0, y + 0.9, COL.blue);
        break;
      }
      case 'car':
        buildCar(P, x + w / 2, y + h / 2, 0, rgb(0x1d63d6));
        break;
      case 'motorcycle':
        buildMoto(P, x + w / 2, y + h / 2, 0, rgb(0xc7352b));
        break;
      case 'loader':
        buildLoader(P, x + w / 2, y + h / 2);
        break;
      case 'stairs':
        buildStairs(LG, f);
        break;
      case 'stage':
        V.stageInto(O, f);
        break;
      case 'speaker':
        V.speakerInto(O, f);
        break;
      case 'dj_booth':
        V.djBoothInto(P, f);
        break;
      case 'rope_post':
        V.ropePostInto(P, f);
        break;
      case 'goal': {
        // football goal: two posts, a crossbar and a see-through net frame one tile deep
        const front = facing === 'right' ? x + w : x;
        const back = facing === 'right' ? x : x + w;
        const wh: V3 = [0.96, 0.96, 0.94];
        const net: V3 = [0.8, 0.82, 0.8];
        for (const zz of [y, y + h]) P.box(front - 0.06, 0, zz - 0.06, front + 0.06, 2.15, zz + 0.06, wh);
        P.box(front - 0.06, 2.09, y - 0.06, front + 0.06, 2.21, y + h + 0.06, wh);
        for (const zz of [y, y + h]) P.box(Math.min(front, back) - 0.02, 0, zz - 0.02, Math.max(front, back) + 0.02, 0.03, zz + 0.02, net);
        P.box(back - 0.02, 0, y, back + 0.02, 1.9, y + h, [0.72, 0.74, 0.72]);
        for (let i = 1; i < 5; i++) P.box(Math.min(front, back), 0, y + (i * h) / 5 - 0.01, Math.max(front, back), 1.9, y + (i * h) / 5 + 0.01, net);
        break;
      }
      case 'track': {
        // sprint track: a pale dirt strip with lane lines, a start line, and a flag at the turning end
        const dirt: V3 = [0.72, 0.6, 0.42];
        const line: V3 = [0.95, 0.95, 0.92];
        P.box(x, 0, y, x + w, 0.03, y + h, dirt);
        for (let i = 0; i <= 3; i++) P.box(x + 0.4, 0.03, y + (i * h) / 3 - 0.04, x + w - 0.4, 0.045, y + (i * h) / 3 + 0.04, line);
        P.box(x + 1.3, 0.03, y, x + 1.5, 0.05, y + h, line); // start line
        P.box(x + w - 1.0, 0.03, y, x + w - 0.8, 0.05, y + h, [0.9, 0.3, 0.25]); // turning line
        P.box(x + w - 0.95, 0, y + h / 2 - 0.05, x + w - 0.85, 2.4, y + h / 2 + 0.05, COL.metal);
        P.box(x + w - 0.85, 1.7, y + h / 2 - 0.02, x + w - 0.1, 2.35, y + h / 2 + 0.02, [0.9, 0.2, 0.15]);
        P.box(x + 1.0, 0, y - 0.3, x + 1.2, 2.2, y - 0.1, COL.metal);
        P.box(x + 1.0, 0, y + h + 0.1, x + 1.2, 2.2, y + h + 0.3, COL.metal);
        P.box(x + 1.0, 2.0, y - 0.3, x + 1.2, 2.2, y + h + 0.3, [0.95, 0.85, 0.2]); // start gantry
        break;
      }
      case 'carousel':
        break; // drawn and spun by the game scene
      case 'jobskiosk': {
        // The Campus Jobs Board: a roofed kiosk with three cork boards of paper notes, a counter and a clerk behind it.
        const frontZ = y + h;
        const cork: V3 = [0.66, 0.48, 0.28];
        P.box(x, 0, y, x + w, 2.9, y + 0.25, COL.teal);
        P.box(x, 0, y, x + 0.25, 2.9, frontZ - 0.3, COL.teal);
        P.box(x + w - 0.25, 0, y, x + w, 2.9, frontZ - 0.3, COL.teal);
        const bw = (w - 1.2) / 3;
        const noteCols: V3[] = [[0.95, 0.95, 0.9], [0.98, 0.9, 0.5], [0.7, 0.88, 0.95], [0.97, 0.7, 0.7], [0.75, 0.93, 0.75]];
        for (let b = 0; b < 3; b++) {
          const bx = x + 0.6 + b * (bw + 0.0);
          P.box(bx + 0.08, 0.95, y + 0.25, bx + bw - 0.08, 2.5, y + 0.33, [0.42, 0.28, 0.14]);
          P.box(bx + 0.16, 1.03, y + 0.33, bx + bw - 0.16, 2.42, y + 0.36, cork);
          for (let i = 0; i < 9; i++) P.obox(bx + 0.4 + rnd() * (bw - 0.8), 1.2 + rnd() * 1.0, y + 0.39, 0.3 + rnd() * 0.12, 0.34 + rnd() * 0.12, 0.02, noteCols[i % 5], (rnd() - 0.5) * 0.4);
        }
        P.box(x + 0.25, 0, frontZ - 1.0, x + w - 0.25, 1.0, frontZ - 0.2, COL.wood);
        P.box(x + 0.15, 1.0, frontZ - 1.1, x + w - 0.15, 1.07, frontZ - 0.1, COL.woodLight);
        for (let i = 0; i < 4; i++) P.obox(x + 1.2 + i * 2.1, 1.09, frontZ - 0.6, 0.3, 0.02, 0.4, noteCols[i % 5], (rnd() - 0.5) * 0.5);
        // canopy roof with posts and a sign board on the front
        for (const px of [x - 0.2, x + w - 0.1]) P.box(px, 0, frontZ + 0.3, px + 0.3, 3.0, frontZ + 0.6, COL.teal);
        O.box(x - 0.5, 2.9, y - 0.2, x + w + 0.5, 3.05, frontZ + 0.7, COL.blue);
        O.box(x - 0.5, 3.05, y + 0.6, x + w + 0.5, 3.3, frontZ + 0.7, shade(COL.metal, 1.2));
        O.box(x + 0.4, 3.35, frontZ + 0.55, x + w - 0.4, 4.35, frontZ + 0.7, COL.woodDark);
        sign('CAMPUS JOBS BOARD', '#1d3f78', '#ffe08a', 1024, 200, [x + 0.5, 3.4, frontZ + 0.712], [x + w - 0.5, 3.4, frontZ + 0.712], [x + w - 0.5, 4.3, frontZ + 0.712], [x + 0.5, 4.3, frontZ + 0.712], [0, 0, 1], '#ffe08a');
        break;
      }
      case 'lectern': {
        // a low platform with a wooden lectern and a microphone
        P.box(x - 0.8, 0, y - 0.5, x + w + 0.8, 0.15, y + h + 1.1, shade(COL.concrete, 1.05));
        P.box(x + 0.35, 0.15, y + 0.1, x + w - 0.35, 1.2, y + 0.8, COL.wood);
        P.box(x + 0.25, 1.2, y + 0.05, x + w - 0.25, 1.28, y + 0.9, COL.woodLight);
        P.cyl(x + w / 2, 1.28, y + 0.45, 0.012, 0.3, COL.dark, 0.012, 6);
        P.cyl(x + w / 2, 1.58, y + 0.45, 0.04, 0.08, COL.dark, 0.04, 8);
        break;
      }
      case 'noticeboard': {
        // a cork board on the Student Hall's west wall, covered in notes
        P.box(x, 0.95, y + 0.15, x + 0.1, 2.25, y + h - 0.15, [0.42, 0.28, 0.14]);
        P.box(x + 0.1, 1.05, y + 0.25, x + 0.14, 2.15, y + h - 0.25, [0.66, 0.48, 0.28]);
        const cols: V3[] = [[0.95, 0.95, 0.9], [0.98, 0.9, 0.5], [0.7, 0.88, 0.95], [0.97, 0.7, 0.7]];
        for (let i = 0; i < 11; i++) P.obox(x + 0.17, 1.2 + rnd() * 0.85, y + 0.45 + rnd() * (h - 0.9), 0.02, 0.2 + rnd() * 0.12, 0.17 + rnd() * 0.1, cols[i % 4], 0, (rnd() - 0.5) * 0.3);
        sign('JOBS BOARD', '#1d3f78', '#ffe08a', 512, 128, [x + 0.21, 2.3, y + h - 0.2], [x + 0.21, 2.3, y + 0.2], [x + 0.21, 2.85, y + 0.2], [x + 0.21, 2.85, y + h - 0.2], [1, 0, 0], '#ffe08a');
        break;
      }
      default:
        break;
    }
  };

  // ---- shared little builders
  function chairInto(g: Geo, cx: number, y0: number, cz: number, yaw: number, col: V3) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    // local (lx, lz) -> world, front = +z
    const W = (lx: number, lz: number): [number, number] => [cx + lx * c + lz * s, cz - lx * s + lz * c];
    const bx = (lx0: number, lz0: number, lx1: number, lz1: number, ya: number, yb: number, cc: V3) => {
      const [x0, z0] = W(lx0, lz0);
      const [x1, z1] = W(lx1, lz1);
      const cxm = (x0 + x1) / 2;
      const czm = (z0 + z1) / 2;
      g.obox(cxm, y0 + (ya + yb) / 2, czm, Math.abs(lx1 - lx0), yb - ya, Math.abs(lz1 - lz0), cc, yaw);
    };
    bx(-0.22, -0.22, 0.22, 0.22, 0.43, 0.48, col); // seat
    for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]] as const) bx(lx - 0.025, lz - 0.025, lx + 0.025, lz + 0.025, 0, 0.43, shade(col, 0.8));
    bx(-0.22, -0.24, -0.18, -0.2, 0.48, 0.95, shade(col, 0.9)); // back posts
    bx(0.18, -0.24, 0.22, -0.2, 0.48, 0.95, shade(col, 0.9));
    bx(-0.2, -0.25, 0.2, -0.21, 0.62, 0.7, col); // slats
    bx(-0.2, -0.25, 0.2, -0.21, 0.78, 0.86, col);
  }

  function buildCar(g: Geo, cx: number, cz: number, yaw: number, body: V3) {
    const glass = rgb(0x1a2a36);
    g.obox(cx, 0.55, cz, 4.0, 0.62, 1.75, body, yaw);
    g.obox(cx - 0.1, 1.1, cz, 2.2, 0.5, 1.55, body, yaw);
    g.obox(cx - 0.1, 1.12, cz, 2.0, 0.34, 1.6, glass, yaw);
    g.obox(cx + 1.98, 0.5, cz, 0.06, 0.18, 1.5, rgb(0xe9e6c8), yaw);
    g.obox(cx - 1.98, 0.5, cz, 0.06, 0.18, 1.5, rgb(0x8a1c1c), yaw);
    for (const [wx, wz] of [[1.25, 0.82], [1.25, -0.82], [-1.25, 0.82], [-1.25, -0.82]] as const) {
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      const m = new THREE.Matrix4().makeTranslation(cx + wx * c + wz * s, 0.32, cz - wx * s + wz * c).multiply(new THREE.Matrix4().makeRotationY(yaw)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      g.add(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12), m, COL.dark);
    }
  }

  function buildMoto(g: Geo, cx: number, cz: number, yaw: number, body: V3) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const Wp = (lx: number, lz: number): [number, number] => [cx + lx * c + lz * s, cz - lx * s + lz * c];
    for (const lx of [-0.55, 0.55]) {
      const [wx, wz] = Wp(lx, 0);
      const m = new THREE.Matrix4().makeTranslation(wx, 0.3, wz).multiply(new THREE.Matrix4().makeRotationY(yaw)).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
      g.add(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12), m, COL.dark);
    }
    const mid = Wp(0, 0);
    g.obox(mid[0], 0.55, mid[1], 1.1, 0.12, 0.18, body, yaw);
    const tank = Wp(0.15, 0);
    g.obox(tank[0], 0.78, tank[1], 0.45, 0.2, 0.26, body, yaw);
    const seat = Wp(-0.25, 0);
    g.obox(seat[0], 0.76, seat[1], 0.5, 0.1, 0.24, COL.dark, yaw);
    const bar = Wp(0.58, 0);
    g.obox(bar[0], 0.98, bar[1], 0.08, 0.06, 0.6, COL.metal, yaw);
    g.obox(bar[0], 0.65, bar[1], 0.05, 0.7, 0.05, COL.metal, yaw);
  }

  function buildLoader(g: Geo, cx: number, cz: number) {
    const yel = rgb(0xe3ad14);
    g.obox(cx, 0.95, cz, 3.0, 0.9, 2.0, yel);
    g.obox(cx - 0.5, 1.8, cz, 1.4, 1.1, 1.6, yel);
    g.obox(cx - 0.5, 1.85, cz, 1.3, 0.8, 1.7, rgb(0x1a2a36));
    g.obox(cx + 2.0, 0.55, cz, 1.0, 0.5, 2.4, shade(yel, 0.85));
    g.obox(cx + 1.4, 1.0, cz - 0.75, 1.6, 0.14, 0.14, COL.metal, 0, -0.25);
    g.obox(cx + 1.4, 1.0, cz + 0.75, 1.6, 0.14, 0.14, COL.metal, 0, -0.25);
    for (const [wx, wz] of [[1.0, 1.1], [1.0, -1.1], [-1.0, 1.1], [-1.0, -1.1]] as const) {
      const m = new THREE.Matrix4().makeTranslation(cx + wx, 0.6, cz + wz).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      g.add(new THREE.CylinderGeometry(0.6, 0.6, 0.45, 14), m, COL.dark);
    }
  }

  function buildStairs(LG: LevelGeo, f: Furniture) {
    const { x, y, w, h } = f.rect;
    const P = LG.g('props');
    const tread = rgb(0x4a3322);
    const riser = rgb(0xd7d3c6);
    if (f.facing === 'up') {
      // a steep straight flight climbing north, white rail along the left (west) wall
      const n = h;
      for (let i = 0; i < n; i++) {
        const zS = y + h - i; // southern edge of step i
        const yTop = ((i + 1) * STAIR_RISE) / n;
        const yPrev = (i * STAIR_RISE) / n;
        P.floor(x, zS - 1, x + w, zS, yTop, 1, 1, tread);
        P.wall(x, zS, x + w, zS, yPrev, yTop, 0, 1, 1, 1, riser);
      }
      const rise = STAIR_RISE;
      const depth = h;
      const len = Math.hypot(rise, depth);
      const rx = x + 0.12;
      P.obox(rx, 0.95 + rise / 2, y + h / 2, 0.05, 0.05, len, [0.92, 0.92, 0.92], 0, Math.atan2(rise, depth));
      for (let i = 0; i <= n; i += 2) {
        const zz = y + h - i;
        const yy = (i * STAIR_RISE) / n;
        P.cyl(rx, yy, zz, 0.025, 0.95, [0.92, 0.92, 0.92], 0.025, 6);
      }
    } else {
      // the stairwell going down at the end of the upstairs corridor
      P.floor(x, y, x + w, y + h, 0.03, 1, 1, rgb(0x2a2a2d));
      for (let i = 0; i < 4; i++) P.floor(x + i * (w / 4), y, x + i * (w / 4) + 0.08, y + h, 0.035, 1, 1, rgb(0x777269));
      for (let i = 0; i <= 3; i++) P.cyl(x + 0.1 + (i * (w - 0.2)) / 3, 0.03, y + 0.05, 0.025, 0.95, [0.92, 0.92, 0.92], 0.025, 6);
      P.obox(x + w / 2, 0.98, y + 0.05, w, 0.05, 0.05, [0.92, 0.92, 0.92]);
    }
  }

  for (const f of M.furniture) furnish(f);

  // ---- chairs: one instanced mesh per floor, built from the seats so they always match where people sit
  const chairGeo = new Geo();
  chairInto(chairGeo, 0, 0, 0, 0, COL.wood);
  const chairBuf = track(chairGeo.build());
  const chairMat = patchCut(lambert({ map: tex.grain, vertexColors: true }));
  track(chairMat);
  const makeChairs = (lvl: Level, grp: THREE.Group, geo: LevelGeo) => {
    const seats = M.seats.filter((s) => {
      const tx = Math.floor(s.x / TILE);
      const ty = Math.floor(s.y / TILE);
      return levelOfRow(ty) === lvl && !benchTiles.has(`${tx},${ty}`);
    });
    if (!seats.length) return;
    const im = new THREE.InstancedMesh(chairBuf, chairMat, seats.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    seats.forEach((s, i) => {
      const yaw = yawOf[s.facing] + (rnd() - 0.5) * 0.22;
      e.set(0, yaw, 0);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(s.x * U + (rnd() - 0.5) * 0.1, 0, s.y * U + (rnd() - 0.5) * 0.1), q, new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, m);
      const k = 0.8 + rnd() * 0.45;
      im.setColorAt(i, col.setRGB(k, k * (0.95 + rnd() * 0.1), k * (0.9 + rnd() * 0.15)));
      // a bag left on some chairs
      if (rnd() < 0.12) {
        const [fx, fz] = dirOf[s.facing];
        geo.g('props').obox(s.x * U - fx * 0.27, 0.68, s.y * U - fz * 0.27, 0.34, 0.4, 0.14, [0.2 + rnd() * 0.6, 0.2 + rnd() * 0.4, 0.2 + rnd() * 0.5], yawOf[s.facing]);
      }
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    grp.add(im);
  };
  makeChairs('ground', groundGrp, ground);
  makeChairs('upper', upperGrp, upperG);

  {
    const posts = M.furniture.filter((f) => f.kind === 'rope_post');
    V.ropesInto(ground.g('props'), posts);
  }

  // ============================================================ signs
  for (const s of M.signs) {
    if (s.kind === 'banner') {
      const x = s.x;
      const z = s.y;
      ground.g('concrete').box(x - 3.4, 0, z - 0.22, x + 3.4, 1.15, z + 0.22, [1, 1, 1], UVS.concrete[0], UVS.concrete[1]);
      const fz = z + 0.24;
      sign('WELCOME  ·  BCC  ·  ENTRANCE', '#f1efe6', '#1f5cae', 1024, 160, [x - 3.2, 0.15, fz], [x + 3.2, 0.15, fz], [x + 3.2, 1.05, fz], [x - 3.2, 1.05, fz], [0, 0, 1], '#1f5cae');
    } else if (s.kind === 'plaque') {
      // brass plaque flat on the wall, facing whichever side people can walk
      const tx = Math.floor(s.x);
      const ty = Math.floor(s.y);
      const south = s.face ? s.face === 'south' : !M.blocked[(ty + 1) * MAP_W + tx];
      const zf = south ? ty + 1.015 : ty - 0.015;
      const n: V3 = [0, 0, south ? 1 : -1];
      const hw = (s.w ?? 1.3) / 2;
      const two = s.text.includes('\n');
      const y1 = two ? 2.1 : 1.95;
      sign(s.text, '#b08d3c', '#2a1c08', 512, two ? 160 : 128, [s.x - hw, 1.6, zf], [s.x + hw, 1.6, zf], [s.x + hw, y1, zf], [s.x - hw, y1, zf], n, '#6d531c');
    } else if (s.kind === 'label' && ['Palaver Hut', 'Back Palaver', 'Marketplace', 'Recreation Ground', 'Social Ground', 'Lecture Area'].includes(s.text)) {
      const x = s.x;
      const z = s.y;
      const g = ground.g('occProps');
      const fz = z + 0.06;
      const hw = s.text.length > 13 ? 1.25 : 0.8;
      g.box(x - hw - 0.1, 0, z - 0.05, x - hw + 0.02, 1.7, z + 0.05, COL.woodDark);
      g.box(x + hw - 0.02, 0, z - 0.05, x + hw + 0.1, 1.7, z + 0.05, COL.woodDark);
      sign(s.text.toUpperCase(), '#1d5a52', '#f1efe6', s.text.length > 13 ? 768 : 512, 128, [x - hw, 1.05, fz], [x + hw, 1.05, fz], [x + hw, 1.6, fz], [x - hw, 1.6, fz], [0, 0, 1], '#e8e2cc');
    }
  }

  // notice boards: loose papers pinned near the plaques (lived-in details)
  for (const s of M.signs) {
    if (s.kind !== 'plaque') continue;
    const tx = Math.floor(s.x);
    const ty = Math.floor(s.y);
    const south = s.face ? s.face === 'south' : !M.blocked[(ty + 1) * MAP_W + tx];
    const zf = south ? ty + 1.012 : ty - 0.012;
    const g = L(ty).g('props');
    const side = s.face ? -1 : 1; // upstairs the plaque hugs a doorway, so pin the papers on the far side
    for (let i = 0; i < 3; i++) {
      const px = s.x + side * ((s.w ?? 1.3) / 2 + 0.25 + i * 0.28) + rnd() * 0.05;
      g.obox(px, 1.4 + rnd() * 0.3, zf + (south ? 0.004 : -0.004), 0.2, 0.28, 0.004, [0.93, 0.93 - rnd() * 0.1, 0.85 - rnd() * 0.2], 0, 0);
    }
  }

  // ---- little lived-in things: wrappers, papers, bottles on the floor
  const litterCols: V3[] = [rgb(0xf3f1e6), rgb(0xc8362c), rgb(0x2a6bc0), rgb(0xe8b21c), rgb(0x6b4a2f), rgb(0x2e8b57)];
  const scatter = (zoneId: string, count: number, lvl: Level) => {
    const z = M.zones.find((q) => q.id === zoneId);
    if (!z) return;
    let placed = 0;
    for (let tries = 0; tries < count * 12 && placed < count; tries++) {
      const tx = z.rect.x + Math.floor(rnd() * z.rect.w);
      const ty = z.rect.y + Math.floor(rnd() * z.rect.h);
      if (M.blocked[ty * MAP_W + tx]) continue;
      const g = (lvl === 'upper' ? upperG : ground).g('props');
      const px = tx + rnd();
      const pz = ty + rnd();
      const sz = 0.1 + rnd() * 0.12;
      if (rnd() < 0.25) g.cyl(px, 0.02, pz, 0.035, 0.2, [0.4, 0.7, 0.55], 0.03, 6); // a bottle
      else g.obox(px, 0.025, pz, sz, 0.008, sz * (0.6 + rnd() * 0.6), litterCols[Math.floor(rnd() * litterCols.length)], rnd() * 3);
      placed++;
    }
  };
  scatter('student_center', 36, 'ground');
  scatter('back_palaver', 26, 'ground');
  scatter('palaver_hut', 14, 'ground');
  scatter('student_hall', 14, 'ground');
  scatter('admin_hall', 6, 'ground');
  scatter('library', 8, 'upper');
  scatter('upstairs_hallway', 4, 'upper');

  // ---- extra parked vehicles from the reference photos: motorbikes and a dark SUV near the Student Block
  {
    const g = ground.g('props');
    buildMoto(g, 32.6, 25.2, 0.6, rgb(0xc7352b));
    buildMoto(g, 54.6, 24.7, -2.2, rgb(0x232427));
    buildMoto(g, 55.4, 26.4, 2.5, rgb(0xc7352b));
    buildCar(g, 60.2, 27.0, -0.2, rgb(0x15161a));
  }

  // ---- the event banner on the stage backdrop
  {
    const st = M.furniture.find((f) => f.kind === 'stage');
    if (st) {
      const bx = st.rect.x + st.rect.w - 0.36;
      const z0 = st.rect.y + 1.2;
      const z1 = st.rect.y + st.rect.h - 1.2;
      sign('STUDENT CENTER  LIVE', '#2a1342', '#ffd34d', 1024, 128, [bx, 1.55, z0], [bx, 1.55, z1], [bx, 2.45, z1], [bx, 2.45, z0], [-1, 0, 0], '#ffd34d');
    }
  }

  // ---- the Recreation Ground: mown stripes and white lines
  {
    const r = M.rec.pitch;
    const g = ground.g('props');
    for (let i = 0; i < r.w; i += 2) g.box(r.x + i, 0.012, r.y, r.x + Math.min(i + 1, r.w), 0.02, r.y + r.h, [0.62, 0.86, 0.6]);
    const line = (x0: number, z0: number, x1: number, z1: number) => g.box(x0, 0.02, z0, x1, 0.028, z1, [0.97, 0.97, 0.95]);
    const t = 0.07;
    line(r.x, r.y, r.x + r.w, r.y + t);
    line(r.x, r.y + r.h - t, r.x + r.w, r.y + r.h);
    line(r.x, r.y, r.x + t, r.y + r.h);
    line(r.x + r.w - t, r.y, r.x + r.w, r.y + r.h);
    line(r.x + r.w / 2 - t / 2, r.y, r.x + r.w / 2 + t / 2, r.y + r.h);
    const gy0 = M.rec.goalY0 - 1.2;
    const gy1 = M.rec.goalY1 + 1.2;
    for (const [xa, xb] of [[r.x, r.x + 2.5], [r.x + r.w - 2.5, r.x + r.w]] as const) {
      line(xa, gy0, xb, gy0 + t);
      line(xa, gy1 - t, xb, gy1);
    }
    line(r.x + 2.5 - t, gy0, r.x + 2.5, gy1);
    line(r.x + r.w - 2.5, gy0, r.x + r.w - 2.5 + t, gy1);
  }

  // ---- puddles
  for (const p of M.puddles) {
    const g = ground.g('puddle');
    const m = new THREE.Matrix4()
      .makeTranslation(p.x + 0.5, 0.022, p.y + 0.5)
      .multiply(new THREE.Matrix4().makeRotationY(rnd() * 3))
      .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
      .multiply(new THREE.Matrix4().makeScale(0.6 + rnd() * 0.5, 0.5 + rnd() * 0.3, 1));
    g.add(new THREE.CircleGeometry(0.75, 16), m);
  }

  // ============================================================ street lamps (they glow at night)
  const lampSpots: Array<[number, number]> = [];
  {
    const taken: Array<[number, number]> = [];
    const tryLamp = (x: number, y: number) => {
      if (y >= GROUND_H - 1 || isBlockedTile(M, Math.floor(x), Math.floor(y))) return;
      if (taken.some(([a, b]) => Math.hypot(a - x, b - y) < 9)) return;
      taken.push([x, y]);
      lampSpots.push([x, y]);
    };
    for (const p of M.paths) {
      if (p.w >= p.h) for (let x = p.x + 3; x < p.x + p.w - 1; x += 10) tryLamp(x + 0.5, p.y - 0.6);
      else for (let y = p.y + 3; y < p.y + p.h - 1; y += 10) tryLamp(p.x - 0.6, y + 0.5);
    }
    lampSpots.length = Math.min(lampSpots.length, 36);
    const pg = ground.g('props');
    for (const [x, z] of lampSpots) {
      pg.cyl(x, 0, z, 0.07, 3.1, rgb(0x2b2f36), 0.05, 8);
      pg.obox(x, 3.2, z, 0.3, 0.12, 0.3, rgb(0x2b2f36));
      pg.obox(x, 3.12, z, 0.2, 0.05, 0.2, rgb(0xfff0c0));
    }
  }
  const lampGroup = new THREE.Group();
  lampGroup.visible = false;
  const lampMat = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const gr = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,236,170,1)');
    gr.addColorStop(0.25, 'rgba(255,210,120,0.55)');
    gr.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    track(t);
    return track(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  })();
  for (const [x, z] of lampSpots) {
    const sp = new THREE.Sprite(lampMat);
    sp.position.set(x, 3.05, z);
    sp.scale.set(3.2, 3.2, 1);
    lampGroup.add(sp);
  }
  groundGrp.add(lampGroup);
  // the pool of light each lamp throws on the ground
  const poolGroup = new THREE.Group();
  poolGroup.visible = false;
  const poolMat = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const gr = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,214,130,0.42)');
    gr.addColorStop(1, 'rgba(255,214,130,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    track(t);
    return track(new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  })();
  const poolGeo = track(new THREE.PlaneGeometry(6, 6));
  for (const [x, z] of lampSpots) {
    const m = new THREE.Mesh(poolGeo, poolMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.03, z);
    poolGroup.add(m);
  }
  groundGrp.add(poolGroup);
  const winMat = mats.window as THREE.MeshLambertMaterial;
  winMat.emissiveMap = tex.window;
  let lastNight = -1;
  const setNight = (n: number) => {
    const k = Math.round(Math.min(1, Math.max(0, n)) * 40) / 40;
    if (k === lastNight) return;
    lastNight = k;
    winMat.emissive.setHex(0xffb35c).multiplyScalar(k * 0.95);
    const on = Math.min(1, Math.max(0, (k - 0.1) / 0.5));
    lampGroup.visible = poolGroup.visible = on > 0.02;
    lampMat.opacity = on;
    poolMat.opacity = on;
  };

  // ============================================================ assemble the static meshes
  for (const [grp, lg] of [[groundGrp, ground], [upperGrp, upperG]] as const) {
    for (const [key, geo] of lg.entries()) {
      const mesh = addMesh(grp, geo.build(), mats[key], key);
      if (key === 'grass' || key === 'puddle') mesh.frustumCulled = false;
    }
  }
  for (const m of Object.values(mats)) track(m);
  for (const t of Object.values(tex)) track(t);

  // ============================================================ the Student Center show area (party-mode lights)
  const venue = V.createVenue(M);
  groundGrp.add(venue.group);
  track(venue);

  // ============================================================ trees (instanced), grass tufts, hills, sky
  buildNature(groundGrp, rnd, track, patchCut, lambert);

  // sky dome
  const skyMat = new THREE.MeshBasicMaterial({ map: tex.sky, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(track(new THREE.SphereGeometry(600, 24, 12)), track(skyMat));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  root.add(sky);

  const stairs = M.furniture.find((f) => f.kind === 'stairs' && f.facing === 'up');
  const heightAt = (x: number, z: number): number => {
    if (!stairs) return 0;
    const r = stairs.rect;
    if (x < r.x || x > r.x + r.w || z < r.y || z > r.y + r.h) return 0;
    return Math.max(0, Math.min(STAIR_RISE, ((r.y + r.h - z) / r.h) * STAIR_RISE));
  };

  const setLevel = (level: Level) => {
    groundGrp.visible = level === 'ground';
    upperGrp.visible = level === 'upper';
    sky.visible = level === 'ground';
  };
  setLevel('ground');

  return {
    root,
    ground: groundGrp,
    upper: upperGrp,
    sky,
    buildings,
    huts,
    heightAt,
    venue,
    setLevel,
    setNight,
    dispose() {
      for (const d of disposables) d.dispose();
    }
  };
}

// ------------------------------------------------------------------ trees, tufts, hills
function buildNature(
  grp: THREE.Group,
  rnd: () => number,
  track: <X extends { dispose(): void }>(x: X) => X,
  patch: <X extends THREE.Material>(m: X) => X,
  lambert: (p: THREE.MeshLambertMaterialParameters) => THREE.MeshLambertMaterial
) {
  const greens = [rgb(0x2f6b2e), rgb(0x3d7a35), rgb(0x4e8a3c), rgb(0x2a5f2b)];
  const palmGreens = [rgb(0x3a7a2c), rgb(0x4d8f35), rgb(0x2f6a28)];

  const palmCrown = (fronds: number, segs: number) => {
    const g = new Geo();
    for (let f = 0; f < fronds; f++) {
      const a = (f / fronds) * Math.PI * 2 + (f % 2) * 0.2;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const L = 2.4 + (f % 3) * 0.25;
      const droop = 0.9 + (f % 2) * 0.3;
      const col = palmGreens[f % palmGreens.length];
      const pt = (t: number): V3 => [dx * L * t, 0.35 + Math.sin(t * 2.2) * 0.55 - droop * t * t, dz * L * t];
      for (let i = 0; i < segs; i++) {
        const t0 = i / segs;
        const t1 = (i + 1) / segs;
        const w0 = 0.07 + 0.42 * Math.pow(Math.sin(Math.PI * Math.min(1, t0 * 0.92 + 0.08)), 0.8);
        const w1 = 0.07 + 0.42 * Math.pow(Math.sin(Math.PI * Math.min(1, t1 * 0.92 + 0.08)), 0.8);
        const p0 = pt(t0);
        const p1 = pt(t1);
        const px = -dz;
        const pz = dx;
        g.quad(
          [p0[0] - px * w0, p0[1], p0[2] - pz * w0], [p0[0] + px * w0, p0[1], p0[2] + pz * w0],
          [p1[0] + px * w1, p1[1], p1[2] + pz * w1], [p1[0] - px * w1, p1[1], p1[2] - pz * w1],
          [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], shade(col, 0.85 + 0.3 * t1)
        );
      }
    }
    return track(g.build());
  };
  const treeCrown = (detail: number) => {
    const g = new Geo();
    const blobs: Array<[number, number, number, number]> = [[0, 0, 0, 1.0], [0.55, -0.2, 0.25, 0.72], [-0.45, 0.1, -0.35, 0.78], [0.1, 0.55, -0.1, 0.6]];
    blobs.forEach(([bx, by, bz, br], i) => {
      const m = new THREE.Matrix4().makeTranslation(bx * 1.4, by * 1.2, bz * 1.4).multiply(new THREE.Matrix4().makeScale(br * 1.9, br * 1.45, br * 1.9));
      const ico = new THREE.IcosahedronGeometry(1, detail);
      g.add(ico, m, shade(greens[i % greens.length], 0.9 + rnd() * 0.2));
      ico.dispose();
    });
    return track(g.build());
  };
  const trunk = (r0: number, r1: number) => {
    const g = new THREE.CylinderGeometry(r1, r0, 1, 7, 1);
    g.translate(0, 0.5, 0);
    const n = g.getAttribute('position').count;
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n * 3 }, (_, i) => [0.36, 0.26, 0.18][i % 3]), 3));
    return track(g);
  };

  const mats = {
    palm: track(patch(lambert({ vertexColors: true, side: THREE.DoubleSide }))),
    crown: track(patch(lambert({ vertexColors: true, flatShading: true }))),
    trunk: track(patch(lambert({ vertexColors: true })))
  };

  type Inst = { x: number; z: number; palm: boolean; s: number; yaw: number };
  const near: Inst[] = [];
  // The campus is clean and open: only coconut palms, standing in straight lines along the roads.
  for (const t of M.trees) {
    if (levelOfRow(t.y) !== 'ground') continue;
    near.push({ x: t.x + 0.5, z: t.y + 0.5, palm: true, s: 1, yaw: ((t.x * 7 + t.y * 13) % 8) * 0.785 });
  }
  // a low whitewashed perimeter wall with a blue cap, open at the gate
  {
    const g = new Geo();
    const wallC = rgb(0xf1ead6);
    const cap = rgb(0x2b6cb0);
    const run = (x0: number, z0: number, x1: number, z1: number) => {
      g.box(x0, 0, z0, x1, 0.9, z1, wallC, 0.5, 0.5);
      g.box(x0 - 0.04, 0.9, z0 - 0.04, x1 + 0.04, 1.0, z1 + 0.04, cap);
    };
    run(0, 0, MAP_W, 0.3);
    run(0, 0, 0.3, GROUND_H);
    run(MAP_W - 0.3, 0, MAP_W, GROUND_H);
    run(0, GROUND_H - 0.3, 34, GROUND_H);
    run(38, GROUND_H - 0.3, MAP_W, GROUND_H);
    const wallMesh = new THREE.Mesh(track(g.build()), track(patch(lambert({ vertexColors: true }))));
    grp.add(wallMesh);
  }

  const make = (list: Inst[], lod: 0 | 1) => {
    const palms = list.filter((p) => p.palm);
    const trees = list.filter((p) => !p.palm);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    const place = (geo: THREE.BufferGeometry, mat: THREE.Material, items: Inst[], fn: (i: Inst, idx: number) => THREE.Matrix4, tint = false) => {
      if (!items.length) return;
      const im = new THREE.InstancedMesh(geo, mat, items.length);
      items.forEach((it, i) => {
        im.setMatrixAt(i, fn(it, i));
        if (tint) {
          const k = 0.85 + rnd() * 0.3;
          im.setColorAt(i, col.setRGB(k, k, k * (0.9 + rnd() * 0.2)));
        }
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      grp.add(im);
    };
    const palmH = (it: Inst) => 6.4 * it.s;
    place(trunk(0.2, 0.12), mats.trunk, palms, (it) => {
      e.set(0, it.yaw, 0);
      q.setFromEuler(e);
      return m.compose(new THREE.Vector3(it.x, 0, it.z), q, new THREE.Vector3(it.s, palmH(it), it.s)).clone();
    });
    place(palmCrown(lod ? 9 : 6, lod ? 5 : 3), mats.palm, palms, (it) => {
      e.set(0, it.yaw, 0);
      q.setFromEuler(e);
      return m.compose(new THREE.Vector3(it.x, palmH(it), it.z), q, new THREE.Vector3(it.s, it.s, it.s)).clone();
    }, true);
    const trunkH = (it: Inst) => (2.2 + (it.yaw % 1) * 1.2) * it.s;
    place(trunk(0.26, 0.16), mats.trunk, trees, (it) => {
      e.set(0, it.yaw, 0);
      q.setFromEuler(e);
      return m.compose(new THREE.Vector3(it.x, 0, it.z), q, new THREE.Vector3(it.s, trunkH(it), it.s)).clone();
    });
    place(treeCrown(lod ? 1 : 0), mats.crown, trees, (it) => {
      e.set(0, it.yaw, 0);
      q.setFromEuler(e);
      return m.compose(new THREE.Vector3(it.x, trunkH(it) + 0.9 * it.s, it.z), q, new THREE.Vector3(it.s, it.s, it.s)).clone();
    }, true);
  };
  make(near, 1);

  // grass tufts around, off the roads and buildings
  const tuftGeo = (() => {
    const g = new Geo();
    for (const a of [0, Math.PI / 2]) {
      const dx = Math.cos(a) * 0.3;
      const dz = Math.sin(a) * 0.3;
      g.quad([-dx, 0, -dz], [dx, 0, dz], [dx, 0.5, dz], [-dx, 0.5, -dz], [dz, 0, -dx], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
    return track(g.build());
  })();
  const tuftMat = track(new THREE.MeshLambertMaterial({ map: track(T.tuftTexture()), alphaTest: 0.5, side: THREE.DoubleSide }));
  const spots: Array<[number, number]> = [];
  for (let i = 0; i < 6000 && spots.length < 900; i++) {
    const x = 1 + rnd() * (MAP_W - 2);
    const z = 1 + rnd() * (GROUND_H - 2);
    const tx = Math.floor(x);
    const tz = Math.floor(z);
    if (M.blocked[tz * MAP_W + tx]) continue;
    if (M.paths.some((p) => inRect({ x: p.x - 1, y: p.y - 1, w: p.w + 2, h: p.h + 2 }, tx, tz))) continue;
    if (M.buildings.some((b) => b.level === 'ground' && inRect({ x: b.rect.x - 1, y: b.rect.y - 1, w: b.rect.w + 2, h: b.rect.h + 2 }, tx, tz))) continue;
    if (M.huts.some((h) => Math.hypot(x - h.cx, z - h.cy) < h.r + 1)) continue;
    spots.push([x, z]);
  }
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  spots.forEach(([x, z], i) => {
    e.set(0, rnd() * 6.28, 0);
    q.setFromEuler(e);
    const s = 0.8 + rnd() * 0.9;
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s * (0.8 + rnd() * 0.6), s));
    tufts.setMatrixAt(i, m);
  });
  tufts.instanceMatrix.needsUpdate = true;
  grp.add(tufts);

  // distant low hills that sit in the haze
  const hillMat = track(new THREE.MeshLambertMaterial({ color: 0x5f8466, fog: true }));
  const hillGeo = track(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd() * 0.3;
    const R = 190 + rnd() * 40;
    const mesh = new THREE.Mesh(hillGeo, hillMat);
    mesh.position.set(MAP_W / 2 + Math.cos(a) * R, -2, GROUND_H / 2 + Math.sin(a) * R);
    mesh.scale.set(60 + rnd() * 60, 14 + rnd() * 26, 50 + rnd() * 50);
    grp.add(mesh);
  }
}
