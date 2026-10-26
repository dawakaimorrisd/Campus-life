import * as THREE from 'three';
import { mulberry32 } from './geo';

/**
 * Procedural textures, drawn once at start-up.
 *
 * This is the "no downloads" starting point: the campus looks grounded without
 * any image files. To use real photographs later, replace the body of a single
 * function below with `new THREE.TextureLoader().load('/textures/....jpg')`
 * and keep the same wrap / colour-space settings (see `finish`).
 */

let maxAniso = 4;
export function setMaxAnisotropy(n: number) {
  maxAniso = Math.max(1, Math.min(n, 8));
}

type Ctx = CanvasRenderingContext2D;

function make(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function finish(c: HTMLCanvasElement, repeat = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = maxAniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Draw a shape at (x, y) and again at the wrapped positions so the texture tiles without seams. */
function wrapped(w: number, h: number, x: number, y: number, r: number, draw: (x: number, y: number) => void) {
  for (const ox of [-w, 0, w]) {
    for (const oy of [-h, 0, h]) {
      const px = x + ox;
      const py = y + oy;
      if (px + r < 0 || px - r > w || py + r < 0 || py - r > h) continue;
      draw(px, py);
    }
  }
}

function blotches(ctx: Ctx, w: number, h: number, rnd: () => number, colors: string[], count: number, rMin: number, rMax: number, alpha: number) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = rMin + rnd() * (rMax - rMin);
    const col = colors[Math.floor(rnd() * colors.length)];
    wrapped(w, h, x, y, r, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = alpha * (0.5 + rnd() * 0.5);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.globalAlpha = 1;
}

function speckle(ctx: Ctx, w: number, h: number, rnd: () => number, colors: string[], count: number, size: number, alpha: number) {
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = alpha * (0.4 + rnd() * 0.6);
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    const s = 0.5 + rnd() * size;
    ctx.fillRect(rnd() * w, rnd() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- ground

export function grassTexture(size = 512): THREE.CanvasTexture {
  const [c, ctx] = make(size, size);
  const rnd = mulberry32(11);
  ctx.fillStyle = '#4b7d3d';
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, size, size, rnd, ['#5c9145', '#3d6c33', '#7b8b44', '#6b9a4a'], 46, size * 0.06, size * 0.2, 0.55);
  // blades
  for (let i = 0; i < size * 5; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const l = 3 + rnd() * 7;
    ctx.strokeStyle = ['#3a6a30', '#5f9648', '#86a84f', '#2f5c29'][Math.floor(rnd() * 4)];
    ctx.globalAlpha = 0.25 + rnd() * 0.3;
    ctx.lineWidth = 1;
    wrapped(size, size, x, y, l, (px, py) => {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + (rnd() - 0.5) * 3, py - l);
      ctx.stroke();
    });
  }
  ctx.globalAlpha = 1;
  return finish(c);
}

export function lateriteTexture(size = 512): THREE.CanvasTexture {
  const [c, ctx] = make(size, size);
  const rnd = mulberry32(23);
  ctx.fillStyle = '#a05836';
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, size, size, rnd, ['#b86e47', '#8a4a2c', '#c07a50', '#7d4128'], 60, size * 0.05, size * 0.18, 0.5);
  speckle(ctx, size, size, rnd, ['#d9a37e', '#c98d6a', '#6f3a23', '#e2b490', '#4d2a1b'], size * 9, 3.2, 0.7);
  // a few pebbles
  for (let i = 0; i < 90; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 1.5 + rnd() * 3;
    wrapped(size, size, x, y, r, (px, py) => {
      ctx.fillStyle = rnd() > 0.5 ? '#cfa27c' : '#8a5a3e';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.ellipse(px, py, r, r * 0.7, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(px + 1, py + 1.5, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.globalAlpha = 1;
  return finish(c);
}

export function concreteTexture(size = 256): THREE.CanvasTexture {
  const [c, ctx] = make(size, size);
  const rnd = mulberry32(37);
  ctx.fillStyle = '#b4b1a8';
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, size, size, rnd, ['#c4c1b8', '#9d9a91', '#a8a59b'], 30, size * 0.06, size * 0.22, 0.5);
  speckle(ctx, size, size, rnd, ['#6e6c66', '#d8d5cb', '#8c8a83'], size * 6, 2.2, 0.6);
  return finish(c);
}

// ---------------------------------------------------------------- buildings

/** Terracotta floor tile: 4 x 4 tiles per texture, geometric motif, worn grout. One texture covers 2 m. */
export function terracottaTexture(size = 512): THREE.CanvasTexture {
  const [c, ctx] = make(size, size);
  const rnd = mulberry32(51);
  const n = 4;
  const t = size / n;
  const base = ['#b3603d', '#a85838', '#bc6a45', '#ad5c3b', '#b8653f'];
  for (let ty = 0; ty < n; ty++) {
    for (let tx = 0; tx < n; tx++) {
      ctx.fillStyle = base[Math.floor(rnd() * base.length)];
      ctx.fillRect(tx * t, ty * t, t, t);
      // geometric / floral motif: a soft diamond with four dots
      const cx = tx * t + t / 2;
      const cy = ty * t + t / 2;
      ctx.fillStyle = 'rgba(70,28,14,0.20)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - t * 0.32);
      ctx.lineTo(cx + t * 0.32, cy);
      ctx.lineTo(cx, cy + t * 0.32);
      ctx.lineTo(cx - t * 0.32, cy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,214,180,0.16)';
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
        ctx.beginPath();
        ctx.arc(cx + dx * t * 0.4, cy + dy * t * 0.4, t * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  blotches(ctx, size, size, rnd, ['#d9a98a', '#6f3320', '#c98b68'], 40, size * 0.05, size * 0.16, 0.35);
  speckle(ctx, size, size, rnd, ['#e8c4a8', '#5b2a1a'], size * 4, 2, 0.5);
  // grout
  ctx.fillStyle = 'rgba(92,70,58,0.9)';
  for (let i = 0; i <= n; i++) {
    ctx.fillRect(i * t - 1.5, 0, 3, size);
    ctx.fillRect(0, i * t - 1.5, size, 3);
  }
  return finish(c);
}

export function plasterTexture(size = 256, tone = '#e6e0d0'): THREE.CanvasTexture {
  const [c, ctx] = make(size, size);
  const rnd = mulberry32(61);
  ctx.fillStyle = tone;
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, size, size, rnd, ['#d8d1bf', '#f0ecde', '#c9c1ac'], 36, size * 0.06, size * 0.24, 0.55);
  speckle(ctx, size, size, rnd, ['#a9a290', '#fffdf2', '#bdb59f'], size * 7, 2.4, 0.5);
  // rough, uneven plaster: faint horizontal trowel marks
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = '#7a735f';
  for (let i = 0; i < 26; i++) {
    const y = rnd() * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (rnd() - 0.5) * 8);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return finish(c);
}

/**
 * The outside of the real buildings: cream-yellow walls with a blue painted band along the base.
 * One texture = 4 m wide x 3.2 m high. v = 0 is the ground.
 */
export function exteriorWallTexture(upper = false): THREE.CanvasTexture {
  const W = 256;
  const H = 256;
  const [c, ctx] = make(W, H);
  const rnd = mulberry32(upper ? 72 : 71);
  ctx.fillStyle = '#e4d49b';
  ctx.fillRect(0, 0, W, H);
  blotches(ctx, W, H, rnd, ['#efe2ae', '#d3c184', '#c9b67a'], 40, 14, 60, 0.45);
  speckle(ctx, W, H, rnd, ['#bfae72', '#f4ebc4', '#a89862'], 1400, 2.4, 0.5);
  // rain streaks running down from the top
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 22; i++) {
    const x = rnd() * W;
    const y = rnd() * H * 0.5;
    const l = 30 + rnd() * 110;
    ctx.fillStyle = '#7d6c3d';
    wrapped(W, H, x, y, l, (px, py) => ctx.fillRect(px, py, 1 + rnd() * 3, l));
  }
  ctx.globalAlpha = 1;
  if (!upper) {
    // blue band: bottom 0.9 m of 3.2 m
    const bandH = Math.round(H * (0.9 / 3.2));
    const y0 = H - bandH;
    ctx.fillStyle = '#2461b3';
    ctx.fillRect(0, y0, W, bandH);
    blotches(ctx, W, H, rnd, ['#3677cc', '#1b4f98'], 18, 10, 40, 0.5);
    // clean white line where the band meets the cream
    ctx.fillStyle = '#f3efe0';
    ctx.fillRect(0, y0 - 3, W, 3);
    // dirt splashed up from the ground
    const g = ctx.createLinearGradient(0, H, 0, H - bandH * 0.9);
    g.addColorStop(0, 'rgba(110,60,32,0.55)');
    g.addColorStop(1, 'rgba(110,60,32,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, H - bandH, W, bandH);
  }
  return finish(c);
}

export function windowTexture(): THREE.CanvasTexture {
  const W = 128;
  const H = 128;
  const [c, ctx] = make(W, H);
  const rnd = mulberry32(81);
  // dark, slightly reflective glass
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#3d556b');
  g.addColorStop(0.5, '#1c2a38');
  g.addColorStop(1, '#2b3f52');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.moveTo(0, H * 0.55);
  ctx.lineTo(W * 0.45, 0);
  ctx.lineTo(W * 0.7, 0);
  ctx.lineTo(0, H * 0.85);
  ctx.fill();
  speckle(ctx, W, H, rnd, ['#8aa0b3'], 80, 1.5, 0.3);
  // security bars: a dark grid, like the real windows
  ctx.fillStyle = '#16181c';
  const cols = 5;
  const rows = 5;
  for (let i = 0; i <= cols; i++) ctx.fillRect((i * (W - 6)) / cols, 0, 6, H);
  for (let j = 0; j <= rows; j++) ctx.fillRect(0, (j * (H - 6)) / rows, W, 6);
  // frame
  ctx.strokeStyle = '#0f1114';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  return finish(c, false);
}

export function metalRoofTexture(): THREE.CanvasTexture {
  const [c, ctx] = make(128, 128);
  const rnd = mulberry32(91);
  for (let x = 0; x < 128; x += 16) {
    const g = ctx.createLinearGradient(x, 0, x + 16, 0);
    g.addColorStop(0, '#9aa3ab');
    g.addColorStop(0.5, '#dfe5ea');
    g.addColorStop(1, '#8e979f');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 16, 128);
  }
  blotches(ctx, 128, 128, rnd, ['#6b4a35', '#4d5a62'], 10, 6, 22, 0.25);
  speckle(ctx, 128, 128, rnd, ['#5c4636', '#ffffff'], 300, 2, 0.35);
  return finish(c);
}

export function shingleTexture(): THREE.CanvasTexture {
  const [c, ctx] = make(256, 256);
  const rnd = mulberry32(95);
  const rows = 12;
  const rh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * 16;
    for (let x = -16; x < 256; x += 32) {
      const l = 36 + Math.floor(rnd() * 14);
      ctx.fillStyle = `rgb(${l + 22},${l + 8},${l - 6})`;
      ctx.fillRect(x + off, r * rh, 31, rh - 1);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + off, r * rh + rh - 3, 31, 3);
    }
  }
  speckle(ctx, 256, 256, rnd, ['#2a1c12', '#6b4a32'], 700, 2, 0.4);
  return finish(c);
}

export function woodTexture(): THREE.CanvasTexture {
  const [c, ctx] = make(128, 128);
  const rnd = mulberry32(101);
  ctx.fillStyle = '#4a2f1e';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = ['#3a2316', '#5c3a25', '#2e1b10'][Math.floor(rnd() * 3)];
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1 + rnd() * 1.5;
    const y = rnd() * 128;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(40, y + (rnd() - 0.5) * 8, 90, y + (rnd() - 0.5) * 8, 128, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return finish(c);
}

/** A small grayscale grain that gives flat-coloured props (which use vertex colours) some surface. */
export function grainTexture(): THREE.CanvasTexture {
  const [c, ctx] = make(128, 128);
  const rnd = mulberry32(111);
  ctx.fillStyle = '#d6d6d6';
  ctx.fillRect(0, 0, 128, 128);
  blotches(ctx, 128, 128, rnd, ['#ffffff', '#b8b8b8'], 24, 6, 28, 0.4);
  speckle(ctx, 128, 128, rnd, ['#ffffff', '#9a9a9a'], 900, 2, 0.55);
  return finish(c);
}

export function hedgeTexture(): THREE.CanvasTexture {
  const [c, ctx] = make(128, 128);
  const rnd = mulberry32(121);
  ctx.fillStyle = '#2f5e2b';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = ['#244a21', '#3e7a37', '#4e8b42', '#1d3d1b', '#6a9a4b'][Math.floor(rnd() * 5)];
    ctx.globalAlpha = 0.7;
    const x = rnd() * 128;
    const y = rnd() * 128;
    wrapped(128, 128, x, y, 5, (px, py) => {
      ctx.beginPath();
      ctx.ellipse(px, py, 3 + rnd() * 3, 2 + rnd() * 2, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.globalAlpha = 1;
  return finish(c);
}

export function whiteboardTexture(): THREE.CanvasTexture {
  const [c, ctx] = make(256, 128);
  const rnd = mulberry32(131);
  ctx.fillStyle = '#f2f3f0';
  ctx.fillRect(0, 0, 256, 128);
  // old ghosted marker writing
  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = '#334';
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const y = 14 + i * 12;
    ctx.beginPath();
    ctx.moveTo(10 + rnd() * 20, y);
    for (let x = 20; x < 200 * (0.5 + rnd() * 0.5); x += 8) ctx.lineTo(x, y + (rnd() - 0.5) * 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  blotches(ctx, 256, 128, rnd, ['#d8dad4'], 8, 10, 40, 0.5);
  // frame and marker tray
  ctx.strokeStyle = '#5b5e63';
  ctx.lineWidth = 8;
  ctx.strokeRect(0, 0, 256, 128);
  ctx.fillStyle = '#8c8f94';
  ctx.fillRect(0, 120, 256, 8);
  return finish(c, false);
}

export function booksTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 256;
  const [c, ctx] = make(W, H);
  const rnd = mulberry32(141);
  ctx.fillStyle = '#2b1c12';
  ctx.fillRect(0, 0, W, H);
  const shelves = 5;
  const sh = H / shelves;
  const spines = ['#7a1f1f', '#1f3c7a', '#2e6b3a', '#c9a227', '#d8d2c0', '#5b2a6a', '#8a4b1a', '#1f6b6b', '#aa3b2e', '#33343b'];
  for (let s = 0; s < shelves; s++) {
    let x = 4;
    while (x < W - 6) {
      const w = 5 + rnd() * 9;
      const h = sh * (0.6 + rnd() * 0.32);
      ctx.fillStyle = spines[Math.floor(rnd() * spines.length)];
      const lean = rnd() < 0.06 ? 3 : 0;
      ctx.fillRect(x + lean, s * sh + sh - 5 - h, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + lean + w - 1.5, s * sh + sh - 5 - h, 1.5, h);
      x += w + 0.5;
      if (rnd() < 0.05) x += 14; // a gap
    }
    ctx.fillStyle = '#4a2f1e';
    ctx.fillRect(0, s * sh + sh - 5, W, 5);
  }
  return finish(c, false);
}

/** A hand-painted looking sign board. Returns a texture with the given words fitted to the board. */
export function signTexture(text: string, bg: string, fg: string, w = 512, h = 128, border?: string): THREE.CanvasTexture {
  const [c, ctx] = make(w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = Math.max(4, h * 0.06);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  }
  const lines = text.split('\n');
  let fs = h / (lines.length + 0.6);
  ctx.font = `800 ${fs}px "Bricolage Grotesque", system-ui, sans-serif`;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
  if (widest > w * 0.9) fs *= (w * 0.9) / widest;
  ctx.font = `800 ${fs}px "Bricolage Grotesque", system-ui, sans-serif`;
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.1));
  // weathering
  const rnd = mulberry32(text.length * 17 + 3);
  speckle(ctx, w, h, rnd, ['#000000', '#ffffff'], 300, 2, 0.12);
  return finish(c, false);
}

// ---------------------------------------------------------------- sky, shadows, small things

export function skyTexture(): THREE.CanvasTexture {
  const W = 512;
  const H = 256;
  const [c, ctx] = make(W, H);
  const rnd = mulberry32(151);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3f86d6');
  g.addColorStop(0.55, '#8fc2ec');
  g.addColorStop(0.88, '#d7e9f3');
  g.addColorStop(1, '#e8efe6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // soft tropical clouds
  for (let i = 0; i < 26; i++) {
    const cx = rnd() * W;
    const cy = H * (0.28 + rnd() * 0.4);
    const rw = 30 + rnd() * 70;
    for (let k = 0; k < 7; k++) {
      const x = cx + (rnd() - 0.5) * rw;
      const y = cy + (rnd() - 0.5) * rw * 0.16;
      const r = rw * (0.25 + rnd() * 0.3);
      wrapped(W, H, x, y, r, (px, py) => {
        const rg = ctx.createRadialGradient(px, py, 0, px, py, r);
        rg.addColorStop(0, 'rgba(255,255,255,0.75)');
        rg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.ellipse(px, py, r, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
  const t = finish(c, false);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function blobShadowTexture(): THREE.CanvasTexture {
  const [c, ctx] = make(64, 64);
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return finish(c, false);
}

export function ringTexture(): THREE.CanvasTexture {
  const [c, ctx] = make(128, 128);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(64, 64, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(64, 64, 52, 0, Math.PI * 2);
  ctx.fill();
  return finish(c, false);
}

export function glowTexture(): THREE.CanvasTexture {
  const [c, ctx] = make(128, 128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.93, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return finish(c, false);
}

export function tuftTexture(): THREE.CanvasTexture {
  const [c, ctx] = make(64, 64);
  const rnd = mulberry32(161);
  for (let i = 0; i < 16; i++) {
    const x = 10 + rnd() * 44;
    const h = 22 + rnd() * 34;
    ctx.strokeStyle = ['#3f7a35', '#5a9446', '#79a84d', '#2d5f28'][Math.floor(rnd() * 4)];
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.quadraticCurveTo(x + (rnd() - 0.5) * 12, 64 - h * 0.6, x + (rnd() - 0.5) * 18, 64 - h);
    ctx.stroke();
  }
  const t = finish(c, false);
  return t;
}

export function paperTexture(tint: string): THREE.CanvasTexture {
  const [c, ctx] = make(64, 64);
  const rnd = mulberry32(tint.length * 31);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 7; i++) ctx.fillRect(6, 8 + i * 7, 20 + rnd() * 34, 2);
  return finish(c, false);
}
