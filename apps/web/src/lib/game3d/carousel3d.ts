import * as THREE from 'three';
import { CAMPUS_MAP, CAROUSEL_RADIUS, TILE, carouselAngle } from '@campus/shared';

const spot = CAMPUS_MAP.spots.find((s) => s.id === 'carousel')!.rect;
/** Centre of the carousel, in tiles. */
export const CAROUSEL_CX = spot.x + spot.w / 2;
export const CAROUSEL_CZ = spot.y + spot.h / 2;
export const CAROUSEL_LIFT = 0.28;

/** The Recreation Ground carousel: a low platform, a pole, a striped roof and six horses, all turning together. */
export class Carousel3D {
  readonly group = new THREE.Group();
  private spinner = new THREE.Group();

  constructor(parent: THREE.Object3D) {
    const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(CAROUSEL_RADIUS + 0.45, CAROUSEL_RADIUS + 0.55, CAROUSEL_LIFT, 24), mat(0xb9b2a0));
    base.position.y = CAROUSEL_LIFT / 2;
    this.group.add(base);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(CAROUSEL_RADIUS + 0.4, CAROUSEL_RADIUS + 0.4, 0.04, 24), mat(0xd9b24a));
    deck.position.y = CAROUSEL_LIFT + 0.02;
    this.spinner.add(deck);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.9, 10), mat(0xe8e2d0));
    pole.position.y = CAROUSEL_LIFT + 1.45;
    this.spinner.add(pole);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(CAROUSEL_RADIUS + 0.55, 0.9, 12), mat(0xc0392b));
    roof.position.y = CAROUSEL_LIFT + 3.3;
    this.spinner.add(roof);
    const cols = [0xf1c40f, 0x2e86de, 0xe84393, 0x27ae60, 0xe67e22, 0x8e44ad];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const horse = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.7), mat(cols[i]));
      body.position.y = 0.5;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.24), mat(cols[i]));
      head.position.set(0, 0.74, 0.34);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6), mat(0xdddddd));
      rod.position.y = 1.2;
      horse.add(body, head, rod);
      horse.position.set(Math.cos(a) * (CAROUSEL_RADIUS - 0.25) * 0.55, CAROUSEL_LIFT + 0.05, Math.sin(a) * (CAROUSEL_RADIUS - 0.25) * 0.55);
      horse.rotation.y = -a;
      this.spinner.add(horse);
    }
    this.group.add(this.spinner);
    this.group.position.set(CAROUSEL_CX, 0, CAROUSEL_CZ);
    parent.add(this.group);
  }

  update(serverNowMs: number) {
    this.spinner.rotation.y = -carouselAngle(serverNowMs);
  }

  /** Where a rider whose resting place is (x, z) tiles appears right now. */
  static riderAt(x: number, z: number, serverNowMs: number): { x: number; z: number } {
    const dx = x - CAROUSEL_CX;
    const dz = z - CAROUSEL_CZ;
    const th = carouselAngle(serverNowMs);
    const c = Math.cos(th);
    const s = Math.sin(th);
    return { x: CAROUSEL_CX + dx * c - dz * s, z: CAROUSEL_CZ + dx * s + dz * c };
  }
}
void TILE;
