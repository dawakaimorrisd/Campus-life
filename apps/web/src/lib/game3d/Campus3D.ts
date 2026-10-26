import * as THREE from 'three';
import {
  CAMPUS_MAP,
  CLASS_ROOMS,
  EMOTE_ICONS,
  EVENT_MARKER_MS,
  EVENT_NEAR_RANGE,
  MAX_NAME_LENGTH,
  SEAT_HINT_RANGE,
  SIT_MAX_DIST,
  SPOT_REACH,
  TILE,
  TRACKS,
  KICK_RANGE,
  LECTURE_LINES, SEGMENT_LINES,
  MOODS, YEARS, collegeOf, hash01, buildRoutes, guardAt, type Route,
  inRect,
  isIndoor,
  levelAt,
  nearestSpot,
  zoneAt,
  type ClockPhase,
  type DjState,
  type GroupInfo,
  type Level,
  type PlayerState,
  type ServerMsg,
  type ZoneId
} from '@campus/shared';
import type { Profile } from '$lib/profile';
import { Net, resolveWsUrl } from '$lib/game/net';
import { g, resetStore, send, setSender, toast } from '$lib/game/store.svelte';
import { buildWorld, cut, U, type World3D } from './world3d';
import { AvatarFactory, type AvatarRig } from './avatar3d';
import { glowTexture, ringTexture } from './textures';
import { Music } from './music';
import { Carousel3D, CAROUSEL_LIFT } from './carousel3d';
import { NightUi } from './night-ui';
import { LifeUi } from './life-ui';
import { MapUi } from './map-ui';
import { Ball3D } from './ball3d';
import { SkyCycle } from './sky3d';

/** Each person keeps their own dance (0..4), picked from their id. */
const styleOf = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 5;
};

const CLASS_ZONES: ZoneId[] = ['college_cj', 'college_nursing', 'college_business', 'college_agri', 'college_education', 'student_hall'];
const GROUP_COLORS: Record<GroupInfo['kind'], number> = { chat: 0xffe9a6, eating: 0xffa94d, study: 0x7fb2ff, walking: 0xffffff };
const PITCH = (52 * Math.PI) / 180;
const BASE_DIST = 13;

/** Settings you can tune without touching code: /play?sun=2.4&hemi=1.6&exp=1&q=1&stats=1 */
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const num = (k: string, d: number) => {
  const v = Number(params.get(k));
  return params.has(k) && Number.isFinite(v) ? v : d;
};

interface View {
  id: string;
  state: PlayerState;
  rig: AvatarRig;
  x: number; // world metres
  z: number;
  tx: number;
  tz: number;
  tag: HTMLDivElement;
  edu: HTMLDivElement;
  mark: HTMLSpanElement;
  bubble: HTMLDivElement | null;
  bubbleTimer: number;
  tagShown: boolean;
  danceUntil: number;
  style: number;
  shakeUntil: number;
}
interface Marker {
  id: number;
  x: number; // world
  z: number;
  until: number;
  level: Level;
  mesh: THREE.Mesh;
}
interface Pulse {
  mesh: THREE.Mesh;
  start: number;
}

const STYLE = `
.c3d-overlay{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:2}
.c3d-tag{position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;white-space:nowrap;will-change:transform}
.c3d-name{display:flex;gap:3px;align-items:center;font:800 13px/1.1 "Bricolage Grotesque",system-ui,sans-serif;color:#fff;text-shadow:0 0 3px #151a38,0 1px 3px #000,0 0 7px #151a38}
.c3d-edu{font:700 10px/1 "Bricolage Grotesque",system-ui,sans-serif;color:#cfe3ff;opacity:.9;text-shadow:0 0 3px #151a38,0 1px 2px #000;text-align:center}
.c3d-name.self{color:#ffe9a6}
.c3d-bubble{max-width:170px;white-space:normal;text-align:center;background:#fffdf4;color:#151a38;font:700 13px/1.25 "Bricolage Grotesque",system-ui,sans-serif;padding:5px 8px;border-radius:10px;margin-bottom:4px;opacity:0;transition:opacity .15s;box-shadow:0 2px 6px rgba(0,0,0,.35)}
.c3d-bubble.on{opacity:1}
.c3d-emote{position:absolute;bottom:100%;left:50%;font-size:27px;animation:c3d-float 1.3s ease-out forwards;pointer-events:none}
@keyframes c3d-float{from{transform:translate(-50%,0);opacity:1}to{transform:translate(-50%,-42px);opacity:0}}
.c3d-arrow{position:absolute;left:0;top:0;font-size:30px;line-height:1;color:#ffb62e;text-shadow:0 0 4px #151a38,0 0 2px #151a38;display:none;will-change:transform}
.c3d-btns{position:absolute;left:max(10px,env(safe-area-inset-left));top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px;pointer-events:auto}
.c3d-btn{width:44px;height:44px;border-radius:50%;border:0;background:rgba(21,26,56,.62);color:#fff;font-size:20px;display:grid;place-items:center;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.c3d-btn:active{background:rgba(255,182,46,.8);color:#151a38}
.c3d-joy{position:absolute;left:max(18px,env(safe-area-inset-left));bottom:max(96px,calc(env(safe-area-inset-bottom) + 84px));width:128px;height:128px;border-radius:50%;background:radial-gradient(circle,rgba(21,26,56,.10) 0,rgba(21,26,56,.30) 100%);border:2px solid rgba(255,255,255,.38);pointer-events:auto;touch-action:none;opacity:.55;transition:opacity .15s;-webkit-tap-highlight-color:transparent;user-select:none}
.c3d-joy.on{opacity:.95}
.c3d-joy i{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:rgba(255,255,255,.88);box-shadow:0 2px 8px rgba(0,0,0,.4)}
.c3d-joy b{position:absolute;font:900 13px/1 system-ui;color:rgba(255,255,255,.75);pointer-events:none}
.c3d-now{position:absolute;left:50%;top:max(58px,calc(env(safe-area-inset-top) + 50px));transform:translateX(-50%);display:none;flex-direction:column;gap:4px;align-items:stretch;min-width:170px;padding:6px 12px 7px;border-radius:14px;background:rgba(32,12,58,.82);color:#ffe9a6;font:800 13px/1.15 "Bricolage Grotesque",system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.4);pointer-events:none;text-align:center}
.c3d-now small{font-weight:700;opacity:.8;font-size:11px}
.c3d-now i{display:block;height:3px;border-radius:2px;background:rgba(255,255,255,.2);overflow:hidden}
.c3d-now i b{display:block;height:100%;width:0;background:#ff6fd0}
.c3d-vol{position:absolute;left:calc(max(10px,env(safe-area-inset-left)) + 54px);top:50%;transform:translateY(-50%);display:none;align-items:center;gap:8px;padding:6px 10px;border-radius:22px;background:rgba(21,26,56,.82);pointer-events:auto}
.c3d-vol.open{display:flex}
.c3d-vol button{border:0;background:none;color:#fff;font-size:20px;cursor:pointer;padding:0 2px}
.c3d-vol input{width:110px;accent-color:#ffb62e}
.c3d-acts{position:absolute;right:max(16px,env(safe-area-inset-right));bottom:max(150px,calc(env(safe-area-inset-bottom) + 140px));display:flex;flex-direction:column-reverse;gap:8px;align-items:flex-end;pointer-events:none}
.c3d-act:hover,.c3d-kick:hover,.c3d-btns button:hover{filter:brightness(1.25)}
.c3d-act:active,.c3d-kick:active{transform:scale(.95)}
.c3d-act{display:none;border:0;border-radius:999px;padding:11px 16px;background:rgba(21,26,56,.82);color:#fff;font:800 15px/1 "Bricolage Grotesque",system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.4);pointer-events:auto;touch-action:manipulation;cursor:pointer}
.c3d-act.on{background:#ff4fb8;color:#fff}
.c3d-act.hot{animation:c3d-pulse 1s ease-in-out infinite}
@keyframes c3d-pulse{50%{transform:scale(1.08)}}
.c3d-kick{display:none;border:0;border-radius:999px;padding:14px 20px;background:#ffb62e;color:#151a38;font:900 17px/1 "Bricolage Grotesque",system-ui,sans-serif;box-shadow:0 3px 12px rgba(0,0,0,.45);pointer-events:auto;touch-action:manipulation;cursor:pointer}
.c3d-stats{position:absolute;right:8px;top:70px;background:rgba(0,0,0,.65);color:#9f9;font:12px/1.35 monospace;padding:4px 7px;border-radius:6px;white-space:pre}
`;

export class Campus3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.3, 700);
  private world: World3D;
  private factory = new AvatarFactory();
  private actors = new THREE.Group();
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private net: Net;
  private overlay: HTMLDivElement;
  private arrowEl: HTMLDivElement;
  private statsEl: HTMLDivElement | null = null;
  private styleEl: HTMLStyleElement;
  private resizeObs: ResizeObserver;

  private views = new Map<string, View>();
  private selfId: string | null = null;
  private selectedId: string | null = null;
  private level: Level = 'ground';
  private lastZone = '';
  private groups: GroupInfo[] = [];
  private markers: Marker[] = [];
  private pulses: Pulse[] = [];
  private seatHints: THREE.Mesh[] = [];
  private groupMeshes: THREE.Mesh[] = [];
  private selRing: THREE.Mesh;
  private tex: THREE.Texture[] = [];

  // camera
  private yawIdx = 0;
  private yaw = 0;
  private zoom = 1;
  private target = new THREE.Vector3();
  private camInit = false;

  // input
  private keys = new Set<string>();
  private lastDir = { x: 0, y: 0 };
  private joy = { x: 0, y: 0 };
  /** Student Center party look. Preview with ?party=1 or the P key; the DJ drives it from the server in Phase C. */
  private party = false;
  private music = new Music();
  private dj: DjState | null = null;
  /** server clock minus this device's clock, so every phone hits the same beat */
  private djSkew = 0;
  private djKey = '';
  private previewOn = false;
  private serverOn = false;
  private localNext = 0;
  private nowEl!: HTMLDivElement;
  private nowTitle!: HTMLDivElement;
  private nowSub!: HTMLElement;
  private nowBar!: HTMLElement;
  private volEl!: HTMLDivElement;
  private nightUi!: NightUi;
  private lifeUi!: LifeUi;
  private mapUi!: MapUi;
  private ball!: Ball3D;
  private carousel!: Carousel3D;
  private sky!: SkyCycle;
  private kickBtn!: HTMLButtonElement;
  private acts!: HTMLDivElement;
  private danceBtn!: HTMLButtonElement;
  private storyBtn!: HTMLButtonElement;
  private jokeBtn!: HTMLButtonElement;
  private askBtn!: HTMLButtonElement;
  private endTalkBtn!: HTMLButtonElement;
  private lastNightK = -1;
  private stageBusy = false;
  private routes: Route[] = [];
  private clockSkew = 0;
  /** The server's time, as best this phone can tell (the guards' rounds depend on it). */
  private serverNow() { return Date.now() + this.clockSkew; }
  private nextLecture = 0;
  private lastRainLevel = -1;
  private nightPhase = 'off';
  private muteBtn!: HTMLButtonElement;
  private partyCenter = (() => {
    const f = CAMPUS_MAP.venue.danceFloor;
    return { x: f.x + f.w / 2, z: f.y + f.h / 2 };
  })();
  private staff: Array<{ home?: { x: number; z: number }; ridx?: number; route?: Route; walking?: boolean; face?: Facing; rig: AvatarRig; tag: HTMLDivElement; x: number; z: number; level: Level; shown: boolean; role: string; elev: number; style: number }> = [];
  private pointers = new Map<number, { x: number; y: number }>();
  private tapStart: { x: number; y: number; t: number; moved: boolean } | null = null;
  private pinch0 = 0;
  private zoom0 = 1;

  // loop
  private tier = 1;
  private last = performance.now();
  private nextUi = 0;
  private nextHints = 0;
  private fpsT = 0;
  private fpsN = 0;
  private lowStreak = 0;
  private disposed = false;
  private failed = false;
  private timers: number[] = [];
  private maxPixelRatio = 1.5;

  constructor(
    private parent: HTMLElement,
    private profile: Profile,
    private onFatal: (e: unknown) => void
  ) {
    // ---- how strong is this device?
    const ua = navigator.userAgent;
    const mobile = /Android|iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && matchMedia('(pointer: coarse)').matches);
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    const cores = navigator.hardwareConcurrency ?? 4;
    this.tier = mobile ? (mem <= 2 || cores <= 4 ? 0 : 1) : 2;
    this.tier = num('q', this.tier);

    this.renderer = new THREE.WebGLRenderer({ antialias: this.tier >= 1, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = num('exp', 1.0);
    this.applyTier();
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    el.style.display = 'block';
    el.style.width = '100%';
    el.style.height = '100%';
    parent.appendChild(el);
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

    // ---- overlay (names, speech, buttons)
    this.styleEl = document.createElement('style');
    this.styleEl.textContent = STYLE;
    document.head.appendChild(this.styleEl);
    this.overlay = document.createElement('div');
    this.overlay.className = 'c3d-overlay';
    parent.appendChild(this.overlay);
    this.arrowEl = document.createElement('div');
    this.arrowEl.className = 'c3d-arrow';
    this.arrowEl.textContent = '➤';
    this.overlay.appendChild(this.arrowEl);
    this.buildButtons();
    if (params.get('stats')) {
      this.statsEl = document.createElement('div');
      this.statsEl.className = 'c3d-stats';
      this.overlay.appendChild(this.statsEl);
    }

    // ---- world
    const aniso = Math.min(this.renderer.capabilities.getMaxAnisotropy(), this.tier >= 2 ? 8 : 4);
    this.world = buildWorld({ anisotropy: aniso, lowEnd: this.tier === 0 });
    this.scene.add(this.world.root, this.actors);
    this.buildStaff();
    if (params.get('party')) this.setPreview(true);
    this.scene.fog = new THREE.Fog(0xcfe0d9, 70, 290);

    // ---- light: bright tropical afternoon. Tune with ?hemi= and ?sun=
    this.hemi = new THREE.HemisphereLight(0xdcebff, 0x8a7a5e, num('hemi', 1.7));
    this.sun = new THREE.DirectionalLight(0xfff0d2, num('sun', 2.6));
    this.sun.position.set(-18, 30, 14);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.sky = new SkyCycle(this.scene, this.hemi, this.sun, this.world.sky.material as THREE.MeshBasicMaterial, { sun: num('sun', 2.6), hemi: num('hemi', 1.7) }, this.tier);
    this.ball = new Ball3D(this.world.ground);
    this.carousel = new Carousel3D(this.world.ground);
    if (this.tier >= 2) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1024, 1024);
      const c = this.sun.shadow.camera;
      c.left = -24;
      c.right = 24;
      c.top = 24;
      c.bottom = -24;
      c.near = 1;
      c.far = 90;
      this.sun.shadow.bias = -0.0006;
      this.sun.shadow.normalBias = 0.05;
      this.world.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && o !== this.world.sky) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
    }

    // ---- helpers drawn in the world
    const ringTex = ringTexture();
    const glowTex = glowTexture();
    this.tex.push(ringTex, glowTex);
    const flat = new THREE.PlaneGeometry(1, 1);
    flat.rotateX(-Math.PI / 2);
    this.geos.push(flat);
    const decal = (map: THREE.Texture, color: number, opacity = 1) =>
      new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, fog: false });
    this.mats.push(decal(ringTex, 0xffffff));
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(flat, decal(ringTex, 0xffffff, 0));
      m.visible = false;
      m.renderOrder = 5;
      this.scene.add(m);
      this.pulses.push({ mesh: m, start: -1e9 });
    }
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(flat, decal(ringTex, 0xffffff, 0.8));
      m.scale.setScalar(0.62);
      m.visible = false;
      m.renderOrder = 4;
      this.scene.add(m);
      this.seatHints.push(m);
    }
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(flat, decal(glowTex, 0xffffff, 0.4));
      m.visible = false;
      m.renderOrder = 3;
      this.scene.add(m);
      this.groupMeshes.push(m);
    }
    this.selRing = new THREE.Mesh(flat, decal(ringTex, 0xffb62e, 1));
    this.selRing.scale.setScalar(1.15);
    this.selRing.visible = false;
    this.selRing.renderOrder = 6;
    this.scene.add(this.selRing);
    this.markerGeo = flat;
    this.markerTex = ringTex;

    // ---- input, resize, network
    this.bindInput();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(parent);
    this.resize();

    resetStore();
    this.net = new Net(resolveWsUrl(), {
      onOpen: () => {
        this.net.send({ t: 'join', playerId: this.profile.playerId, name: this.profile.name, avatar: this.profile.avatar });
        this.net.send({ t: 'ping', ts: performance.now() });
      },
      onMessage: (m) => this.onMessage(m),
      onClose: (code) => {
        this.selfId = null;
        g.selfId = null;
        g.status = code === 4001 ? 'replaced' : 'connecting';
      }
    });
    setSender((m) => this.net.send(m));
    this.net.connect();
    this.timers.push(window.setInterval(() => send({ t: 'ping', ts: performance.now() }), 4000));

    this.renderer.setAnimationLoop(() => this.frame());
  }

  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  private markerGeo!: THREE.BufferGeometry;
  private markerTex!: THREE.Texture;

  // ================================================================ quality
  private applyTier() {
    const dpr = window.devicePixelRatio || 1;
    this.maxPixelRatio = this.tier === 0 ? 1 : this.tier === 1 ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(dpr, this.maxPixelRatio));
    this.renderer.shadowMap.enabled = this.tier >= 2;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (this.sun) this.sun.castShadow = this.tier >= 2;
  }

  private resize() {
    const w = Math.max(1, this.parent.clientWidth);
    const h = Math.max(1, this.parent.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep the same width of campus in view on a tall phone as on a wide screen
    const half = Math.tan((26 * Math.PI) / 180);
    this.camera.fov = Math.min(60, Math.max(38, (2 * Math.atan(half / this.camera.aspect) * 180) / Math.PI));
    this.camera.updateProjectionMatrix();
  }

  // ================================================================ UI buttons
  private buildButtons() {
    const box = document.createElement('div');
    box.className = 'c3d-btns';
    const mk = (label: string, aria: string, fn: () => void) => {
      const b = document.createElement('button');
      b.className = 'c3d-btn';
      b.type = 'button';
      b.textContent = label;
      b.setAttribute('aria-label', aria);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        fn();
      });
      box.appendChild(b);
    };
    mk('⟲', 'Turn the view left', () => this.rotate(-1));
    mk('⟳', 'Turn the view right', () => this.rotate(1));
    mk('+', 'Zoom in', () => (this.zoom = Math.max(0.55, this.zoom * 0.82)));
    mk('−', 'Zoom out', () => (this.zoom = Math.min(1.7, this.zoom * 1.22)));
    mk('🗺', 'Campus map', () => this.mapUi.toggle());
    mk('♪', 'Sound volume', () => this.volEl.classList.toggle('open'));
    this.overlay.appendChild(box);
    this.buildMusicUi();
    this.nightUi = new NightUi(this.overlay, (m) => this.net.send(m));
    this.lifeUi = new LifeUi(this.overlay, (m) => this.net.send(m));
    this.lifeUi.onBell = (phase) => this.onBell(phase);
    this.lifeUi.onReminder = (text) => toast(text, 'info');
    this.lifeUi.onPhase = (phase) => this.onPhase(phase);
    this.mapUi = new MapUi(
      this.overlay,
      (m) => this.net.send(m),
      () => {
        const me = this.selfId ? this.views.get(this.selfId) : undefined;
        return me ? { x: me.x * TILE, y: me.z * TILE } : null;
      },
      () => {
        const hot = new Set<string>();
        if (this.nightPhase === 'open' || this.nightPhase === 'announced') hot.add('student_center');
        if (this.dj?.on) hot.add('student_center');
        if (this.lifeUi.openJobs > 0) hot.add('marketplace');
        if (this.lifeUi.talkActive) hot.add('lecture_area');
        if (this.lifeUi.raceActive) hot.add('sprint_track');
        return hot;
      },
      (t) => toast(t, 'info')
    );
    this.buildKick();
    this.buildJoystick();
  }

  private buildMusicUi() {
    // "now playing" chip
    this.nowEl = document.createElement('div');
    this.nowEl.className = 'c3d-now';
    this.nowTitle = document.createElement('div');
    this.nowSub = document.createElement('small');
    const bar = document.createElement('i');
    this.nowBar = document.createElement('b');
    bar.appendChild(this.nowBar);
    this.nowEl.append(this.nowTitle, this.nowSub, bar);
    this.overlay.appendChild(this.nowEl);
    // volume panel
    this.volEl = document.createElement('div');
    this.volEl.className = 'c3d-vol';
    this.muteBtn = document.createElement('button');
    this.muteBtn.type = 'button';
    this.muteBtn.setAttribute('aria-label', 'Mute sound');
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(Math.round(this.music.getVolume() * 100));
    slider.setAttribute('aria-label', 'Sound volume');
    const paint = () => (this.muteBtn.textContent = this.music.isMuted() || this.music.getVolume() === 0 ? '🔇' : '🔊');
    this.muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.music.setMuted(!this.music.isMuted());
      paint();
    });
    slider.addEventListener('input', () => {
      this.music.setVolume(Number(slider.value) / 100);
      if (this.music.isMuted() && Number(slider.value) > 0) this.music.setMuted(false);
      paint();
    });
    paint();
    this.volEl.append(this.muteBtn, slider);
    this.overlay.appendChild(this.volEl);
    this.music.onLockChange = () => this.paintNow();
  }

  /** The server says what the DJ is doing; light the room and play the same bar as everybody else. */
  private applyDj(m: DjState) {
    const wasOn = this.dj?.on ?? false;
    this.dj = m;
    if (m.now) this.djSkew = m.now - Date.now();
    const world = this.world;
    this.party = m.on || this.previewOn;
    world.venue.setParty(this.party);
    world.venue.bpm = m.bpm;
    world.venue.setEnergy(m.energy);
    const key = `${m.on}:${m.track}:${m.startedAt}`;
    if (key !== this.djKey) {
      this.djKey = key;
      if (m.on) this.music.play(m.track, Math.max(0, Date.now() + this.djSkew - m.startedAt));
      else this.music.stop();
    }
    if (m.shout) this.djSay(m.shout);
    if (m.on !== wasOn && !this.previewOn) toast(m.on ? '🎧 The party is on at the Student Center!' : '🎧 The party is over.', 'fun');
    this.paintNow();
  }

  private djSay(text: string) {
    this.staffSay('dj', text);
  }

  /** A line over the head of the staff member of this role nearest the Student Center door. */
  private staffSay(role: string, text: string) {
    const door = CAMPUS_MAP.venue.door;
    let st: (typeof this.staff)[number] | undefined;
    let best = Infinity;
    for (const x of this.staff) {
      if (x.role !== role) continue;
      const d = Math.hypot(x.x - door.x, x.z - door.y);
      if (d < best) { best = d; st = x; }
    }
    if (!st) return;
    const b = document.createElement('div');
    b.className = 'c3d-bubble on';
    b.textContent = text;
    st.tag.insertBefore(b, st.tag.firstChild);
    window.setTimeout(() => b.remove(), 4200);
  }

  /** A bubble over one particular staff member. */
  private staffBubble(st: (typeof this.staff)[number], text: string, ms = 4200) {
    const b = document.createElement('div');
    b.className = 'c3d-bubble on';
    b.textContent = text;
    st.tag.insertBefore(b, st.tag.firstChild);
    window.setTimeout(() => b.remove(), ms);
  }

  /** The bell: ring it, and let the instructors start. */
  private onBell(phase: 'class' | 'break') {
    this.music.bell();
    if (phase === 'class') this.nextLecture = performance.now() + 1500;
    toast(phase === 'class' ? '🔔 The bell! Class is starting.' : '🔔 Class is over. Break time!', 'info');
  }

  /** The campus moves to a new part of the day. */
  private onPhase(phase: ClockPhase) {
    switch (phase) {
      case 'free': toast('🌤️ Free time! Do what you like, earn LD for tonight.', 'good'); break;
      case 'dusk': toast('🌇 Darkness is coming in one minute. Head to the Student Center!', 'fun'); this.staffSay('security', 'Student Center opens soon. Bring your entry fee.'); break;
      case 'party': toast('🎉 The Student Center is open! Dance, cheer, enjoy.', 'fun'); break;
      case 'bedtime': toast('🌙 Bedtime. Find a group, tell stories and jokes, pass the night together.', 'info'); break;
      case 'dawn': toast('🌅 A new day begins.', 'info'); break;
      default: break;
    }
  }

  private buildKick() {
    this.acts = document.createElement('div');
    this.acts.className = 'c3d-acts';
    this.overlay.appendChild(this.acts);
    this.kickBtn = document.createElement('button');
    this.kickBtn.type = 'button';
    this.kickBtn.className = 'c3d-kick';
    this.kickBtn.textContent = '⚽ Kick';
    this.kickBtn.setAttribute('aria-label', 'Kick the ball');
    this.kickBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.kickBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.net.send({ t: 'kick' });
    });
    this.acts.appendChild(this.kickBtn);
    const mk = (cls: string, label: string, fn: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `c3d-act ${cls}`;
      b.textContent = label;
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      this.acts.appendChild(b);
      return b;
    };
    this.danceBtn = mk('dance', '💃 Dance', () => this.net.send({ t: 'dance', on: !this.dancingNow() }));
    this.storyBtn = mk('story', '📖 Tell a story', () => this.net.send({ t: 'tell_story' }));
    this.jokeBtn = mk('joke', '😂 Tell a joke', () => this.net.send({ t: 'tell_joke' }));
    this.askBtn = mk('ask', '✋ Ask a question', () => this.net.send({ t: 'ask_question' }));
    this.endTalkBtn = mk('end', '🎙️ Finish talk', () => this.net.send({ t: 'end_talk' }));
  }

  private dancingNow() {
    const me = this.selfId ? this.views.get(this.selfId) : undefined;
    return me?.state.doing === 'dance';
  }

  /** Everyday life, every frame: class chip state, lectures, the ball, the sky and the rain. */
  private updateLife(t: number, dt: number, me: View | undefined) {
    const ts = performance.now();
    let inRoom = false;
    let indoor = false;
    let nearBall = false;
    if (me) {
      const px = me.x * TILE;
      const py = me.z * TILE;
      const zid = zoneAt(CAMPUS_MAP, px, py)?.id ?? null;
      inRoom = !!zid && (CLASS_ROOMS as readonly string[]).includes(zid);
      indoor = isIndoor(zid);
      nearBall = this.level === 'ground' && Math.hypot(this.ball.x - px, this.ball.y - py) <= KICK_RANGE;
    }
    this.lifeUi.setInRoom(inRoom);
    this.lifeUi.setPlace(me ? (zoneAt(CAMPUS_MAP, me.x * TILE, me.z * TILE)?.id ?? null) : null);
    {
      const inLecture = !!me && zoneAt(CAMPUS_MAP, me.x * TILE, me.z * TILE)?.id === 'lecture_area';
      const speaking = this.lifeUi.speaking;
      this.askBtn.style.display = inLecture && this.lifeUi.talkActive && !speaking ? 'block' : 'none';
      this.endTalkBtn.style.display = speaking ? 'block' : 'none';
    }
    this.lifeUi.update();
    this.kickBtn.style.display = nearBall ? 'block' : 'none';
    // dance / story / joke buttons
    let others = 0;
    const busy = !!me && !!me.state.doing && me.state.doing !== 'dance';
    if (me && this.selfId) {
      for (const v of this.views.values()) if (v !== me && Math.hypot(v.x - me.x, v.z - me.z) <= 4.4 && levelAt(v.z * TILE) === levelAt(me.z * TILE)) others++;
    }
    const dancing = !!me && me.state.doing === 'dance';
    const atParty = !!this.dj?.on && this.level === 'ground' && !!me && zoneAt(CAMPUS_MAP, me.x * TILE, me.z * TILE)?.id === 'student_center';
    this.danceBtn.style.display = me && !busy && !this.lifeUi.inSession ? 'block' : 'none';
    this.danceBtn.textContent = dancing ? '⏹ Stop dancing' : '💃 Dance';
    this.danceBtn.classList.toggle('on', dancing);
    this.danceBtn.classList.toggle('hot', atParty && !dancing);
    const social = !!me && !busy && others > 0 && !this.lifeUi.inSession;
    const talk = !!me && (me.state.doing === 'story' || me.state.doing === 'joke');
    this.storyBtn.style.display = social || talk ? 'block' : 'none';
    this.jokeBtn.style.display = social || talk ? 'block' : 'none';
    this.storyBtn.disabled = this.jokeBtn.disabled = talk;
    this.ball.update(dt);
    this.carousel.update(this.serverNow());

    // instructors lecture while a class is in session
    if (this.lifeUi.inSession && ts >= this.nextLecture) {
      this.nextLecture = ts + 7000 + Math.random() * 3000;
      for (const st of this.staff) {
        if (st.role !== 'instructor' || Math.random() > 0.6) continue;
        const z = zoneAt(CAMPUS_MAP, st.x * TILE, st.z * TILE)?.id ?? 'student_hall';
        const mood = this.lifeUi.mood;
        const seg = this.lifeUi.segmentId;
        const lines = seg && SEGMENT_LINES[seg] && Math.random() < 0.6 ? SEGMENT_LINES[seg] : mood && Math.random() < 0.4 ? MOODS[mood].lines : (LECTURE_LINES[z] ?? LECTURE_LINES.student_hall);
        this.staffBubble(st, lines[Math.floor(Math.random() * lines.length)], 5200);
      }
    }

    // the sky and the rain
    this.sky.update(dt, this.camera.position, indoor, this.level === 'upper', this.level === 'ground');
    const nk = Math.round(this.sky.night * 40) / 40;
    if (nk !== this.lastNightK) {
      this.lastNightK = nk;
      this.world.setNight(nk);
    }
    const rl = Math.round(this.sky.rainLevel * 20) / 20;
    if (rl !== this.lastRainLevel) {
      this.lastRainLevel = rl;
      this.music.setRain(indoor ? rl * 0.35 : rl);
    }
    void t;
  }

  private paintNow() {
    const on = !!this.dj?.on;
    const tr = this.dj ? TRACKS[this.dj.track] : null;
    if (on && tr) {
      this.nowTitle.textContent = `🎧 ${tr.name}`;
      this.nowSub.textContent = this.music.locked ? 'Tap anywhere to turn the sound on' : 'DJ at the Student Center';
    }
  }

  /** Every frame: local preview DJ, listener loudness, the "now playing" chip and the beat. */
  private updateParty(t: number, me: View | undefined) {
    const nowMs = Date.now();
    if (this.previewOn && !this.serverOn) {
      // no server party: run a pretend DJ so the lights and music can be tried
      if (nowMs >= this.localNext) {
        const prev = this.dj?.track ?? -1;
        let tk = Math.floor(Math.random() * TRACKS.length);
        if (tk === prev) tk = (tk + 1) % TRACKS.length;
        this.localNext = nowMs + 15000;
        this.applyDj({ on: true, track: tk, bpm: TRACKS[tk].bpm, startedAt: nowMs, now: nowMs, trackMs: 15000, endsAt: 0, nextAt: 0, energy: 0.8, shout: TRACKS[tk].intro });
      }
    }
    const dj = this.dj;
    const on = !!dj?.on || this.previewOn;
    let dist = 99;
    let inside = false;
    if (me) {
      dist = Math.hypot(me.x - this.partyCenter.x, me.z - this.partyCenter.z);
      inside = zoneAt(CAMPUS_MAP, me.x * TILE, me.z * TILE)?.id === 'student_center';
    }
    this.music.setListener(1 - dist / 22, inside);
    const show = on && dj && dist < 30;
    this.nowEl.style.display = show ? 'flex' : 'none';
    this.nightUi.setInside(inside);
    this.nightUi.shiftForMusic(!!show);
    this.nightUi.update();
    if (show && dj) {
      const sNow = nowMs + this.djSkew;
      const frac = Math.min(1, Math.max(0, (sNow - dj.startedAt) / dj.trackMs));
      this.nowBar.style.width = `${(frac * 100).toFixed(0)}%`;
    }
    const beat = dj ? (nowMs + this.djSkew - dj.startedAt) / 1000 : t;
    this.world.venue.update(t, beat);
  }

  /** Hold and drag the pad to walk; let go to stop. 8 directions, always relative to the screen. */
  private buildJoystick() {
    const pad = document.createElement('div');
    pad.className = 'c3d-joy';
    pad.setAttribute('role', 'application');
    pad.setAttribute('aria-label', 'Walk pad: hold and drag to walk');
    const thumb = document.createElement('i');
    pad.appendChild(thumb);
    for (const [t, l, tp] of [['▲', 50, 8], ['▼', 50, 92], ['◀', 8, 50], ['▶', 92, 50]] as const) {
      const a = document.createElement('b');
      a.textContent = t;
      a.style.left = `${l}%`;
      a.style.top = `${tp}%`;
      a.style.transform = 'translate(-50%,-50%)';
      pad.appendChild(a);
    }
    let pid = -1;
    const R = 64;
    const apply = (e: PointerEvent) => {
      const r = pad.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      thumb.style.transform = `translate(${dx * 0.55}px,${dy * 0.55}px)`;
      const dead = 14;
      const th = 0.38 * R;
      this.joy.x = d < dead ? 0 : Math.abs(dx) > th ? Math.sign(dx) : 0;
      this.joy.y = d < dead ? 0 : Math.abs(dy) > th ? Math.sign(dy) : 0;
      // a clean diagonal needs both axes; a mostly sideways push should not wobble up or down
      if (d >= dead && this.joy.x === 0 && this.joy.y === 0) {
        if (Math.abs(dx) > Math.abs(dy)) this.joy.x = Math.sign(dx);
        else this.joy.y = Math.sign(dy);
      }
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      pid = -1;
      this.joy.x = 0;
      this.joy.y = 0;
      thumb.style.transform = '';
      pad.classList.remove('on');
    };
    pad.addEventListener('pointerdown', (e) => {
      if (pid !== -1) return;
      pid = e.pointerId;
      pad.setPointerCapture(pid);
      pad.classList.add('on');
      e.preventDefault();
      e.stopPropagation();
      apply(e);
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId === pid) apply(e);
    });
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    this.overlay.appendChild(pad);
  }
  /** Try the party without the server: the P key or ?party=1. */
  private setPreview(on: boolean) {
    this.previewOn = on;
    if (on) {
      this.localNext = 0;
    } else if (!this.dj?.on) {
      this.party = false;
      this.world.venue.setParty(false);
      this.music.stop();
      this.djKey = '';
    }
  }
  private rotate(dir: number) {
    this.yawIdx = (this.yawIdx + dir + 4) % 4;
  }

  // ================================================================ input
  private typing() {
    const el = document.activeElement;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.typing()) return;
    const k = e.key.toLowerCase();
    if (k === 'q' && !e.repeat) this.rotate(-1);
    else if (k === 'e' && !e.repeat) this.rotate(1);
    else if (k === 'p' && !e.repeat) this.setPreview(!this.previewOn);
    else if (k === 'k' && !e.repeat) this.net.send({ t: 'kick' });
    else if (k === 'm' && !e.repeat) this.mapUi.toggle();
    else if (k === 'escape') { this.mapUi.close(); this.lifeUi.closeAll(); }
    this.keys.add(k);
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private onBlur = () => this.keys.clear();

  private bindInput() {
    const el = this.renderer.domElement;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onPointerDown = (e: PointerEvent) => {
    this.renderer.domElement.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) this.tapStart = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    else {
      if (this.tapStart) this.tapStart.moved = true;
      const [a, b] = [...this.pointers.values()];
      this.pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
      this.zoom0 = this.zoom;
    }
  };
  private onPointerMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch0 > 10) this.zoom = Math.min(1.7, Math.max(0.55, (this.zoom0 * this.pinch0) / Math.max(d, 1)));
    } else if (this.tapStart && Math.hypot(e.clientX - this.tapStart.x, e.clientY - this.tapStart.y) > 12) this.tapStart.moved = true;
  };
  private onPointerUp = (e: PointerEvent) => {
    const had = this.pointers.delete(e.pointerId);
    if (!had) return;
    const ts = this.tapStart;
    if (this.pointers.size === 0 && ts) {
      this.tapStart = null;
      if (!ts.moved && performance.now() - ts.t < 600 && e.type === 'pointerup') this.onTap(e.clientX, e.clientY);
    }
  };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.zoom = Math.min(1.7, Math.max(0.55, this.zoom * Math.exp(e.deltaY * 0.0012)));
  };

  private ray(clientX: number, clientY: number, planeY: number): { x: number; z: number } | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const nx = ((clientX - r.left) / r.width) * 2 - 1;
    const ny = -((clientY - r.top) / r.height) * 2 + 1;
    const dir = new THREE.Vector3(nx, ny, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    if (dir.y > -0.01) return null;
    const t = (planeY - this.camera.position.y) / dir.y;
    if (t <= 0) return null;
    return { x: this.camera.position.x + dir.x * t, z: this.camera.position.z + dir.z * t };
  }

  private screenOf(p: THREE.Vector3): { x: number; y: number; ok: boolean } {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = p.clone().project(this.camera);
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height, ok: v.z < 1 && v.z > -1 };
  }

  private onTap(cx: number, cy: number) {
    if (!this.selfId) return;
    // a tap on the ground while a pop-up is open just closes the pop-up; it does not move the player
    const open = this.overlay.querySelectorAll('.c3d-card.on');
    if (open.length) { open.forEach((el) => { if (!el.querySelector('[data-keep]')) el.classList.remove('on'); }); this.mapUi.close(); return; }
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const me = this.views.get(this.selfId);
    this.select(null);
    if (!me) return;

    // 1. a person: the closest one to the finger, within a generous reach
    let best: View | null = null;
    let bd = 46;
    const tmp = new THREE.Vector3();
    for (const v of this.views.values()) {
      if (v === me || levelAt(v.state.y) !== this.level) continue;
      const s = this.screenOf(tmp.set(v.x, this.world.heightAt(v.x, v.z) + 1.0, v.z));
      if (!s.ok) continue;
      const d = Math.hypot(s.x - cx, s.y - cy);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    if (best) return this.select(best.id);

    // 2. a free seat: the ring is drawn at seat height, so test there
    const sp = this.ray(cx, cy, 0.5);
    if (sp) {
      const seat = this.nearestFreeSeat(sp.x * TILE, sp.z * TILE, 30);
      if (seat && Math.hypot(seat.x - me.state.x, seat.y - me.state.y) <= SIT_MAX_DIST) {
        send({ t: 'sit', seat: seat.id });
        this.pulse(seat.x * U, seat.y * U, 0x7ee2a8);
        return;
      }
    }

    // 3. the ground: walk there
    const gp = this.ray(cx, cy, 0);
    if (gp) {
      send({ t: 'move_to', x: Math.round(gp.x * TILE), y: Math.round(gp.z * TILE) });
      this.pulse(gp.x, gp.z, 0xffffff);
    }
  }

  private occupiedSeats() {
    const s = new Set<string>();
    for (const v of this.views.values()) if (v.state.seat) s.add(v.state.seat);
    return s;
  }
  private nearestFreeSeat(x: number, y: number, range: number) {
    const taken = this.occupiedSeats();
    let best: (typeof CAMPUS_MAP.seats)[number] | null = null;
    let bd = range;
    for (const s of CAMPUS_MAP.seats) {
      if (taken.has(s.id)) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  private select(id: string | null) {
    this.selectedId = id;
    if (!id) {
      g.selected = null;
      this.selRing.visible = false;
    } else {
      g.history = null;
      send({ t: 'peek', id });
      this.refreshUi();
    }
  }

  private readKeyboard() {
    if (!this.selfId) return;
    const k = this.keys;
    const off = this.typing();
    const kx = off ? 0 : (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const ky = off ? 0 : (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    const sx = kx || this.joy.x;
    const sy = ky || this.joy.y;
    // screen directions -> map directions, for whichever way the camera is turned
    const c = [1, 0, -1, 0][this.yawIdx];
    const s = [0, 1, 0, -1][this.yawIdx];
    const x = Math.sign(c * sx + s * sy);
    const y = Math.sign(-s * sx + c * sy);
    if (x !== this.lastDir.x || y !== this.lastDir.y) {
      this.lastDir = { x, y };
      send({ t: 'dir', x, y });
    }
  }

  // ================================================================ network
  private onMessage(m: ServerMsg) {
    switch (m.t) {
      case 'welcome': {
        this.selfId = m.selfId;
        g.selfId = m.selfId;
        g.money = m.self.money;
        g.mischief = m.self.mischief;
        this.nightUi.setSelf(m.self.money, m.self.ticket, m.selfId);
        this.lifeUi.setMoney(m.self.money);
        this.lifeUi.setSelf(m.selfId);
        for (const v of [...this.views.values()]) this.removeView(v);
        this.views.clear();
        for (const p of m.players) this.addView(p);
        const me = this.views.get(m.selfId);
        if (me) {
          this.setLevel(levelAt(me.state.y));
          this.target.set(me.x, 0, me.z);
          this.camInit = true;
        }
        g.online = this.views.size;
        g.status = 'online';
        break;
      }
      case 'player_joined': {
        const old = this.views.get(m.player.id);
        if (old) this.removeView(old);
        this.addView(m.player);
        g.online = this.views.size;
        break;
      }
      case 'player_left': {
        const v = this.views.get(m.id);
        if (v) this.removeView(v);
        this.views.delete(m.id);
        if (this.selectedId === m.id) this.select(null);
        g.online = this.views.size;
        break;
      }
      case 'player_state': {
        const v = this.views.get(m.player.id);
        if (v) {
          v.state = m.player;
          this.applyState(v);
        }
        break;
      }
      case 'snap':
        for (const mv of m.moves) {
          const v = this.views.get(mv.id);
          if (!v) continue;
          v.tx = mv.x * U;
          v.tz = mv.y * U;
          v.state.x = mv.x;
          v.state.y = mv.y;
          v.state.moving = mv.m;
          if (v.state.facing !== mv.f) {
            v.state.facing = mv.f;
            this.applyState(v);
          }
        }
        break;
      case 'self':
        g.money = m.self.money;
        g.mischief = m.self.mischief;
        this.nightUi.setSelf(m.self.money, m.self.ticket, this.selfId ?? '');
        this.lifeUi.setMoney(m.self.money);
        break;
      case 'speech': {
        const v = this.views.get(m.id);
        if (v) this.showBubble(v, m.text, m.q);
        break;
      }
      case 'whisper':
        toast(m.from === this.selfId ? `To ${m.toName}: ${m.text}` : `${m.fromName} (private): ${m.text}`, 'info');
        break;
      case 'emote': {
        const v = this.views.get(m.id);
        if (v) this.showEmote(v, EMOTE_ICONS[m.kind], m.kind === 'dance');
        break;
      }
      case 'invite':
        g.invites = [...g.invites.filter((i) => i.id !== m.id), { id: m.id, fromName: m.fromName, place: m.place, expiresAt: Date.now() + m.ttl }];
        break;
      case 'invite_result':
        toast(m.accepted ? `${m.name} is coming.` : `${m.name} can't make it.`, m.accepted ? 'good' : 'info');
        break;
      case 'help_started':
        g.help = { withName: m.withName, kind: m.kind, role: m.role, pct: 0 };
        break;
      case 'help_progress':
        if (g.help) g.help.pct = m.pct;
        break;
      case 'help_done':
        g.help = null;
        toast(m.role === 'helper' ? `You helped ${m.withName}.${m.reward ? ` +${m.reward} LD` : ''}` : `${m.withName} helped you out.`, 'good');
        break;
      case 'help_ended':
        g.help = null;
        toast(`Help ended. ${m.reason}`, 'info');
        break;
      case 'mischief': {
        const actor = this.views.get(m.actor);
        const victim = this.views.get(m.victim);
        if (m.kind === 'steal') {
          if (victim) this.showEmote(victim, '😠', false);
          if (actor) this.showEmote(actor, '😏', false);
        } else if (m.kind === 'prank') {
          if (victim) {
            this.showEmote(victim, '😂', false);
            victim.shakeUntil = performance.now() + 380;
          }
        } else if (actor) this.showEmote(actor, '💪', false);
        break;
      }
      case 'groups':
        this.groups = m.groups;
        break;
      case 'campus_event': {
        const me = this.selfId ? this.views.get(this.selfId) : undefined;
        const level = levelAt(m.y);
        const close = !!me && levelAt(me.state.y) === level && Math.hypot(me.state.x - m.x, me.state.y - m.y) <= EVENT_NEAR_RANGE;
        if (!close) toast(m.text, m.tone);
        if (m.kind !== 'buzz') this.addMarker(m.id, m.x * U, m.y * U, level);
        break;
      }
      case 'history':
        if (m.id === this.selectedId) g.history = { id: m.id, line: m.line, known: m.known };
        break;
      case 'notice':
        toast(m.text, m.tone);
        break;
      case 'night':
        this.nightPhase = m.phase;
        this.stageBusy = !!m.onStage;
        this.nightUi.apply(m);
        break;
      case 'clock':
        if (m.now) this.clockSkew = m.now - Date.now();
        this.lifeUi.applyClock(m);
        this.sky.setClock(m);
        break;
      case 'jobs':
        this.lifeUi.applyJobs(m.slots);
        break;
      case 'job':
        this.lifeUi.applyJob(m.job);
        break;
      case 'board':
        this.lifeUi.applyBoard(m.jobs, m.now);
        break;
      case 'talk':
        this.lifeUi.applyTalk(m);
        break;
      case 'quiz':
        this.lifeUi.applyQuiz(m.quiz);
        break;
      case 'race':
        this.lifeUi.applyRace(m);
        break;
      case 'games':
        this.lifeUi.applyGames(m);
        break;
      case 'academics':
        this.lifeUi.applyAcademics(m);
        break;
      case 'open':
        this.lifeUi.open(m.what);
        break;
      case 'ball':
        this.ball.apply(m);
        if (m.goalBy) toast(`⚽ GOAL! ${m.goalBy} scores!`, 'fun');
        break;
      case 'weather':
        this.sky.setWeather(m.kind);
        break;
      case 'gate':
        this.nightUi.gate(m);
        this.staffSay('security', m.line);
        break;
      case 'dj':
        this.serverOn = m.on;
        this.applyDj(m);
        break;
      case 'pong':
        g.ping = Math.round(performance.now() - m.ts);
        break;
      case 'error':
        console.warn('[server]', m.message);
        break;
    }
  }

  // ================================================================ players
  private addView(p: PlayerState) {
    const isSelf = p.id === this.selfId;
    const rig = this.factory.make(p.avatar);
    rig.snapFacing(p.facing);
    this.actors.add(rig.root);

    const tag = document.createElement('div');
    tag.className = 'c3d-tag';
    tag.style.display = 'none';
    const line = document.createElement('div');
    line.className = 'c3d-name' + (isSelf ? ' self' : '');
    const mark = document.createElement('span');
    const nm = document.createElement('span');
    nm.textContent = p.name.slice(0, MAX_NAME_LENGTH);
    line.append(mark, nm);
    tag.appendChild(line);
    const edu = document.createElement('div');
    edu.className = 'c3d-edu';
    tag.appendChild(edu);
    this.overlay.appendChild(tag);

    const v: View = {
      id: p.id, state: p, rig, x: p.x * U, z: p.y * U, tx: p.x * U, tz: p.y * U,
      tag, mark, edu, bubble: null, bubbleTimer: 0, tagShown: false, danceUntil: 0, style: styleOf(p.id), shakeUntil: 0
    };
    this.views.set(p.id, v);
    this.applyState(v);
  }

  private removeView(v: View) {
    this.actors.remove(v.rig.root);
    window.clearTimeout(v.bubbleTimer);
    v.tag.remove();
  }

  private applyState(v: View) {
    const s = v.state;
    const col = collegeOf(s.col);
    v.edu.textContent = s.yr && col ? `${s.yr > YEARS ? '🎓 Graduate' : `Year ${s.yr}`} · ${col.short}` : '';
    v.mark.textContent =
      s.asking ? '🙋' : s.hotFor ? '🏃' : s.watched ? '👀' : s.doing === 'perform' ? '🎤' : s.doing === 'present' ? '🎙️' : s.doing === 'study' ? '📚' : s.doing === 'spin' ? '🎠' : s.team ? (s.team === 'blue' ? '🔵' : '🔴') : s.doing === 'dance' ? '💃' : s.doing === 'story' ? '📖' : s.doing === 'joke' ? '😂' : s.glow ? '✨' : s.doing === 'sneak' ? '🤫' : s.doing === 'ride' ? '🏍️' : s.doing === 'work' ? '🛠️' : s.eating ? '😋' : '';
    if (v.id === this.selfId) {
      g.seated = !!s.seat;
      g.holding = !!s.held;
      g.eating = s.eating;
      g.asking = !!s.asking;
      g.following = !!s.following;
      g.doing = s.doing;
      g.watched = s.watched;
    }
  }

  private showBubble(v: View, text: string, quick: boolean) {
    window.clearTimeout(v.bubbleTimer);
    v.bubble?.remove();
    const b = document.createElement('div');
    b.className = 'c3d-bubble';
    b.textContent = text;
    if (quick) b.style.fontSize = '14px';
    v.tag.insertBefore(b, v.tag.firstChild);
    v.bubble = b;
    requestAnimationFrame(() => b.classList.add('on'));
    const life = Math.min(6500, Math.max(2200, 1800 + text.length * 55));
    v.bubbleTimer = window.setTimeout(() => {
      b.classList.remove('on');
      window.setTimeout(() => {
        b.remove();
        if (v.bubble === b) v.bubble = null;
      }, 400);
    }, life);
  }

  private showEmote(v: View, icon: string, dance: boolean) {
    const e = document.createElement('div');
    e.className = 'c3d-emote';
    e.textContent = icon;
    v.tag.appendChild(e);
    window.setTimeout(() => e.remove(), 1400);
    if (dance) v.danceUntil = performance.now() + (this.party ? 6000 : 3500);
  }

  // ================================================================ events: pulses, markers
  private pulse(x: number, z: number, color: number) {
    const p = this.pulses.reduce((a, b) => (a.start < b.start ? a : b));
    p.start = performance.now();
    p.mesh.position.set(x, 0.06, z);
    (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    p.mesh.visible = true;
  }

  private addMarker(id: number, x: number, z: number, level: Level) {
    const mat = new THREE.MeshBasicMaterial({ map: this.markerTex, color: 0xffb62e, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
    const mesh = new THREE.Mesh(this.markerGeo, mat);
    mesh.position.set(x, 0.07, z);
    mesh.renderOrder = 6;
    this.scene.add(mesh);
    this.markers.push({ id, x, z, level, until: performance.now() + EVENT_MARKER_MS, mesh });
    if (this.markers.length > 4) this.dropMarker(this.markers.shift()!);
  }
  private dropMarker(m: Marker) {
    this.scene.remove(m.mesh);
    (m.mesh.material as THREE.Material).dispose();
  }

  // ================================================================ per-frame
  private setLevel(level: Level) {
    this.level = level;
    this.world.setLevel(level);
    if (level === 'upper') {
      this.scene.background = new THREE.Color(0x1a1613);
      this.scene.fog = new THREE.Fog(0x1a1613, 40, 140);
    } else {
      this.scene.background = null;
      this.scene.fog = new THREE.Fog(0xcfe0d9, 70, 290);
    }
    const me = this.selfId ? this.views.get(this.selfId) : undefined;
    if (me) this.target.set(me.x, 0, me.z);
  }

  private refreshUi() {
    const me = this.selfId ? this.views.get(this.selfId) : undefined;
    if (!me) return;
    const px = me.x * TILE;
    const py = me.z * TILE;
    const spot = nearestSpot(CAMPUS_MAP, px, py, SPOT_REACH);
    g.spot = spot ? { id: spot.id, kind: spot.kind, label: spot.label, price: spot.price } : null;
    const zoneId = zoneAt(CAMPUS_MAP, px, py)?.id;
    g.inClass = !!zoneId && CLASS_ZONES.includes(zoneId);
    if (this.selectedId) {
      const v = this.views.get(this.selectedId);
      if (!v) return this.select(null);
      g.selected = {
        state: { ...v.state },
        dist: Math.hypot(v.x * TILE - px, v.z * TILE - py),
        sameLevel: levelAt(v.z * TILE) === levelAt(py)
      };
    }
  }

  private drawSeatHints(me: View) {
    const taken = this.occupiedSeats();
    let near = false;
    let i = 0;
    if (!me.state.seat) {
      const px = me.x * TILE;
      const py = me.z * TILE;
      for (const s of CAMPUS_MAP.seats) {
        if (i >= this.seatHints.length) break;
        if (taken.has(s.id) || levelAt(s.y) !== levelAt(py)) continue;
        const d = Math.hypot(s.x - px, s.y - py);
        if (d > SEAT_HINT_RANGE) continue;
        if (d < 70) near = true;
        const m = this.seatHints[i++];
        m.position.set(s.x * U, 0.5, s.y * U);
        m.visible = true;
      }
    }
    for (; i < this.seatHints.length; i++) this.seatHints[i].visible = false;
    g.nearSeat = near;
  }

  private frame() {
    if (this.disposed || this.failed) return;
    try {
      this.step();
    } catch (e) {
      this.failed = true;
      console.error('[3d] render failed, falling back', e);
      this.renderer.setAnimationLoop(null);
      this.onFatal(e);
    }
  }

  private step() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;

    // adapt to the phone: if it struggles, quietly lower the quality
    this.fpsT += dt;
    this.fpsN++;
    if (this.fpsT >= 2) {
      const fps = this.fpsN / this.fpsT;
      this.fpsT = 0;
      this.fpsN = 0;
      this.lowStreak = fps < 26 ? this.lowStreak + 1 : 0;
      if (this.lowStreak >= 2 && this.tier > 0) {
        this.tier--;
        this.lowStreak = 0;
        this.applyTier();
        this.resize();
      }
      if (this.statsEl) {
        const i = this.renderer.info;
        this.statsEl.textContent = `${fps.toFixed(0)} fps  tier ${this.tier}\ncalls ${i.render.calls}  tris ${(i.render.triangles / 1000).toFixed(0)}k\ntex ${i.memory.textures}  geo ${i.memory.geometries}\ndpr ${this.renderer.getPixelRatio().toFixed(2)}`;
      }
    }

    const k = 1 - Math.exp(-dt * 14);
    for (const v of this.views.values()) {
      const dx = v.tx - v.x;
      const dz = v.tz - v.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 6.9 * 6.9) {
        v.x = v.tx;
        v.z = v.tz;
      } else {
        v.x += dx * k;
        v.z += dz * k;
      }
      const sameLevel = levelAt(v.z * TILE) === this.level;
      v.rig.root.visible = sameLevel;
      const onStage = v.state.doing === 'perform';
      let rx = v.x;
      let rz = v.z;
      const spinning = v.state.doing === 'spin';
      if (spinning) { const q = Carousel3D.riderAt(v.tx, v.tz, this.serverNow()); rx = v.x = q.x; rz = v.z = q.z; }
      const y = this.world.heightAt(rx, rz) + (onStage ? 0.6 : v.state.doing === 'present' ? 0.15 : spinning ? CAROUSEL_LIFT : 0);
      let ox = 0;
      if (now < v.shakeUntil) ox = Math.sin(now * 0.06) * 0.05;
      v.rig.root.position.set(rx + ox, y, rz);
      v.rig.update(t, dt, {
        moving: v.state.moving || d2 > 0.0025,
        sitting: !!v.state.seat,
        eating: v.state.eating,
        dancing: v.state.doing === 'dance' || now < v.danceUntil || onStage,
        danceStyle: v.style,
        bpm: this.dj?.on ? this.dj.bpm : 110,
        holding: !!v.state.held,
        hot: !!v.state.hotFor,
        facing: v.state.facing
      });
    }

    this.readKeyboard();

    const me = this.selfId ? this.views.get(this.selfId) : undefined;
    if (me) {
      const lvl = levelAt(me.z * TILE);
      if (lvl !== this.level) this.setLevel(lvl);
      const px = me.x * TILE;
      const py = me.z * TILE;
      const zone = zoneAt(CAMPUS_MAP, px, py);
      const name = zone?.name ?? 'Campus grounds';
      if (name !== this.lastZone) {
        this.lastZone = name;
        g.zone = name;
      }
      // roofs fade away when you go inside, so you can see the room
      const tx = Math.floor(me.x);
      const tz = Math.floor(me.z);
      for (const b of this.world.buildings) {
        const target = b.level === this.level && inRect(b.rect, tx, tz) ? 0 : 1;
        const o = b.mat.opacity + (target - b.mat.opacity) * Math.min(1, dt * 6);
        b.mat.opacity = o;
        b.mat.depthWrite = o > 0.98;
        b.mat.visible = o > 0.02;
      }
      for (const h of this.world.huts) {
        const target = zone?.id === h.zone ? 0.12 : 1;
        const o = h.mat.opacity + (target - h.mat.opacity) * Math.min(1, dt * 6);
        h.mat.opacity = o;
        h.mat.depthWrite = o > 0.98;
      }
    }

    this.updateCamera(dt, me);

    if (now >= this.nextUi) {
      this.nextUi = now + 200;
      this.refreshUi();
    }
    if (now >= this.nextHints && me) {
      this.nextHints = now + 250;
      this.drawSeatHints(me);
    }

    this.updateDecals(now, me);
    this.updateParty(t, me);
    this.updateLife(t, dt, me);
    this.updateStaff(t, dt, me);
    this.updateTags(me);
    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(dt: number, me: View | undefined) {
    if (me) {
      const y = this.world.heightAt(me.x, me.z);
      if (!this.camInit) {
        this.target.set(me.x, y, me.z);
        this.camInit = true;
      } else {
        const k = 1 - Math.exp(-dt * 7);
        this.target.x += (me.x - this.target.x) * k;
        this.target.z += (me.z - this.target.z) * k;
        this.target.y += (y - this.target.y) * k;
      }
    }
    // turn smoothly toward the chosen quarter turn
    const want = this.yawIdx * (Math.PI / 2);
    let d = want - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 8);

    const asp = this.camera.aspect;
    const dist = BASE_DIST * num('dist', 1) * this.zoom * (asp < 0.8 ? 1 + (0.8 - asp) * 0.9 : 1);
    const pitch = num('pitch', 52) === 52 ? PITCH : (num('pitch', 52) * Math.PI) / 180;
    const cp = Math.cos(pitch);
    this.camera.position.set(this.target.x + Math.sin(this.yaw) * cp * dist, this.target.y + 0.9 + Math.sin(pitch) * dist, this.target.z + Math.cos(this.yaw) * cp * dist);
    this.camera.lookAt(this.target.x, this.target.y + 0.9, this.target.z);
    this.world.sky.position.copy(this.camera.position);

    const so = this.sky.sunOffset;
    this.sun.position.set(this.target.x + so.x, so.y, this.target.z + so.z);
    this.sun.target.position.set(this.target.x, 0, this.target.z);
    this.sun.target.updateMatrixWorld();

    // see-through hole between the camera and the player
    cut.a.value.copy(this.camera.position);
    cut.b.value.set(this.target.x, this.target.y + 1.2, this.target.z);
    cut.r.value = me ? 2.4 : 0;
  }

  private updateDecals(now: number, me: View | undefined) {
    for (const p of this.pulses) {
      const a = (now - p.start) / 450;
      if (a >= 1) {
        p.mesh.visible = false;
        continue;
      }
      p.mesh.scale.setScalar(0.5 + a * 1.1);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - a);
    }

    const pulse = 0.5 + 0.5 * Math.sin(now / 500);
    let gi = 0;
    for (const grp of this.groups) {
      if (grp.level !== this.level || gi >= this.groupMeshes.length) continue;
      const m = this.groupMeshes[gi++];
      const r = (grp.r + Math.min(30, grp.n * 3)) * U;
      m.position.set(grp.x * U, 0.05, grp.y * U);
      m.scale.set(r * 2, 1, r * 1.5);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.setHex(GROUP_COLORS[grp.kind]);
      mat.opacity = 0.3 + 0.2 * pulse;
      m.visible = true;
    }
    for (; gi < this.groupMeshes.length; gi++) this.groupMeshes[gi].visible = false;

    if (this.selectedId) {
      const v = this.views.get(this.selectedId);
      if (v && levelAt(v.z * TILE) === this.level) {
        this.selRing.position.set(v.x, this.world.heightAt(v.x, v.z) + 0.05, v.z);
        this.selRing.visible = true;
      } else this.selRing.visible = false;
    }

    // campus event rings + an arrow toward the latest one that is off screen
    let target: Marker | null = null;
    for (const mk of [...this.markers]) {
      if (now > mk.until) {
        this.dropMarker(mk);
        this.markers = this.markers.filter((x) => x !== mk);
        continue;
      }
      mk.mesh.visible = mk.level === this.level;
      mk.mesh.scale.setScalar(2.4 + 0.5 * Math.sin(now / 280));
      if (mk.level === this.level) {
        const v = new THREE.Vector3(mk.x, 0, mk.z).project(this.camera);
        if (!(v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.9)) target = mk;
      }
    }
    if (!target || !me) {
      this.arrowEl.style.display = 'none';
      return;
    }
    const v = new THREE.Vector3(target.x, 0, target.z).project(this.camera);
    if (v.z > 1) {
      v.x = -v.x;
      v.y = -v.y;
    }
    const s = 1 / Math.max(Math.abs(v.x) / 0.9, Math.abs(v.y) / 0.82, 0.0001);
    const W = this.overlay.clientWidth;
    const H = this.overlay.clientHeight;
    const sx = (v.x * s * 0.5 + 0.5) * W;
    const sy = (-v.y * s * 0.5 + 0.5) * H;
    this.arrowEl.style.display = 'block';
    this.arrowEl.style.transform = `translate(${sx - 15}px,${sy - 15}px) rotate(${Math.atan2(-v.y, v.x)}rad)`;
  }

  private updateTags(me: View | undefined) {
    const W = this.overlay.clientWidth;
    const H = this.overlay.clientHeight;
    const p = new THREE.Vector3();
    for (const v of this.views.values()) {
      let show = false;
      if (levelAt(v.z * TILE) === this.level && me) {
        const far = Math.hypot(v.x - me.x, v.z - me.z) > 32;
        p.set(v.x, this.world.heightAt(v.x, v.z) + (v.state.seat ? 1.65 : 1.95), v.z).project(this.camera);
        if (!far && p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1) {
          show = true;
          v.tag.style.transform = `translate(${((p.x * 0.5 + 0.5) * W).toFixed(1)}px,${((-p.y * 0.5 + 0.5) * H).toFixed(1)}px) translate(-50%,-100%)`;
        }
      }
      if (show !== v.tagShown) {
        v.tagShown = show;
        v.tag.style.display = show ? 'flex' : 'none';
      }
    }
  }

  // ================================================================ instructors (scenery for now)
  /** The people standing around campus (security at the gate, instructors at boards, the administrator). */
  private buildStaff() {
    this.routes = buildRoutes(CAMPUS_MAP);
    const people = [...CAMPUS_MAP.npcs, ...this.routes.map((r) => ({ id: r.def.id, role: 'security' as const, label: r.def.label, x: 0, y: 0, facing: 'down' as Facing, level: 'ground' as const, skin: r.def.look[0], shirt: r.def.look[1], hair: r.def.look[2], gender: r.def.look[3], elev: 0, route: r }))];
    for (const n of people) {
      const rig = this.factory.make({ skin: n.skin, shirt: n.shirt, hair: n.hair, gender: n.gender });
      rig.snapFacing(n.facing);
      rig.root.position.set(n.x, n.elev ?? 0, n.y);
      this.actors.add(rig.root);
      const tag = document.createElement('div');
      tag.className = 'c3d-tag';
      tag.style.display = 'none';
      const line = document.createElement('div');
      line.className = 'c3d-name';
      line.textContent = n.label;
      line.style.color = n.role === 'security' ? '#ffd27a' : n.role === 'dj' || n.role === 'dancer' || n.role === 'singer' || n.role === 'reveler' ? '#ff9de2' : '#bfe6ff';
      tag.appendChild(line);
      if (n.role === 'instructor') { const es = document.createElement('div'); es.className = 'c3d-edu'; tag.appendChild(es); (tag as HTMLDivElement & { es?: HTMLDivElement }).es = es; }
      this.overlay.appendChild(tag);
      const route = (n as { route?: Route }).route;
      if (route) { const g0 = guardAt(route, this.serverNow()); n.x = g0.x / TILE; n.y = g0.y / TILE; rig.root.position.set(n.x, 0, n.y); }
      this.staff.push({ home: { x: n.x, z: n.y }, ridx: this.staff.length, route, rig, tag, x: n.x, z: n.y, level: n.level, shown: false, role: n.role, elev: n.elev ?? 0, style: this.staff.length % 5 });
    }
  }

  private updateStaff(t: number, dt: number, me: View | undefined) {
    const W = this.overlay.clientWidth;
    const H = this.overlay.clientHeight;
    const p = new THREE.Vector3();
    const sn = this.serverNow();
    for (const st of this.staff) {
      if (st.route) {
        const g = guardAt(st.route, sn);
        st.x = g.x / TILE; st.z = g.y / TILE;
        st.walking = g.moving; st.face = g.facing;
        st.rig.root.position.set(st.x, this.world.heightAt(st.x, st.z), st.z);
      }
      const same = st.level === this.level;
      let present = st.role !== 'reveler' || this.party;
      if (st.role === 'singer') present = this.party && !this.stageBusy;
      if (this.party && st.home) {
        const beatMs = 60000 / (this.dj?.bpm || 120);
        const bar = Math.floor(sn / (beatMs * 8));
        if (st.role === 'dancer' || st.role === 'singer' || st.role === 'dj') st.style = (bar + (st.ridx ?? 0)) % 5;
        else if (st.role === 'reveler') {
          // wander the dance floor: walk to a new spot every 8 seconds, then dance there
          const idx = st.ridx ?? 0;
          const pt = (k: number) => ({
            x: Math.min(52.2, Math.max(45.8, st.home!.x + (hash01(`rx${idx}:${k}`) - 0.5) * 5)),
            z: Math.min(13.2, Math.max(6.6, st.home!.z + (hash01(`rz${idx}:${k}`) - 0.5) * 5))
          });
          const cyc = Math.floor(sn / 8000);
          const ph = (sn % 8000) / 8000;
          const a0 = pt(cyc), b0 = pt(cyc + 1);
          const k = Math.min(1, ph / 0.35);
          st.x = a0.x + (b0.x - a0.x) * k;
          st.z = a0.z + (b0.z - a0.z) * k;
          st.walking = k < 1;
          st.face = Math.abs(b0.x - a0.x) > Math.abs(b0.z - a0.z) ? (b0.x > a0.x ? 'right' : 'left') : b0.z > a0.z ? 'down' : 'up';
          st.style = (cyc + idx) % 5;
          st.rig.root.position.set(st.x, 0, st.z);
        }
      }
      st.rig.root.visible = same && present;
      let show = false;
      if (same && me && present) {
        st.rig.update(t, dt, { moving: !!st.walking, sitting: false, eating: false, dancing: this.party && (st.role === 'dj' || st.role === 'dancer' || st.role === 'singer' || (st.role === 'reveler' && !st.walking)), danceStyle: st.style, bpm: this.dj?.bpm ?? 120, holding: false, hot: false, facing: st.face ?? (st.rig.root.rotation.y > 1.5 ? 'up' : 'down') });
        if (st.role === 'instructor') {
          const es = (st.tag as HTMLDivElement & { es?: HTMLDivElement }).es;
          const ph = this.lifeUi.phase;
          const md = this.lifeUi.mood;
          const txt = ph === 'class' ? `${md ? MOODS[md].icon : '📖'} teaching${md ? ` · ${MOODS[md].label}` : ''}` : ph === 'break' ? '☕ on break' : ph === 'free' ? '📝 office hours' : '🌙 off duty';
          if (es && es.textContent !== txt) es.textContent = txt;
        }
        if (Math.hypot(st.x - me.x, st.z - me.z) < 9) {
          p.set(st.x, 1.95, st.z).project(this.camera);
          if (p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1) {
            show = true;
            st.tag.style.transform = `translate(${((p.x * 0.5 + 0.5) * W).toFixed(1)}px,${((-p.y * 0.5 + 0.5) * H).toFixed(1)}px) translate(-50%,-100%)`;
          }
        }
      }
      if (show !== st.shown) {
        st.shown = show;
        st.tag.style.display = show ? 'flex' : 'none';
      }
    }
  }

  // ================================================================ teardown
  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    for (const t of this.timers) window.clearInterval(t);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.resizeObs.disconnect();
    this.net?.close();
    setSender(() => {});
    for (const v of this.views.values()) {
      window.clearTimeout(v.bubbleTimer);
    }
    for (const m of this.markers) this.dropMarker(m);
    for (const o of [...this.pulses, ...this.seatHints.map((mesh) => ({ mesh })), ...this.groupMeshes.map((mesh) => ({ mesh }))]) {
      (o.mesh.material as THREE.Material).dispose();
    }
    (this.selRing.material as THREE.Material).dispose();
    for (const x of this.geos) x.dispose();
    for (const x of this.mats) x.dispose();
    for (const x of this.tex) x.dispose();
    this.factory.dispose();
    this.world.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.nightUi.dispose();
    this.lifeUi.dispose();
    this.mapUi.dispose();
    this.ball.dispose();
    this.sky.dispose();
    this.music.dispose();
    this.overlay.remove();
    this.styleEl.remove();
  }
}

/** Mounts the 3D campus. Returns a cleanup function. Throws if WebGL is unavailable. */
export function startCampus3D(parent: HTMLElement, profile: Profile, onFatal: (e: unknown) => void): () => void {
  const c = new Campus3D(parent, profile, onFatal);
  return () => c.dispose();
}
