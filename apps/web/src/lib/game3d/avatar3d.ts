import * as THREE from 'three';
import { HAIR_COLORS, SHIRT_COLORS, SKIN_TONES, type Avatar, type Facing } from '@campus/shared';
import { Geo, rgb, shade, type V3 } from './geo';
import { blobShadowTexture } from './textures';

/** A person is standing on the ground, 1.7 m tall, facing +z. The server decides where; this only draws. */
const YAW: Record<Facing, number> = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2 };

export interface RigState {
  moving: boolean;
  sitting: boolean;
  eating: boolean;
  dancing: boolean;
  /** Which dance (0..4); each person keeps their own. */
  danceStyle?: number;
  /** Beats per minute of the music, for the tempo of the dance. */
  bpm?: number;
  holding: boolean;
  hot: boolean;
  facing: Facing;
}

const SHOULDER_Y = 1.34;
const HIP_Y = 0.8;

export class AvatarRig {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private legMeshL: THREE.Mesh;
  private legMeshR: THREE.Mesh;
  private plate: THREE.Mesh;
  private amt = 0;
  private yaw = 0;
  private sitState = false;
  private hotState = false;

  constructor(
    private f: AvatarFactory,
    bodyGeo: THREE.BufferGeometry,
    armLGeo: THREE.BufferGeometry,
    armRGeo: THREE.BufferGeometry,
    private phase: number,
    girl = false
  ) {
    const mat = f.mat;
    this.body.add(new THREE.Mesh(bodyGeo, mat));

    const sh = girl ? 0.22 : 0.255;
    this.armL.position.set(-sh, SHOULDER_Y, 0);
    this.armR.position.set(sh, SHOULDER_Y, 0);
    this.armL.add(new THREE.Mesh(armLGeo, mat));
    this.armR.add(new THREE.Mesh(armRGeo, mat));

    this.legL.position.set(-0.1, HIP_Y, 0);
    this.legR.position.set(0.1, HIP_Y, 0);
    this.legMeshL = new THREE.Mesh(f.legStand, mat);
    this.legMeshR = new THREE.Mesh(f.legStand, mat);
    this.legL.add(this.legMeshL);
    this.legR.add(this.legMeshR);

    this.plate = new THREE.Mesh(f.plateGeo, mat);
    this.plate.visible = false;

    this.body.add(this.armL, this.armR, this.legL, this.legR, this.plate);
    const shadow = new THREE.Mesh(f.shadowGeo, f.shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.035;
    shadow.renderOrder = 1;
    this.root.add(shadow, this.body);
    this.root.matrixAutoUpdate = true;
  }

  snapFacing(facing: Facing) {
    this.yaw = YAW[facing];
    this.root.rotation.y = this.yaw;
  }

  update(t: number, dt: number, s: RigState) {
    // turn smoothly the short way round
    const target = YAW[s.facing];
    let d = target - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 14);
    this.root.rotation.y = this.yaw;

    if (s.sitting !== this.sitState) {
      this.sitState = s.sitting;
      const g = s.sitting ? this.f.legSit : this.f.legStand;
      this.legMeshL.geometry = g;
      this.legMeshR.geometry = g;
    }
    this.amt += ((s.moving && !s.sitting ? 1 : 0) - this.amt) * Math.min(1, dt * 12);
    const ph = t * 9.5 + this.phase;
    const swing = Math.sin(ph) * 0.7 * this.amt;

    this.body.position.y = s.sitting ? -0.33 : Math.abs(Math.sin(ph)) * 0.035 * this.amt;
    this.body.rotation.z = 0;
    this.body.rotation.x = s.sitting ? 0.05 : 0.04 * this.amt;

    if (s.sitting) {
      this.legL.rotation.x = 0;
      this.legR.rotation.x = 0;
    } else {
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;
    }

    // arms
    this.armL.rotation.set(-swing * 0.8, 0, 0.05);
    this.armR.rotation.set(swing * 0.8, 0, -0.05);
    if (s.sitting) {
      this.armL.rotation.set(-0.55, 0, 0.05);
      this.armR.rotation.set(-0.55, 0, -0.05);
    }
    if (s.holding && !s.dancing) {
      this.armL.rotation.set(-1.0, 0, 0.18);
      this.armR.rotation.set(-1.0, 0, -0.18);
    }
    if (s.eating) this.armR.rotation.set(-1.35 + Math.sin(t * 7) * 0.3, 0, -0.1);
    this.body.rotation.y = 0;
    if (s.dancing && !s.sitting) {
      const om = Math.PI * (s.bpm ?? 120) / 60; // radians per second at half the beat: a relaxed sway
      const ph2 = t * om + this.phase;
      const w = Math.sin(ph2);
      const bounce = Math.abs(Math.cos(ph2));
      switch ((s.danceStyle ?? 0) % 5) {
        case 1: // pump: arms take turns going up
          this.body.rotation.z = w * 0.07;
          this.body.position.y += bounce * 0.07;
          this.armL.rotation.set(-1.6 + Math.sin(ph2 * 2) * 0.7, 0, -0.35);
          this.armR.rotation.set(-1.6 - Math.sin(ph2 * 2) * 0.7, 0, 0.35);
          break;
        case 2: // twist
          this.body.rotation.y = w * 0.55;
          this.body.position.y += bounce * 0.04;
          this.armL.rotation.set(-0.9, 0, -0.9 + w * 0.3);
          this.armR.rotation.set(-0.9, 0, 0.9 + w * 0.3);
          break;
        case 3: // shoulder shake
          this.body.rotation.z = Math.sin(ph2 * 2) * 0.16;
          this.body.position.y += bounce * 0.05;
          this.armL.rotation.set(-0.3, 0, -0.6 - w * 0.4);
          this.armR.rotation.set(-0.3, 0, 0.6 - w * 0.4);
          break;
        case 4: // jump
          this.body.position.y += Math.abs(Math.sin(ph2 * 2)) * 0.2;
          this.armL.rotation.set(0, 0, -2.7);
          this.armR.rotation.set(0, 0, 2.7);
          break;
        default: // classic: both arms up, swaying
          this.body.rotation.z = w * 0.1;
          this.body.position.y += bounce * 0.06;
          this.armL.rotation.set(0, 0, -2.5 + w * 0.5);
          this.armR.rotation.set(0, 0, 2.5 + w * 0.5);
      }
      // feet keep the beat
      this.legL.rotation.x = Math.max(0, Math.sin(ph2 * 2)) * 0.45;
      this.legR.rotation.x = Math.max(0, -Math.sin(ph2 * 2)) * 0.45;
    }

    this.plate.visible = s.holding;
    if (s.holding) {
      if (s.hot !== this.hotState) {
        this.hotState = s.hot;
        this.plate.geometry = s.hot ? this.f.plateHotGeo : this.f.plateGeo;
      }
      this.plate.position.set(0, s.sitting ? 0.86 : 0.98, 0.36);
      if (s.eating) this.plate.position.y += Math.sin(t * 7) * 0.02;
    }
  }
}

/** Builds and caches the shared pieces so a crowd of 40 costs little memory. */
export class AvatarFactory {
  readonly mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  readonly shadowMat: THREE.MeshBasicMaterial;
  readonly shadowGeo = new THREE.PlaneGeometry(1.0, 1.0);
  readonly legStand: THREE.BufferGeometry;
  readonly legSit: THREE.BufferGeometry;
  readonly plateGeo: THREE.BufferGeometry;
  readonly plateHotGeo: THREE.BufferGeometry;
  private bodies = new Map<string, THREE.BufferGeometry>();
  private arms = new Map<string, THREE.BufferGeometry>();
  private shadowTex = blobShadowTexture();
  private n = 0;

  constructor() {
    this.shadowMat = new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const jeans = rgb(0x2f3b52);
    const shoe = rgb(0x1c1c1f);

    const stand = new Geo();
    stand.obox(0, -0.4, 0, 0.14, 0.8, 0.15, jeans);
    stand.obox(0, -0.765, 0.045, 0.15, 0.07, 0.26, shoe);
    this.legStand = stand.build();

    const sit = new Geo();
    sit.obox(0, -0.065, 0.21, 0.14, 0.13, 0.44, jeans);
    sit.obox(0, -0.275, 0.42, 0.13, 0.42, 0.13, jeans);
    sit.obox(0, -0.46, 0.47, 0.15, 0.07, 0.26, shoe);
    this.legSit = sit.build();

    const plate = (rim: V3) => {
      const g = new Geo();
      g.cyl(0, 0, 0, 0.17, 0.025, rim, 0.17, 14);
      g.cyl(0, 0.025, 0, 0.12, 0.05, rgb(0xe3a53a), 0.1, 10);
      g.obox(0.07, 0.06, 0.03, 0.08, 0.04, 0.06, rgb(0x4f9a3c));
      g.obox(-0.06, 0.055, -0.04, 0.07, 0.035, 0.07, rgb(0xb9452b));
      return g.build();
    };
    this.plateGeo = plate(rgb(0xf3f1e8));
    this.plateHotGeo = plate(rgb(0xd33a2e));
  }

  make(a: Avatar): AvatarRig {
    const girl = a.gender === 1;
    const key = `${a.skin}:${a.shirt}:${a.hair}:${girl ? 'g' : 'b'}`;
    const skin = rgb(SKIN_TONES[a.skin]);
    const shirt = rgb(SHIRT_COLORS[a.shirt]);
    const hair = rgb(HAIR_COLORS[a.hair]);

    let body = this.bodies.get(key);
    if (!body) {
      const g = new Geo();
      if (girl) {
        g.obox(0, 1.1, 0, 0.34, 0.5, 0.2, shirt); // slimmer top
        g.cyl(0, 0.52, 0, 0.3, 0.3, shade(shirt, 0.82), 0.19, 12); // flared skirt down to the knee
        g.obox(0, 0.84, 0, 0.35, 0.05, 0.2, shade(shirt, 0.7)); // waist band
      } else {
        g.obox(0, 1.07, 0, 0.4, 0.58, 0.22, shirt);
        g.obox(0, 0.8, 0, 0.38, 0.06, 0.21, shade(shirt, 0.85)); // shirt hem
      }
      g.cyl(0, 1.34, 0, 0.055, 0.1, shade(skin, 0.95), 0.055, 8);
      const head = new THREE.SphereGeometry(1, 12, 9);
      g.add(head, new THREE.Matrix4().makeTranslation(0, 1.56, 0).multiply(new THREE.Matrix4().makeScale(0.115, 0.14, 0.125)), skin);
      const afro = a.hair % 2 === 1;
      g.add(head, new THREE.Matrix4().makeTranslation(0, afro ? 1.64 : 1.62, afro ? -0.01 : -0.018).multiply(new THREE.Matrix4().makeScale(afro ? 0.165 : 0.125, afro ? 0.15 : 0.115, afro ? 0.165 : 0.13)), hair);
      if (girl) {
        // long hair falling behind the shoulders, plus a small side fringe and a ponytail tie
        g.obox(0, 1.42, -0.1, 0.27, 0.42, 0.08, hair);
        g.add(head, new THREE.Matrix4().makeTranslation(0, 1.31, -0.11).multiply(new THREE.Matrix4().makeScale(0.12, 0.1, 0.06)), hair);
        g.obox(0, 1.62, 0.085, 0.2, 0.05, 0.05, shade(hair, 1.1)); // fringe
        g.obox(0, 1.46, -0.14, 0.05, 0.03, 0.05, shade(shirt, 1.1)); // hair tie
      }
      head.dispose();
      g.obox(-0.045, 1.575, 0.118, 0.022, 0.022, 0.012, rgb(0x15110e)); // eyes
      g.obox(0.045, 1.575, 0.118, 0.022, 0.022, 0.012, rgb(0x15110e));
      g.obox(0, 1.535, 0.127, 0.03, 0.04, 0.03, shade(skin, 0.9)); // nose
      if (girl) g.obox(0, 1.505, 0.123, 0.05, 0.012, 0.012, rgb(0xb5394f)); // lips
      body = g.build();
      this.bodies.set(key, body);
    }
    const arm = (side: -1 | 1) => {
      const k = `${key}:${side}`;
      let g = this.arms.get(k);
      if (!g) {
        const b = new Geo();
        b.obox(0, -0.13, 0, 0.095, 0.27, 0.095, shirt);
        b.obox(0, -0.4, 0, 0.075, 0.3, 0.075, skin);
        const hand = new THREE.SphereGeometry(0.045, 8, 6);
        b.add(hand, new THREE.Matrix4().makeTranslation(0, -0.57, 0), skin);
        hand.dispose();
        g = b.build();
        this.arms.set(k, g);
      }
      return g;
    };
    return new AvatarRig(this, body, arm(-1), arm(1), (this.n++ * 1.7) % (Math.PI * 2), girl);
  }

  dispose() {
    for (const g of this.bodies.values()) g.dispose();
    for (const g of this.arms.values()) g.dispose();
    this.legStand.dispose();
    this.legSit.dispose();
    this.plateGeo.dispose();
    this.plateHotGeo.dispose();
    this.shadowGeo.dispose();
    this.shadowMat.dispose();
    this.shadowTex.dispose();
    this.mat.dispose();
  }
}
