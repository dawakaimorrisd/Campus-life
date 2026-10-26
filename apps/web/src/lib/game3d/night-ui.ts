import { SLOT_COUNT, type ClientMsg, type NightState, type PerformerKind } from '@campus/shared';

type Send = (m: ClientMsg) => void;

const CSS = `
.c3d-night{position:absolute;left:50%;top:max(58px,calc(env(safe-area-inset-top) + 50px));transform:translateX(-50%);display:none;align-items:center;gap:8px;padding:6px 12px;border-radius:16px;background:rgba(18,34,70,.86);color:#fff;font:800 13px/1.15 "Bricolage Grotesque",system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.4);border:0;cursor:pointer;touch-action:manipulation;max-width:92vw;white-space:nowrap}
.c3d-night.shift{top:max(126px,calc(env(safe-area-inset-top) + 118px))}
.c3d-night small{font-weight:700;opacity:.8;font-size:11px}
.c3d-night.hot{background:rgba(120,24,96,.9)}
.c3d-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(320px,90vw);display:none;flex-direction:column;gap:10px;padding:14px 16px 16px;border-radius:18px;background:rgba(22,26,52,.96);color:#fff;font:700 14px/1.3 "Bricolage Grotesque",system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.55);z-index:6}
.c3d-card{pointer-events:auto;touch-action:manipulation;max-height:88vh;overflow:auto;-webkit-tap-highlight-color:transparent;user-select:none}
.c3d-card.on{display:flex}
.c3d-card .x{position:absolute;top:6px;right:8px;flex:none!important;width:34px;height:34px;padding:0!important;border-radius:50%!important;background:rgba(255,255,255,.14)!important;color:#fff!important;font-size:18px!important;line-height:1}
.c3d-card button:hover:not(:disabled){filter:brightness(1.18);transform:translateY(-1px);box-shadow:0 2px 8px rgba(0,0,0,.35)}
.c3d-card button:active:not(:disabled){transform:translateY(1px) scale(.97);filter:brightness(.92)}
.c3d-card button:focus-visible{outline:3px solid #fff;outline-offset:2px}
.c3d-card .x:hover{background:rgba(255,80,80,.7)!important}
.c3d-card h3{margin:0;font-size:17px;font-weight:900;color:#ffd27a}
.c3d-card p{margin:0;opacity:.9}
.c3d-card .row{display:flex;gap:8px}
.c3d-card button{flex:1;border:0;border-radius:12px;padding:11px 8px;font:800 14px/1.1 inherit;font-family:inherit;background:#ffb62e;color:#151a38;cursor:pointer;touch-action:manipulation}
.c3d-card button.alt{background:rgba(255,255,255,.14);color:#fff}
.c3d-card button:disabled{opacity:.4;cursor:default}
.c3d-card .slot{display:flex;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:10px;background:rgba(255,255,255,.08);font-size:13px}
.c3d-card .slot.mine{background:rgba(255,182,46,.28)}
.c3d-card .slot.live{background:rgba(255,111,208,.35)}
.c3d-card .why{font-size:12px;color:#ffb3b3;min-height:15px}
`;

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * The on-screen side of event nights: a small chip while a night is coming or on, a card from the door guard
 * (pay, try to sneak in, not now), and a stage card to book a singer or dancer slot.
 * It only asks; the server decides.
 */
export class NightUi {
  private night: NightState | null = null;
  private skew = 0;
  private money = 0;
  private ticket = false;
  private inside = false;
  private selfId = '';
  private chip: HTMLButtonElement;
  private gateCard: HTMLDivElement;
  private stageCard: HTMLDivElement;
  private gateLine!: HTMLParagraphElement;
  private gateInfo!: HTMLParagraphElement;
  private payBtn!: HTMLButtonElement;
  private sneakBtn!: HTMLButtonElement;
  private gateHideAt = 0;
  private sneakReadyAt = 0;
  private fee = 0;
  private style: HTMLStyleElement;
  private stageBody!: HTMLDivElement;
  private stageWhy!: HTMLDivElement;
  private singerBtn!: HTMLButtonElement;
  private dancerBtn!: HTMLButtonElement;
  private nextPaint = 0;

  constructor(private overlay: HTMLElement, private send: Send) {
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    overlay.appendChild(this.style);

    this.chip = document.createElement('button');
    this.chip.type = 'button';
    this.chip.className = 'c3d-night';
    this.chip.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleStage();
    });
    overlay.appendChild(this.chip);

    this.gateCard = this.buildGate();
    this.stageCard = this.buildStage();
  }

  private card(title: string) {
    const c = document.createElement('div');
    c.className = 'c3d-card';
    for (const ev of ['pointerdown', 'pointerup', 'click', 'touchstart']) c.addEventListener(ev, (e) => e.stopPropagation());
    const h = document.createElement('h3');
    h.textContent = title;
    h.style.paddingRight = '34px';
    c.appendChild(h);
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'x'; x.textContent = '✕'; x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', () => c.classList.remove('on'));
    c.appendChild(x);
    this.overlay.appendChild(c);
    return c;
  }

  private btn(label: string, fn: () => void, alt = false) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (alt) b.className = 'alt';
    b.addEventListener('click', fn);
    return b;
  }

  private buildGate() {
    const c = this.card('🛡️ Student Center door');
    this.gateLine = document.createElement('p');
    this.gateInfo = document.createElement('p');
    const row = document.createElement('div');
    row.className = 'row';
    this.payBtn = this.btn('Pay', () => this.send({ t: 'pay_entry' }));
    this.sneakBtn = this.btn('Sneak in', () => this.send({ t: 'sneak_in' }), true);
    row.append(this.payBtn, this.sneakBtn);
    const close = this.btn('Not now', () => this.hideGate(), true);
    c.append(this.gateLine, this.gateInfo, row, close);
    return c;
  }

  private buildStage() {
    const c = this.card('🎤 Stage tonight');
    this.stageBody = document.createElement('div');
    this.stageBody.style.cssText = 'display:flex;flex-direction:column;gap:6px';
    this.stageWhy = document.createElement('div');
    this.stageWhy.className = 'why';
    const row = document.createElement('div');
    row.className = 'row';
    this.singerBtn = this.btn('Singer', () => this.send({ t: 'book_slot', kind: 'singer' }));
    this.dancerBtn = this.btn('Dancer', () => this.send({ t: 'book_slot', kind: 'dancer' }));
    row.append(this.singerBtn, this.dancerBtn);
    const note = document.createElement('p');
    note.style.cssText = 'font-size:12px;opacity:.75';
    note.textContent = 'The crowd pays you for every cheer, so clap and dance for the people on stage too.';
    const close = this.btn('Close', () => this.stageCard.classList.remove('on'), true);
    c.append(this.stageBody, this.stageWhy, row, note, close);
    return c;
  }

  private serverNow() { return Date.now() + this.skew; }

  apply(n: NightState) {
    this.night = n;
    if (n.now) this.skew = n.now - Date.now();
    if (n.phase === 'off') this.hideGate();
    this.paint(true);
  }

  setSelf(money: number, ticket: boolean | undefined, selfId: string) {
    this.money = money;
    this.selfId = selfId;
    const had = this.ticket;
    this.ticket = !!ticket;
    if (this.ticket && !had) this.hideGate();
    this.paint(true);
  }

  setInside(inside: boolean) {
    if (inside !== this.inside) { this.inside = inside; this.paint(true); }
  }

  /** The guard stops the player at the door. */
  gate(m: { fee: number; money: number; line: string; canSneak: boolean; sneakWaitMs: number; closed?: boolean }) {
    this.money = m.money;
    this.fee = m.fee;
    this.gateLine.textContent = `Guard: “${m.line}”`;
    this.gateInfo.textContent = m.closed ? 'The Student Center is closed for the night. See you tomorrow!' : `Entry tonight is ${m.fee} LD. You have ${Math.floor(m.money)} LD.`;
    this.payBtn.style.display = m.closed ? 'none' : '';
    this.payBtn.textContent = `Pay ${m.fee} LD`;
    this.payBtn.disabled = m.money < m.fee;
    this.sneakBtn.style.display = m.canSneak ? '' : 'none';
    this.sneakReadyAt = Date.now() + m.sneakWaitMs;
    this.gateHideAt = Date.now() + 15_000;
    this.gateCard.classList.add('on');
    this.paintSneak();
  }

  private paintSneak() {
    const wait = this.sneakReadyAt - Date.now();
    this.sneakBtn.disabled = wait > 0;
    this.sneakBtn.textContent = wait > 0 ? `Guard is watching (${Math.ceil(wait / 1000)}s)` : 'Try to sneak in';
  }

  hideGate() {
    this.gateCard.classList.remove('on');
    this.gateHideAt = 0;
  }

  private toggleStage() {
    const on = !this.stageCard.classList.contains('on');
    this.stageCard.classList.toggle('on', on);
    if (on) this.paintStage();
  }

  /** Is the chip showing, so the music chip should make room? */
  get chipShown() { return this.chip.style.display === 'flex'; }
  shiftForMusic(shift: boolean) { this.chip.classList.toggle('shift', shift); }

  private paint(force = false) {
    const n = this.night;
    const now = this.serverNow();
    if (!n || n.phase === 'off') {
      this.chip.style.display = 'none';
      this.stageCard.classList.remove('on');
      return;
    }
    let text = '';
    let sub = '';
    if (n.phase === 'announced') {
      text = `🎉 Event night in ${clock(n.opensAt - now)}`;
      sub = n.fee > 0 ? `Entry ${n.fee} LD` : 'Free entry';
    } else if (n.onStage) {
      text = `${n.onStage.kind === 'singer' ? '🎤' : '💃'} ${n.onStage.name} is on stage`;
      sub = clock(n.onStage.endsAt - now);
    } else {
      text = n.phase === 'closing' ? '🌙 Last dance' : '🎟️ Event night';
      sub = n.closesAt ? `ends in ${clock(n.closesAt - now)}` : this.ticket ? 'tap for the stage' : '';
    }
    this.chip.className = `c3d-night${n.onStage ? ' hot' : ''}${this.chip.classList.contains('shift') ? ' shift' : ''}`;
    this.chip.style.display = 'flex';
    this.chip.replaceChildren(document.createTextNode(text));
    if (sub) {
      const s = document.createElement('small');
      s.textContent = sub;
      this.chip.appendChild(s);
    }
    if (this.stageCard.classList.contains('on') || force) this.paintStage();
  }

  private paintStage() {
    const n = this.night;
    if (!n) return;
    const now = this.serverNow();
    this.stageBody.replaceChildren();
    for (const s of n.slots.slice(0, SLOT_COUNT)) {
      const row = document.createElement('div');
      const live = now >= s.startsAt && now < s.endsAt;
      const done = now >= s.endsAt;
      row.className = `slot${s.by === this.selfId ? ' mine' : ''}${live ? ' live' : ''}`;
      const who = s.by ? `${s.kind === 'singer' ? '🎤' : '💃'} ${s.name}` : done ? 'Ended' : 'Free';
      const when = live ? 'on now' : done ? '' : `in ${clock(s.startsAt - now)}`;
      const a = document.createElement('span');
      a.textContent = `${s.i + 1}. ${who}`;
      const b = document.createElement('span');
      b.textContent = when;
      row.append(a, b);
      this.stageBody.appendChild(row);
    }
    const free = n.slots.some((s) => !s.by && s.startsAt - now > 3000);
    const open = n.phase === 'open' || n.phase === 'closing';
    const mine = n.slots.some((s) => s.by === this.selfId && s.endsAt > now);
    let why = '';
    if (!open) why = 'The stage opens with the doors.';
    else if (n.fee > 0 && !this.ticket) why = 'Get your ticket at the door first.';
    else if (!this.inside) why = 'Go inside the Student Center to book.';
    else if (mine) why = 'You are booked. Stay inside until your turn.';
    else if (!free) why = 'All the slots are taken.';
    this.stageWhy.textContent = why;
    const can = !why;
    const set = (b: HTMLButtonElement, k: PerformerKind, label: string) => {
      const price = n.prices[k];
      b.textContent = `${label} ${price} LD`;
      b.disabled = !can || this.money < price;
    };
    set(this.singerBtn, 'singer', '🎤 Singer');
    set(this.dancerBtn, 'dancer', '💃 Dancer');
  }

  /** Called every frame; does real work a few times a second. */
  update() {
    const t = Date.now();
    if (t < this.nextPaint) return;
    this.nextPaint = t + 400;
    if (this.gateCard.classList.contains('on')) {
      this.paintSneak();
      if (this.gateHideAt && t > this.gateHideAt) this.hideGate();
    }
    this.paint();
  }

  dispose() {
    this.chip.remove();
    this.gateCard.remove();
    this.stageCard.remove();
    this.style.remove();
  }
}
