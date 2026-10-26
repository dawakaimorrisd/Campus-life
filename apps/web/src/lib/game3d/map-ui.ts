import { CAMPUS_MAP, GROUND_H, MAP_W, TILE, zoneGather, type ClientMsg, type ZoneId } from '@campus/shared';

type Send = (m: ClientMsg) => void;

const CSS = `
.c3d-map{pointer-events:auto;position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(10,14,32,.72);z-index:7}
.c3d-map.on{display:flex}
.c3d-map .pane{width:min(94vw,430px);max-height:94vh;overflow:auto;display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:18px;background:rgba(22,26,52,.97);color:#fff;font:700 13px/1.25 "Bricolage Grotesque",system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.55)}
.c3d-map h3{margin:0;font-size:16px;font-weight:900;color:#ffd27a;display:flex;justify-content:space-between;align-items:center}
.c3d-map button:hover{filter:brightness(1.2)}
.c3d-map button:active{transform:scale(.96)}
.c3d-map h3 button{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:10px;padding:6px 12px;font:800 13px inherit;font-family:inherit;cursor:pointer}
.c3d-map canvas{width:100%;border-radius:12px;touch-action:manipulation;display:block}
.c3d-map .chips{display:flex;flex-wrap:wrap;gap:6px}
.c3d-map .chips button{border:0;border-radius:999px;padding:7px 11px;background:rgba(255,255,255,.12);color:#fff;font:800 12px inherit;font-family:inherit;cursor:pointer;touch-action:manipulation}
.c3d-map .chips button.hot{background:#ff6fd0;color:#2a0d28}
.c3d-map .chips button:active{background:#ffb62e;color:#151a38}
.c3d-map small{opacity:.75;font-weight:600}
`;

interface Place { id: ZoneId | 'gate'; label: string; x: number; y: number; level: 'ground' | 'upper' }

const SHORT: Partial<Record<ZoneId | 'gate', string>> = {
  gate: 'Main Gate', admin_hall: 'Admin Hall', student_hall: 'Student Hall', palaver_hut: 'Palaver Hut', back_palaver: 'Back Palaver',
  student_center: 'Student Center', marketplace: 'Marketplace & Jobs', lecture_area: 'Lecture Area', sprint_track: 'Sprint Track', recreation: 'Recreation Ground', social_ground: 'Social Ground',
  library: 'Library', college_cj: 'Criminal Justice', college_nursing: 'Nursing & Midwifery', college_business: 'Business & Public Admin',
  college_agri: 'Agriculture', college_education: 'Education'
};

/**
 * The campus overview map. Tap a place (on the map or in the list) and your student walks there by the normal
 * roads and stairs. Nothing is teleported, so it stays fair and you still see the campus on the way.
 */
export class MapUi {
  private style: HTMLStyleElement;
  private root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private places: Place[] = [];
  private pulse = 0;
  private timer = 0;
  private scale = 5;

  constructor(
    private overlay: HTMLElement,
    private send: Send,
    private getMe: () => { x: number; y: number } | null,
    private hot: () => Set<string>,
    private say: (t: string) => void
  ) {
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    overlay.appendChild(this.style);
    this.root = document.createElement('div');
    this.root.className = 'c3d-map';
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.close(); });
    const pane = document.createElement('div');
    pane.className = 'pane';
    const h = document.createElement('h3');
    h.textContent = '🗺 Campus map';
    const x = document.createElement('button');
    x.type = 'button';
    x.textContent = 'Close';
    x.addEventListener('click', () => this.close());
    h.appendChild(x);
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.canvas.addEventListener('click', (e) => this.tap(e));
    const hint = document.createElement('small');
    hint.textContent = 'Tap a place to walk there. Upstairs places go up the staircase.';
    const chips = document.createElement('div');
    chips.className = 'chips';
    chips.dataset.role = 'chips';
    pane.append(h, this.canvas, hint, chips);
    this.root.appendChild(pane);
    overlay.appendChild(this.root);

    const gz = (id: ZoneId) => CAMPUS_MAP.zones.find((z) => z.id === id)!;
    const sp = CAMPUS_MAP.spawn;
    this.places.push({ id: 'gate', label: SHORT.gate!, x: sp.x + sp.w / 2, y: sp.y + 1, level: 'ground' });
    for (const id of ['admin_hall', 'student_hall', 'palaver_hut', 'back_palaver', 'student_center', 'marketplace', 'recreation', 'sprint_track', 'social_ground', 'lecture_area', 'library', 'college_cj', 'college_nursing', 'college_business', 'college_agri', 'college_education'] as ZoneId[]) {
      const z = gz(id);
      this.places.push({ id, label: SHORT[id] ?? z.name, x: z.gather.x + 0.5, y: z.gather.y + 0.5, level: z.level });
    }
    for (const p of this.places) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = p.label;
      b.dataset.id = p.id;
      b.addEventListener('click', () => this.go(p));
      chips.appendChild(b);
    }
  }

  get isOpen() { return this.root.classList.contains('on'); }

  open() {
    const w = Math.min(window.innerWidth * 0.94 - 24, 406);
    this.canvas.width = Math.floor(w * 2);
    this.scale = (w * 2) / MAP_W;
    this.canvas.height = Math.floor(GROUND_H * this.scale);
    this.root.classList.add('on');
    this.draw();
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.draw(), 400);
  }

  close() {
    this.root.classList.remove('on');
    window.clearInterval(this.timer);
  }

  toggle() { if (this.isOpen) this.close(); else this.open(); }

  private go(p: Place) {
    const g = p.id === 'gate' ? { x: p.x * TILE, y: p.y * TILE } : zoneGather(CAMPUS_MAP, p.id, 40);
    this.send({ t: 'move_to', x: g.x, y: g.y });
    this.say(`Walking to ${p.label}`);
    this.close();
  }

  private tap(e: MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    const tx = ((e.clientX - r.left) / r.width) * MAP_W;
    const ty = ((e.clientY - r.top) / r.height) * GROUND_H;
    let best: Place | null = null;
    let bd = 6;
    for (const p of this.places) {
      if (p.level !== 'ground') continue;
      const d = Math.hypot(p.x - tx, p.y - ty);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) this.go(best);
  }

  private draw() {
    const c = this.ctx;
    const s = this.scale;
    const W = this.canvas.width;
    const H = this.canvas.height;
    this.pulse = (this.pulse + 1) % 2;
    c.fillStyle = '#7fb069';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#d2b48c';
    for (const p of CAMPUS_MAP.paths) c.fillRect(p.x * s, p.y * s, p.w * s, p.h * s);
    // recreation pitch
    const pr = CAMPUS_MAP.rec.pitch;
    c.fillStyle = '#5aa04a';
    c.fillRect(pr.x * s, pr.y * s, pr.w * s, pr.h * s);
    c.strokeStyle = 'rgba(255,255,255,.8)';
    c.lineWidth = 1.5;
    c.strokeRect(pr.x * s, pr.y * s, pr.w * s, pr.h * s);
    c.beginPath();
    c.moveTo((pr.x + pr.w / 2) * s, pr.y * s);
    c.lineTo((pr.x + pr.w / 2) * s, (pr.y + pr.h) * s);
    c.stroke();
    // buildings
    for (const b of CAMPUS_MAP.buildings) {
      if (b.level !== 'ground') continue;
      c.fillStyle = b.style === 'center' ? '#a5372b' : b.style === 'admin' ? '#56808a' : '#667b93';
      c.fillRect(b.rect.x * s, b.rect.y * s, b.rect.w * s, b.rect.h * s);
    }
    // huts
    for (const h of CAMPUS_MAP.huts) {
      c.fillStyle = '#c9c4b5';
      c.beginPath();
      c.arc(h.cx * s, h.cy * s, h.r * s, 0, Math.PI * 2);
      c.fill();
    }
    // market stall, palms
    c.fillStyle = '#c0392b';
    for (const f of CAMPUS_MAP.furniture) if (f.kind === 'stall' && f.rect.x < 20 && f.rect.y > 30) c.fillRect(f.rect.x * s, f.rect.y * s, f.rect.w * s, f.rect.h * s);
    c.fillStyle = '#1f8a8a';
    for (const f of CAMPUS_MAP.furniture) if (f.kind === 'jobskiosk') c.fillRect(f.rect.x * s, f.rect.y * s, f.rect.w * s, f.rect.h * s);
    c.fillStyle = '#2f6b34';
    for (const t of CAMPUS_MAP.trees) {
      c.beginPath();
      c.arc((t.x + 0.5) * s, (t.y + 0.5) * s, s * (t.kind === 'palm' ? 0.9 : 1.6), 0, Math.PI * 2);
      c.fill();
    }
    // places
    const hot = this.hot();
    c.font = `800 ${Math.round(s * 1.7)}px system-ui, sans-serif`;
    c.textAlign = 'center';
    for (const p of this.places) {
      if (p.level !== 'ground') continue;
      const isHot = hot.has(p.id);
      c.fillStyle = isHot ? (this.pulse ? '#ff6fd0' : '#ffe08a') : '#ffffff';
      c.strokeStyle = 'rgba(0,0,0,.65)';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(p.x * s, p.y * s, s * (isHot ? 1.5 : 1), 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.lineWidth = 4;
      c.strokeText(p.label, p.x * s, p.y * s - s * 1.5);
      c.fillStyle = '#fff';
      c.fillText(p.label, p.x * s, p.y * s - s * 1.5);
    }
    // you
    const me = this.getMe();
    if (me) {
      const mx = (me.x / TILE) * s;
      const my = (me.y / TILE) * s;
      if (my < H) {
        c.fillStyle = '#ffb62e';
        c.strokeStyle = '#151a38';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(mx, my, s * 1.2, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      } else {
        c.fillStyle = '#ffb62e';
        c.fillText('You are upstairs', W / 2, H - s);
      }
    }
    const chips = this.root.querySelector('[data-role=chips]');
    chips?.querySelectorAll('button').forEach((b) => b.classList.toggle('hot', hot.has((b as HTMLButtonElement).dataset.id ?? '')));
  }

  dispose() {
    window.clearInterval(this.timer);
    this.root.remove();
    this.style.remove();
  }
}
