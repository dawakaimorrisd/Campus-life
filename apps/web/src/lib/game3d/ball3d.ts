import * as THREE from 'three';
import { BALL_FRICTION, BALL_RADIUS, CAMPUS_MAP, TILE, type BallState } from '@campus/shared';

const U = 1 / TILE;
const REC = CAMPUS_MAP.rec;
// where the ball may be (px): the pitch plus one tile of goal at each end
const X0 = (REC.pitch.x - 1) * TILE;
const X1 = (REC.pitch.x + REC.pitch.w + 1) * TILE;
const Y0 = REC.pitch.y * TILE;
const Y1 = (REC.pitch.y + REC.pitch.h) * TILE;

function ballTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4f2ea';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#23252b';
  const spots: Array<[number, number]> = [[20, 24], [64, 14], [108, 24], [40, 70], [88, 70], [16, 108], [64, 104], [112, 108]];
  for (const [x, y] of spots) {
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11);
    }
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * The shared football. The server sends where it is and how fast it is going; we slide it along the same
 * friction curve in between, so it looks smooth without any extra messages.
 */
export class Ball3D {
  readonly group = new THREE.Group();
  private ball: THREE.Mesh;
  private shadow: THREE.Mesh;
  private st: BallState | null = null;
  private skew = 0;
  /** px */
  x = REC.start.x * TILE;
  y = REC.start.y * TILE;
  private disp = { x: this.x, y: this.y };
  private tex = ballTexture();
  private mats: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];

  constructor(parent: THREE.Object3D) {
    const r = BALL_RADIUS * U * 1.3;
    const g = new THREE.SphereGeometry(r, 14, 10);
    const m = new THREE.MeshLambertMaterial({ map: this.tex });
    this.ball = new THREE.Mesh(g, m);
    const sg = new THREE.CircleGeometry(r * 1.1, 14);
    const sm = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
    this.shadow = new THREE.Mesh(sg, sm);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.03;
    this.group.add(this.ball, this.shadow);
    this.geos.push(g, sg);
    this.mats.push(m, sm);
    this.ball.position.y = r;
    parent.add(this.group);
    this.place();
  }

  apply(s: BallState) {
    this.st = s;
    this.skew = s.now - Date.now();
  }

  private predict(serverNow: number) {
    const s = this.st;
    if (!s) return { x: this.x, y: this.y };
    const t = Math.max(0, (serverNow - s.at) / 1000);
    const k = (1 - Math.exp(-BALL_FRICTION * t)) / BALL_FRICTION;
    return {
      x: Math.min(X1, Math.max(X0, s.x + s.vx * k)),
      y: Math.min(Y1, Math.max(Y0, s.y + s.vy * k))
    };
  }

  private place() {
    this.group.position.set(this.disp.x * U, 0, this.disp.y * U);
  }

  update(dt: number) {
    const p = this.predict(Date.now() + this.skew);
    this.x = p.x;
    this.y = p.y;
    const k = 1 - Math.exp(-dt * 16);
    const ox = this.disp.x;
    const oy = this.disp.y;
    this.disp.x += (p.x - this.disp.x) * k;
    this.disp.y += (p.y - this.disp.y) * k;
    const mx = (this.disp.x - ox) * U;
    const my = (this.disp.y - oy) * U;
    const d = Math.hypot(mx, my);
    if (d > 1e-5) {
      // roll: rotate around the axis perpendicular to the direction of travel
      const axis = new THREE.Vector3(my, 0, -mx).normalize();
      this.ball.rotateOnWorldAxis(axis, d / (BALL_RADIUS * U * 1.3));
    }
    this.place();
  }

  dispose() {
    this.group.removeFromParent();
    for (const m of this.mats) m.dispose();
    for (const g of this.geos) g.dispose();
    this.tex.dispose();
  }
}
