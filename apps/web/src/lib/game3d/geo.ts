import * as THREE from 'three';

export type V3 = [number, number, number];

/**
 * Tiny mesh builder. Everything static in the campus is poured into a few of
 * these (one per material) and turned into a handful of draw calls, which is
 * what keeps the 3D campus fast on phones.
 */
export class Geo {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  private n = 0;

  get empty() {
    return this.n === 0;
  }

  /** A triangle. Winding is corrected so the face points along `hint` (an outward direction). */
  tri(a: V3, b: V3, c: V3, hint: V3, uvs: [number, number][], color: V3 = [1, 1, 1]) {
    const e1: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1];
    let ny = e1[2] * e2[0] - e1[0] * e2[2];
    let nz = e1[0] * e2[1] - e1[1] * e2[0];
    const flip = nx * hint[0] + ny * hint[1] + nz * hint[2] < 0;
    if (flip) {
      [b, c] = [c, b];
      [uvs[1], uvs[2]] = [uvs[2], uvs[1]];
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const len = Math.hypot(nx, ny, nz) || 1;
    for (let i = 0; i < 3; i++) {
      const p = [a, b, c][i];
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx / len, ny / len, nz / len);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(color[0], color[1], color[2]);
      this.idx.push(this.n + i);
    }
    this.n += 3;
  }

  /** A quad a,b,c,d (in order around its edge). Winding is corrected to face `hint`. */
  quad(a: V3, b: V3, c: V3, d: V3, hint: V3, uvs: [number, number][], color: V3 = [1, 1, 1]) {
    this.tri(a, b, c, hint, [uvs[0], uvs[1], uvs[2]], color);
    this.tri(a, c, d, hint, [uvs[0], uvs[2], uvs[3]], color);
  }

  /** A flat horizontal rectangle facing up. UVs are world metres times (su, sv). */
  floor(x0: number, z0: number, x1: number, z1: number, y: number, su = 1, sv = 1, color: V3 = [1, 1, 1]) {
    this.quad(
      [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0],
      [[x0 * su, z1 * sv], [x1 * su, z1 * sv], [x1 * su, z0 * sv], [x0 * su, z0 * sv]],
      color
    );
  }

  /**
   * A vertical rectangle from (x0,z0) to (x1,z1) spanning y0..y1, facing `nx,nz`.
   * UVs: u = distance along the wall times su, v = height times sv.
   */
  wall(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, nx: number, nz: number, su = 1, sv = 1, color: V3 = [1, 1, 1]) {
    // u follows the real world coordinate along the wall, so neighbouring pieces line up.
    const alongX = Math.abs(nz) > 0.5;
    const uA = (alongX ? x0 : z0) * su;
    const uB = (alongX ? x1 : z1) * su;
    this.quad(
      [x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], [nx, 0, nz],
      [[uA, y0 * sv], [uB, y0 * sv], [uB, y1 * sv], [uA, y1 * sv]],
      color
    );
  }

  /** Axis aligned box. Faces get world-metre UVs; skip the bottom, nobody sees it. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: V3 = [1, 1, 1], su = 1, sv = 1) {
    this.wall(x0, z1, x1, z1, y0, y1, 0, 1, su, sv, color);
    this.wall(x1, z0, x0, z0, y0, y1, 0, -1, su, sv, color);
    this.wall(x1, z1, x1, z0, y0, y1, 1, 0, su, sv, color);
    this.wall(x0, z0, x0, z1, y0, y1, -1, 0, su, sv, color);
    this.quad(
      [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0],
      [[x0 * su, z1 * sv], [x1 * su, z1 * sv], [x1 * su, z0 * sv], [x0 * su, z0 * sv]],
      color
    );
  }

  /** Append any three.js geometry (cylinder, cone, sphere, ...) transformed by `m`, tinted with `color`. */
  add(g: THREE.BufferGeometry, m: THREE.Matrix4, color: V3 = [1, 1, 1], worldUV?: [number, number]) {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const nr = g.getAttribute('normal') as THREE.BufferAttribute;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      this.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(nr, i).applyMatrix3(nm).normalize();
      this.nor.push(v.x, v.y, v.z);
      if (worldUV) {
        // project the texture from above, in world metres, so big flat things (slabs) don't stretch it
        v.fromBufferAttribute(p, i).applyMatrix4(m);
        this.uv.push(v.x * worldUV[0], v.z * worldUV[1]);
      } else this.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      this.col.push(color[0], color[1], color[2]);
    }
    const ix = g.getIndex();
    if (ix) for (let i = 0; i < ix.count; i++) this.idx.push(this.n + ix.getX(i));
    else for (let i = 0; i < p.count; i++) this.idx.push(this.n + i);
    this.n += p.count;
  }

  /** Cylinder standing on (x, y0, z), radius r (rt at top), height h. */
  cyl(x: number, y0: number, z: number, r: number, h: number, color: V3, rt = r, seg = 10) {
    const g = new THREE.CylinderGeometry(rt, r, h, seg, 1);
    this.add(g, new THREE.Matrix4().makeTranslation(x, y0 + h / 2, z), color);
    g.dispose();
  }

  /** Box with arbitrary rotation about Y (and optional tilt about X), centred on (cx, cy, cz). */
  obox(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: V3, yaw = 0, tilt = 0) {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    const m = new THREE.Matrix4()
      .makeTranslation(cx, cy, cz)
      .multiply(new THREE.Matrix4().makeRotationY(yaw))
      .multiply(new THREE.Matrix4().makeRotationX(tilt));
    this.add(g, m, color);
    g.dispose();
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Hex colour to linear RGB, so vertex colours match the colours in the material system. */
const _c = new THREE.Color();
export function rgb(hex: number): V3 {
  _c.setHex(hex);
  return [_c.r, _c.g, _c.b];
}

/** Slightly darken/lighten a colour. */
export function shade(c: V3, k: number): V3 {
  return [c[0] * k, c[1] * k, c[2] * k];
}

/** Deterministic random numbers so the campus looks the same for everyone, every time. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
