import { TRACKS, TRACK_MS } from '@campus/shared';

/**
 * The party music. Nothing is downloaded: each track is played by a tiny synthesiser (drums, bass, chords, a
 * hook) built with the Web Audio API, so there are no files, no rights to clear, and it costs almost no data.
 * The server says which track and when it began; every phone plays the same bar at the same moment.
 */

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MINOR_PENT = [0, 3, 5, 7, 10];

interface Pattern {
  scale: number[];
  /** MIDI note of the key's root (degree 0). */
  root: number;
  /** Chord root degree for each of 4 bars. */
  chords: number[];
  /** Chord shape in scale steps above the chord root. */
  shape: number[];
  /** 16 steps, 'x' = hit, 'o' = soft hit. */
  kick: string;
  snare: string;
  hat: string;
  perc: string;
  /** Bass: degree offset from the chord root per step (null = rest). */
  bass: Array<number | null>;
  /** Chord stabs: which steps play the chord. */
  stab: string;
  /** Hook: absolute scale degree for 32 steps (2 bars), null = rest. */
  lead: Array<number | null>;
  leadWave: OscillatorType;
  bassWave: OscillatorType;
  percKind: 'conga' | 'shaker' | 'log' | 'clap';
  swing: number;
  /** Chords hold (pad) rather than stab. */
  pad?: boolean;
}

const N = null;

const PATTERNS: Pattern[] = [
  // 0 Afrobeat
  {
    scale: MINOR_PENT, root: 45, chords: [0, 0, 3, 4], shape: [0, 2, 4, 6],
    kick: 'x..o..x...x..o..', snare: '....x.......x..o', hat: 'xoxoxoxoxoxoxoxo', perc: 'x..x.x..x..x.x..',
    bass: [0, N, N, 0, N, 2, N, N, 0, N, N, 0, N, 3, N, N], stab: '..x...x...x...x.',
    lead: [7, N, 6, N, 5, N, 4, 5, N, N, 4, N, 2, N, N, N, 7, N, 6, N, 5, N, 7, N, 9, N, 7, N, 5, N, N, N],
    leadWave: 'square', bassWave: 'sawtooth', percKind: 'conga', swing: 0.04
  },
  // 1 Highlife
  {
    scale: MAJOR, root: 48, chords: [0, 3, 4, 3], shape: [0, 2, 4],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', perc: 'x.xxx.xxx.xxx.xx',
    bass: [0, N, 2, N, 4, N, 2, N, 0, N, 2, N, 4, N, 2, N], stab: 'x...x...x...x...',
    lead: [14, 12, 11, 9, 11, 12, 14, N, 11, 9, 7, 9, 11, N, N, N, 14, 12, 11, 9, 11, 12, 14, 16, 14, N, 11, N, 9, N, N, N],
    leadWave: 'triangle', bassWave: 'triangle', percKind: 'shaker', swing: 0.02
  },
  // 2 Hipco (boom bap)
  {
    scale: MINOR, root: 42, chords: [0, 0, 5, 4], shape: [0, 2, 4, 6], pad: true,
    kick: 'x.....x..x....o.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xo', perc: '..............x.',
    bass: [0, N, N, N, N, N, 0, N, N, 0, N, N, N, N, N, N], stab: 'x...............',
    lead: [N, N, N, N, 7, N, 6, N, 4, N, N, N, N, N, N, N, N, N, N, N, 7, N, 9, N, 7, N, 6, N, N, N, N, N],
    leadWave: 'sawtooth', bassWave: 'sine', percKind: 'clap', swing: 0.08
  },
  // 3 Amapiano
  {
    scale: MINOR, root: 45, chords: [0, 5, 3, 4], shape: [0, 2, 4, 6, 8],
    kick: 'x...x...x...x...', snare: '................', hat: '..x...x...x...x.', perc: 'x.xx.xx.x.xx.xx.',
    bass: [0, N, N, 0, N, N, 2, N, N, 0, N, N, 4, N, N, 2], stab: '..x..x...x..x...',
    lead: [N, N, 11, N, N, 9, N, 7, N, N, 9, N, N, N, N, N, N, N, 11, N, N, 12, N, 11, N, N, 9, N, 7, N, N, N],
    leadWave: 'triangle', bassWave: 'sine', percKind: 'log', swing: 0.03
  },
  // 4 Reggae (one drop)
  {
    scale: MAJOR, root: 43, chords: [0, 0, 3, 4], shape: [0, 2, 4],
    kick: '........x.......', snare: '........x.......', hat: 'x.x.x.x.x.x.x.x.', perc: '..x...x...x...x.',
    bass: [0, N, N, 0, N, N, 2, N, 4, N, N, 4, N, 2, N, N], stab: '..x...x...x...x.',
    lead: [N, N, N, N, 9, N, 7, N, 4, N, N, N, N, N, N, N, N, N, N, N, 9, N, 11, N, 9, N, 7, N, N, N, N, N],
    leadWave: 'square', bassWave: 'triangle', percKind: 'shaker', swing: 0.1
  },
  // 5 Gospel house
  {
    scale: MAJOR, root: 50, chords: [0, 3, 4, 5], shape: [0, 2, 4, 6],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', perc: '....x.......x...',
    bass: [0, N, 0, N, 0, N, 0, N, 0, N, 0, N, 0, N, 4, N], stab: 'x..x..x...x..x..',
    lead: [14, N, 16, N, 18, N, 16, N, 14, N, 12, N, 14, N, N, N, 14, N, 16, N, 18, N, 19, N, 18, N, 16, N, 14, N, N, N],
    leadWave: 'sawtooth', bassWave: 'sawtooth', percKind: 'clap', swing: 0
  }
];

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const degMidi = (p: Pattern, deg: number) => {
  const n = p.scale.length;
  const oct = Math.floor(deg / n);
  return p.root + p.scale[((deg % n) + n) % n] + oct * 12;
};

function readNum(key: string, d: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    return localStorage.getItem(key) !== null && Number.isFinite(v) ? v : d;
  } catch {
    return d;
  }
}
function write(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* private window: ignore */
  }
}

export class Music {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private lp!: BiquadFilterNode;
  /** Campus sounds that are not the party: the bell and the rain. Louder than the muffled party, same volume control. */
  private fx!: GainNode;
  private rainGain: GainNode | null = null;
  private rainLevel = 0;
  private noise!: AudioBuffer;
  private trackGain: GainNode | null = null;
  private timer = 0;
  private cur: { id: number; startCtx: number; offset: number; stepDur: number; next: number; pat: Pattern; end: number } | null = null;
  private volume = Math.min(1, Math.max(0, readNum('campus.vol', 0.7)));
  private muted = readNum('campus.mute', 0) === 1;
  private near = 0;
  private inside = false;
  /** Waiting for the first tap (browsers keep sound off until the person touches the page). */
  locked = true;
  private pending: { id: number; offsetMs: number; at: number } | null = null;
  onLockChange: (locked: boolean) => void = () => {};

  constructor() {
    const unlock = () => {
      this.ensure();
      if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
      this.locked = false;
      this.onLockChange(false);
      this.setRain(this.rainLevel);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      if (this.pending) {
        const p = this.pending;
        this.pending = null;
        const late = p.offsetMs + (Date.now() - p.at);
        if (late < TRACK_MS - 500) this.play(p.id, late);
      }
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.unlockOff = () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }
  private unlockOff: () => void;

  getVolume() {
    return this.volume;
  }
  isMuted() {
    return this.muted;
  }
  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    write('campus.vol', String(this.volume));
    this.applyGain();
  }
  setMuted(m: boolean) {
    this.muted = m;
    write('campus.mute', m ? '1' : '0');
    this.applyGain();
  }

  /** How loud the party is for you: inside it is full, outside it leaks through the walls, far away it is gone. */
  setListener(near: number, inside: boolean) {
    this.near = Math.min(1, Math.max(0, near));
    this.inside = inside;
    this.applyGain();
  }

  private applyGain() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const level = this.muted ? 0 : this.volume * this.volume * (this.inside ? 1 : this.near * 0.45);
    this.master.gain.setTargetAtTime(level, t, 0.15);
    this.fx.gain.setTargetAtTime(this.muted ? 0 : this.volume * this.volume, t, 0.1);
    this.lp.frequency.setTargetAtTime(this.inside ? 16000 : 650, t, 0.2);
  }

  private ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 16000;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.lp.connect(this.master);
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.fx = ctx.createGain();
    this.fx.gain.value = 0;
    this.fx.connect(ctx.destination);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyGain();
  }

  /** The campus bell: two strokes, ding then dong. */
  bell() {
    if (this.locked || !this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.02;
    for (const [i, f] of [[0, 784], [1, 587]] as const) {
      for (const [mul, amp] of [[1, 0.5], [2.01, 0.22], [3.02, 0.1]] as const) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f * mul;
        const t = t0 + i * 0.55;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0005, t + 1.6);
        o.connect(g);
        g.connect(this.fx);
        o.start(t);
        o.stop(t + 1.7);
      }
    }
  }

  /** Rain on the roofs: filtered noise whose loudness follows 0..1. */
  setRain(level: number) {
    this.rainLevel = Math.min(1, Math.max(0, level));
    if (this.locked || !this.ctx) return;
    const ctx = this.ctx;
    if (!this.rainGain) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2200;
      bp.Q.value = 0.5;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 6000;
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0;
      src.connect(bp);
      bp.connect(lp);
      lp.connect(this.rainGain);
      this.rainGain.connect(this.fx);
      src.start();
    }
    this.rainGain.gain.setTargetAtTime(this.rainLevel * 0.22, ctx.currentTime, 0.6);
  }

  /** Start a track as if it began `offsetMs` ago. */
  play(id: number, offsetMs: number) {
    if (this.locked || !this.ctx) {
      this.pending = { id, offsetMs, at: Date.now() };
      return;
    }
    const ctx = this.ctx;
    this.stopTrack(0.25);
    const tr = TRACKS[id] ?? TRACKS[0];
    const pat = PATTERNS[id] ?? PATTERNS[0];
    const stepDur = 60 / tr.bpm / 4;
    const off = Math.max(0, offsetMs / 1000);
    const now = ctx.currentTime + 0.06;
    this.trackGain = ctx.createGain();
    this.trackGain.gain.value = 1;
    this.trackGain.connect(this.lp);
    const firstStep = Math.ceil(off / stepDur);
    this.cur = { id, startCtx: now - off, offset: off, stepDur, next: firstStep, pat, end: TRACK_MS / 1000 };
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.pump(), 70);
    this.pump();
  }

  stop() {
    this.pending = null;
    this.stopTrack(0.4);
    window.clearInterval(this.timer);
    this.cur = null;
  }

  private stopTrack(fade: number) {
    if (!this.ctx || !this.trackGain) return;
    const g = this.trackGain;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + fade);
    window.setTimeout(() => g.disconnect(), fade * 1000 + 100);
    this.trackGain = null;
    this.cur = null;
  }

  private pump() {
    const c = this.cur;
    const ctx = this.ctx;
    if (!c || !ctx || !this.trackGain) return;
    const horizon = ctx.currentTime + 0.3;
    for (;;) {
      const sec = c.next * c.stepDur;
      if (sec >= c.end) {
        // the slot is over: fade out the tail; the next track (or stop) arrives from the server
        const t = c.startCtx + c.end;
        this.trackGain.gain.setValueAtTime(this.trackGain.gain.value, Math.max(ctx.currentTime, t - 0.35));
        this.trackGain.gain.linearRampToValueAtTime(0, Math.max(ctx.currentTime + 0.01, t));
        window.clearInterval(this.timer);
        return;
      }
      const when = c.startCtx + sec;
      if (when > horizon) return;
      if (when >= ctx.currentTime - 0.02) this.step(c.next, Math.max(when, ctx.currentTime), c.pat, c.stepDur);
      c.next++;
    }
  }

  private step(i: number, t: number, p: Pattern, stepDur: number) {
    const s = i % 16;
    const bar = Math.floor(i / 16) % 4;
    const swung = s % 2 ? t + p.swing * stepDur * 2 : t;
    const hit = (str: string) => str[s] === 'x' ? 1 : str[s] === 'o' ? 0.55 : 0;
    const k = hit(p.kick);
    if (k) this.kick(t, k);
    const sn = hit(p.snare);
    if (sn) this.snare(t, sn);
    const h = hit(p.hat);
    if (h) this.hat(swung, h, s % 4 === 2 && (p.hat[s] === 'x') && p.hat.indexOf('o') === -1);
    const pc = hit(p.perc);
    if (pc) this.perc(swung, p.percKind, pc, s);

    const chordRoot = p.chords[bar];
    const b = p.bass[s];
    if (b !== null && b !== undefined) this.bass(t, midiHz(degMidi(p, chordRoot + b) - 12), stepDur * (p.bassWave === 'sine' ? 3.2 : 1.6), p.bassWave);
    if (p.stab[s] === 'x') {
      const dur = p.pad ? stepDur * 15 : stepDur * 1.3;
      for (const sh of p.shape) this.chord(swung, midiHz(degMidi(p, chordRoot + sh)), dur, p.pad ? 'sawtooth' : 'triangle', p.pad ? 0.05 : 0.07);
    }
    const lead = p.lead[i % 32];
    if (lead !== null && lead !== undefined) this.lead(swung, midiHz(degMidi(p, lead) + 12), stepDur * 1.8, p.leadWave);
  }

  // ---- instruments
  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  private out(): AudioNode {
    return this.trackGain!;
  }
  private osc(type: OscillatorType, f0: number, t: number, dur: number): OscillatorNode {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }
  private noiseSrc(t: number, dur: number): AudioBufferSourceNode {
    const n = this.ctx!.createBufferSource();
    n.buffer = this.noise;
    n.start(t, Math.random() * 0.5);
    n.stop(t + dur + 0.05);
    return n;
  }
  private kick(t: number, v: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const o = this.osc('sine', 150, t, 0.3);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    this.env(g, t, 0.95 * v, 0.004, 0.28);
    o.connect(g).connect(this.out());
  }
  private snare(t: number, v: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const n = this.noiseSrc(t, 0.2);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1600;
    this.env(g, t, 0.4 * v, 0.002, 0.17);
    n.connect(hp).connect(g).connect(this.out());
    const g2 = ctx.createGain();
    const o = this.osc('triangle', 200, t, 0.12);
    this.env(g2, t, 0.3 * v, 0.002, 0.09);
    o.connect(g2).connect(this.out());
  }
  private hat(t: number, v: number, open: boolean) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const n = this.noiseSrc(t, 0.2);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    this.env(g, t, 0.16 * v, 0.001, open ? 0.16 : 0.045);
    n.connect(hp).connect(g).connect(this.out());
  }
  private perc(t: number, kind: Pattern['percKind'], v: number, s: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    if (kind === 'conga') {
      const o = this.osc('sine', s % 2 ? 330 : 250, t, 0.2);
      o.frequency.exponentialRampToValueAtTime(s % 2 ? 230 : 170, t + 0.12);
      this.env(g, t, 0.3 * v, 0.002, 0.14);
      o.connect(g).connect(this.out());
    } else if (kind === 'log') {
      const o = this.osc('sine', 130, t, 0.4);
      o.frequency.exponentialRampToValueAtTime(58, t + 0.28);
      this.env(g, t, 0.55 * v, 0.004, 0.34);
      o.connect(g).connect(this.out());
    } else if (kind === 'clap') {
      for (let k = 0; k < 3; k++) {
        const gg = ctx.createGain();
        const n = this.noiseSrc(t + k * 0.012, 0.1);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1500;
        this.env(gg, t + k * 0.012, 0.28 * v, 0.001, k === 2 ? 0.12 : 0.03);
        n.connect(bp).connect(gg).connect(this.out());
      }
    } else {
      const n = this.noiseSrc(t, 0.08);
      const bp = ctx.createBiquadFilter();
      bp.type = 'highpass';
      bp.frequency.value = 5000;
      this.env(g, t, 0.14 * v, 0.004, 0.05);
      n.connect(bp).connect(g).connect(this.out());
    }
  }
  private bass(t: number, f: number, dur: number, type: OscillatorType) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(type === 'sine' ? 400 : 900, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + dur);
    const o = this.osc(type, f, t, dur);
    this.env(g, t, 0.5, 0.01, dur);
    o.connect(lp).connect(g).connect(this.out());
  }
  private chord(t: number, f: number, dur: number, type: OscillatorType, vol: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = type === 'sawtooth' ? 1400 : 2400;
    const o = this.osc(type, f, t, dur);
    this.env(g, t, vol, dur > 0.5 ? 0.08 : 0.005, dur);
    o.connect(lp).connect(g).connect(this.out());
  }
  private lead(t: number, f: number, dur: number, type: OscillatorType) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const o = this.osc(type, f, t, dur);
    const lfo = this.osc('sine', 5.5, t, dur);
    const lg = ctx.createGain();
    lg.gain.value = f * 0.006;
    lfo.connect(lg).connect(o.frequency);
    this.env(g, t, 0.09, 0.006, dur);
    o.connect(lp).connect(g).connect(this.out());
  }

  dispose() {
    window.clearInterval(this.timer);
    this.unlockOff();
    this.stop();
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
  }
}
