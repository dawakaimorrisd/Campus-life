import * as THREE from 'three';
import { skyPhase, type ClockState, type WeatherKind } from '@campus/shared';

interface Key {
  /** Where in the day (0..1). */
  t: number;
  sunCol: number;
  sun: number;
  hemiSky: number;
  hemi: number;
  fog: number;
  tint: number;
  /** Height of the sun above the horizon (0 low, 1 high). */
  elev: number;
}

// One campus day (see packages/shared/src/clock.ts): dawn, morning, noon, golden afternoon, dusk, a soft moonlit night, pre-dawn.
const KEYS: Key[] = [
  { t: 0.0, sunCol: 0xffb877, sun: 0.55, hemiSky: 0xe6c9b4, hemi: 0.8, fog: 0xe9cdb4, tint: 0xffd2b8, elev: 0.25 },
  { t: 0.1, sunCol: 0xfff0d2, sun: 1.0, hemiSky: 0xdcebff, hemi: 1.0, fog: 0xcfe0d9, tint: 0xffffff, elev: 0.7 },
  { t: 0.35, sunCol: 0xfff6e6, sun: 1.0, hemiSky: 0xdcebff, hemi: 1.0, fog: 0xcfe0d9, tint: 0xffffff, elev: 1.0 },
  { t: 0.58, sunCol: 0xffd9a0, sun: 0.9, hemiSky: 0xf0dcc0, hemi: 0.95, fog: 0xe3d5bd, tint: 0xffe6c8, elev: 0.5 },
  { t: 0.68, sunCol: 0xff9a5c, sun: 0.45, hemiSky: 0xd6a9a0, hemi: 0.7, fog: 0xc99c98, tint: 0xf0a890, elev: 0.2 },
  { t: 0.76, sunCol: 0x8aa6ff, sun: 0.22, hemiSky: 0x6a78b0, hemi: 0.5, fog: 0x2b3656, tint: 0x4a5a98, elev: 0.5 },
  { t: 0.92, sunCol: 0x8aa6ff, sun: 0.2, hemiSky: 0x6a78b0, hemi: 0.48, fog: 0x2b3656, tint: 0x46568f, elev: 0.5 },
  { t: 1.0, sunCol: 0xffb877, sun: 0.55, hemiSky: 0xe6c9b4, hemi: 0.8, fog: 0xe9cdb4, tint: 0xffd2b8, elev: 0.25 }
];

const WEATHER: Record<WeatherKind, { sun: number; hemi: number; grey: number; near: number; far: number }> = {
  clear: { sun: 1, hemi: 1, grey: 0, near: 70, far: 290 },
  cloudy: { sun: 0.55, hemi: 1.05, grey: 0.35, near: 55, far: 240 },
  rain: { sun: 0.28, hemi: 0.9, grey: 0.7, near: 38, far: 170 }
};

const c1 = new THREE.Color();
const c2 = new THREE.Color();
const grey = new THREE.Color(0x7d8a8d);

/**
 * The hour of the day and the weather. Everybody sees the same hour (it comes from the server clock) and the same
 * rain. Rain is a cheap cloud of falling streaks that follows the camera.
 */
export class SkyCycle {
  private weather: WeatherKind = 'clear';
  private mix = { sun: 1, hemi: 1, grey: 0, near: 70, far: 290, rain: 0 };
  private clk: ClockState | null = null;
  private skew = 0;
  private rain: THREE.LineSegments | null = null;
  private drops: Float32Array;
  private readonly count: number;
  /** 0..1 how dark it is (for the party lights and the HUD). */
  night = 0;
  /** Where the sun sits relative to the player; the scene moves it with them. */
  readonly sunOffset = new THREE.Vector3(-18, 30, 14);

  constructor(
    private scene: THREE.Scene,
    private hemi: THREE.HemisphereLight,
    private sun: THREE.DirectionalLight,
    private skyMat: THREE.MeshBasicMaterial,
    private base: { sun: number; hemi: number },
    tier: number
  ) {
    this.count = tier >= 2 ? 1400 : tier === 1 ? 800 : 380;
    this.drops = new Float32Array(this.count * 3);
    for (let i = 0; i < this.count; i++) {
      this.drops[i * 3] = (Math.random() - 0.5) * 44;
      this.drops[i * 3 + 1] = Math.random() * 22;
      this.drops[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    const pos = new Float32Array(this.count * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xb8cbe0, transparent: true, opacity: 0.0, depthWrite: false, fog: false });
    this.rain = new THREE.LineSegments(geo, mat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.rain.renderOrder = 5;
    scene.add(this.rain);
  }

  setWeather(kind: WeatherKind) {
    this.weather = kind;
  }

  /** The campus clock decides the hour. */
  setClock(c: ClockState) {
    this.clk = c;
    if (c.now) this.skew = c.now - Date.now();
  }

  get raining() { return this.weather === 'rain'; }
  /** Rain loudness 0..1 for the sound. */
  get rainLevel() { return this.mix.rain; }

  /** 0..1 position in the day right now. */
  phase(): number {
    if (!this.clk) return 0.2;
    return skyPhase(this.clk, Date.now() + this.skew);
  }

  /** `indoor` keeps rooms readable at night; `upper` is the lit upstairs floor, which ignores the sky. */
  update(dt: number, cam: THREE.Vector3, indoor: boolean, upper: boolean, applySky: boolean) {
    const w = WEATHER[this.weather];
    const k = 1 - Math.exp(-dt * 0.8);
    const m = this.mix;
    m.sun += (w.sun - m.sun) * k;
    m.hemi += (w.hemi - m.hemi) * k;
    m.grey += (w.grey - m.grey) * k;
    m.near += (w.near - m.near) * k;
    m.far += (w.far - m.far) * k;
    m.rain += ((this.weather === 'rain' ? 1 : 0) - m.rain) * (1 - Math.exp(-dt * 0.6));

    // interpolate the day keyframes
    const p = this.phase();
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= p) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const f = Math.min(1, Math.max(0, (p - a.t) / (b.t - a.t || 1)));
    const mixc = (ca: number, cb: number, out: THREE.Color) => out.setHex(ca).lerp(c2.setHex(cb), f);
    const sunI = a.sun + (b.sun - a.sun) * f;
    const hemiI = a.hemi + (b.hemi - a.hemi) * f;
    const elev = a.elev + (b.elev - a.elev) * f;
    this.night = Math.min(1, Math.max(0, (0.9 - hemiI) / 0.45)) * (1 - Math.min(1, sunI * 1.2) * 0.0);

    if (upper) {
      this.hemi.intensity = this.base.hemi * 0.9;
      this.hemi.color.setHex(0xfff2dc);
      this.sun.intensity = this.base.sun * 0.5;
      this.rain && (this.rain.visible = false);
      return;
    }
    // inside a building the room lights are on: keep it readable even at night
    const lift = indoor ? Math.max(0, 0.95 - hemiI) : 0;
    this.sun.color.copy(mixc(a.sunCol, b.sunCol, c1));
    this.sun.intensity = this.base.sun * sunI * m.sun;
    this.hemi.color.copy(mixc(a.hemiSky, b.hemiSky, c1)).lerp(grey, m.grey * 0.5);
    this.hemi.intensity = this.base.hemi * (hemiI + lift) * m.hemi;
    this.sunOffset.set(-18 * (1.3 - elev * 0.6), 8 + 28 * elev, 14);
    const fog = this.scene.fog as THREE.Fog | null;
    if (fog && applySky) {
      fog.color.copy(mixc(a.fog, b.fog, c1)).lerp(grey, m.grey * 0.7);
      fog.near = m.near;
      fog.far = m.far;
    }
    this.skyMat.color.copy(mixc(a.tint, b.tint, c1)).lerp(grey, m.grey * 0.55).multiplyScalar(1 - m.grey * 0.25);

    // rain
    const r = this.rain!;
    const mat = r.material as THREE.LineBasicMaterial;
    r.visible = m.rain > 0.02;
    if (r.visible) {
      mat.opacity = 0.42 * m.rain;
      const pos = (r.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
      const fall = 26 * dt;
      for (let n = 0; n < this.count; n++) {
        let y = this.drops[n * 3 + 1] - fall;
        if (y < 0) {
          y += 22;
          this.drops[n * 3] = (Math.random() - 0.5) * 44;
          this.drops[n * 3 + 2] = (Math.random() - 0.5) * 44;
        }
        this.drops[n * 3 + 1] = y;
        const x = cam.x + this.drops[n * 3];
        const z = cam.z + this.drops[n * 3 + 2];
        pos[n * 6] = x;
        pos[n * 6 + 1] = y;
        pos[n * 6 + 2] = z;
        pos[n * 6 + 3] = x - 0.05;
        pos[n * 6 + 4] = y + 0.7;
        pos[n * 6 + 5] = z;
      }
      (r.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  dispose() {
    if (this.rain) {
      this.scene.remove(this.rain);
      this.rain.geometry.dispose();
      (this.rain.material as THREE.Material).dispose();
    }
  }
}
