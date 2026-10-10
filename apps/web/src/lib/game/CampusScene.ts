import Phaser from 'phaser';
import {
  CAMPUS_MAP, EMOTE_ICONS, EVENT_MARKER_MS, EVENT_NEAR_RANGE, MAX_NAME_LENGTH, SEAT_HINT_RANGE, SIT_MAX_DIST, SPOT_REACH,
  levelAt, nearestSpot, zoneAt,
  type GroupInfo, type Level, type PlayerState, type ServerMsg, type ZoneId
} from '@campus/shared';
import type { Profile } from '$lib/profile';
import { Net, resolveWsUrl } from './net';
import { drawWorld, FONT, LEVEL_BOUNDS, type WorldLayers } from './drawWorld';
import { avatarTexture, plateTexture, AVATAR_W, AVATAR_H, type Pose } from './avatarTexture';
import { g, resetStore, send, setSender, toast } from './store.svelte';

/** One drawn player. The server owns the truth; we only chase its numbers smoothly. */
interface View {
  id: string;
  state: PlayerState;
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  plate: Phaser.GameObjects.Image;
  mark: Phaser.GameObjects.Text;
  bubble: Phaser.GameObjects.Text | null;
  bubbleTimer: Phaser.Time.TimerEvent | null;
  tx: number;
  ty: number;
  phase: number;
}

interface Marker {
  id: number;
  x: number;
  y: number;
  until: number;
  level: Level;
  ring: Phaser.GameObjects.Arc;
}
const CLASS_ZONES: ZoneId[] = ['classroom_a', 'classroom_b', 'student_hall'];
const GROUP_COLORS: Record<GroupInfo['kind'], number> = { chat: 0xffe9a6, eating: 0xffa94d, study: 0x7fb2ff, walking: 0xffffff };

type KeyMap = Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', Phaser.Input.Keyboard.Key>;

export class CampusScene extends Phaser.Scene {
  private net!: Net;
  private views = new Map<string, View>();
  private selfId: string | null = null;
  private keys!: KeyMap;
  private lastDir = { x: 0, y: 0 };
  private lastZone = '';
  private level: Level = 'ground';
  private layers!: WorldLayers;
  private hints!: Phaser.GameObjects.Graphics;
  private ring!: Phaser.GameObjects.Ellipse;
  private selectedId: string | null = null;
  private groups: GroupInfo[] = [];
  private groupGfx!: Phaser.GameObjects.Graphics;
  private markers: Marker[] = [];
  private arrow!: Phaser.GameObjects.Text;
  private profile: Profile;

  constructor(profile: Profile) {
    super('campus');
    this.profile = profile;
  }

  create() {
    this.layers = drawWorld(this);
    this.add.image(0, 0, 'world').setOrigin(0, 0).setDepth(0);
    // Upstairs is a little dimmer and quieter than the ground floor.
    const ub = LEVEL_BOUNDS.upper;
    this.add.rectangle(ub.x, ub.y, ub.w, ub.h, 0x1a1020, 0.14).setOrigin(0, 0).setDepth(99000);

    this.hints = this.add.graphics().setDepth(1);
    this.groupGfx = this.add.graphics().setDepth(0.55);
    this.arrow = this.add.text(0, 0, '➤', { fontSize: '30px', color: '#ffb62e', stroke: '#151a38', strokeThickness: 5 }).setOrigin(0.5).setDepth(100001).setVisible(false);
    this.ring = this.add.ellipse(0, 0, 34, 16).setStrokeStyle(3, 0xffb62e, 1).setVisible(false).setDepth(0.5);

    const cam = this.cameras.main;
    cam.setBackgroundColor('#14171f');
    cam.roundPixels = true;
    this.setLevel('ground', false);
    this.applyZoom();
    this.scale.on('resize', () => this.applyZoom());

    const kb = this.input.keyboard!;
    kb.disableGlobalCapture(); // never swallow keys meant for the chat box
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as KeyMap;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => this.onPointer(p, over));

    this.time.addEvent({ delay: 4000, loop: true, callback: () => send({ t: 'ping', ts: performance.now() }) });
    this.time.addEvent({ delay: 200, loop: true, callback: () => this.refreshUi() });
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.drawSeatHints() });

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
  }

  dispose() {
    this.net?.close();
    setSender(() => {});
  }

  // ---------- camera / levels ----------
  private applyZoom() {
    const z = Phaser.Math.Clamp(Math.min(this.scale.width, this.scale.height) / 520, 0.8, 1.9);
    this.cameras.main.setZoom(z);
  }

  private setLevel(level: Level, recenter = true) {
    this.level = level;
    const b = LEVEL_BOUNDS[level];
    const cam = this.cameras.main;
    cam.setBounds(b.x, b.y, b.w, b.h);
    if (recenter) {
      const me = this.selfId ? this.views.get(this.selfId) : undefined;
      if (me) cam.centerOn(me.tx, me.ty);
    }
  }

  // ---------- input ----------
  private typing(): boolean {
    const el = document.activeElement;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  }

  private onPointer(p: Phaser.Input.Pointer, over: unknown[]) {
    if (over.length > 0) return; // the tap landed on a person; their own handler selects them
    if (!this.selfId) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    this.select(null);
    const me = this.views.get(this.selfId);

    // Tapping a free seat sits you down (walking there first if needed).
    const seat = this.nearestFreeSeat(p.worldX, p.worldY, 22);
    if (seat && me && Math.hypot(seat.x - me.tx, seat.y - me.ty) <= SIT_MAX_DIST) {
      send({ t: 'sit', seat: seat.id });
      this.pulse(seat.x, seat.y, 0x7ee2a8);
      return;
    }
    send({ t: 'move_to', x: Math.round(p.worldX), y: Math.round(p.worldY) });
    this.pulse(p.worldX, p.worldY, 0xffffff);
  }

  private pulse(x: number, y: number, color: number) {
    const ring = this.add.circle(x, y, 6, color, 0.2).setStrokeStyle(2, color, 0.9).setDepth(99999);
    this.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 450, ease: 'Sine.easeOut', onComplete: () => ring.destroy() });
  }

  private occupiedSeats(): Set<string> {
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
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  private drawSeatHints() {
    this.hints.clear();
    const me = this.selfId ? this.views.get(this.selfId) : undefined;
    if (!me || me.state.seat) return;
    const taken = this.occupiedSeats();
    let near = false;
    for (const s of CAMPUS_MAP.seats) {
      if (taken.has(s.id) || levelAt(s.y) !== levelAt(me.ty)) continue;
      const d = Math.hypot(s.x - me.container.x, s.y - me.container.y);
      if (d > SEAT_HINT_RANGE) continue;
      if (d < 70) near = true;
      this.hints.fillStyle(0xffffff, 0.22).fillCircle(s.x, s.y, 9);
      this.hints.lineStyle(2, 0xffffff, 0.55).strokeCircle(s.x, s.y, 9);
    }
    g.nearSeat = near;
  }

  private select(id: string | null) {
    this.selectedId = id;
    if (!id) {
      g.selected = null;
      this.ring.setVisible(false);
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
    const x = off ? 0 : (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const y = off ? 0 : (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (x !== this.lastDir.x || y !== this.lastDir.y) {
      this.lastDir = { x, y };
      send({ t: 'dir', x, y });
    }
  }

  // ---------- network ----------
  private onMessage(m: ServerMsg) {
    switch (m.t) {
      case 'welcome': {
        this.selfId = m.selfId;
        g.selfId = m.selfId;
        g.money = m.self.money;
        g.mischief = m.self.mischief;
        for (const v of this.views.values()) v.container.destroy();
        this.views.clear();
        for (const p of m.players) this.addView(p);
        const me = this.views.get(m.selfId);
        if (me) {
          this.setLevel(levelAt(me.ty), false);
          const cam = this.cameras.main;
          cam.stopFollow();
          cam.centerOn(me.tx, me.ty);
          cam.startFollow(me.container, true, 0.12, 0.12);
        }
        g.online = this.views.size;
        g.status = 'online';
        break;
      }
      case 'player_joined':
        this.views.get(m.player.id)?.container.destroy();
        this.addView(m.player);
        g.online = this.views.size;
        break;
      case 'player_left':
        this.views.get(m.id)?.container.destroy();
        this.views.delete(m.id);
        if (this.selectedId === m.id) this.select(null);
        g.online = this.views.size;
        break;
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
          v.tx = mv.x;
          v.ty = mv.y;
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
        break;
      case 'speech': {
        const v = this.views.get(m.id);
        if (v) this.showBubble(v, m.text, m.q);
        break;
      }
      case 'whisper': {
        const mine = m.from === this.selfId;
        toast(mine ? `To ${m.toName}: ${m.text}` : `${m.fromName} (private): ${m.text}`, 'info');
        break;
      }
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
            this.tweens.add({ targets: victim.sprite, x: { from: -4, to: 4 }, duration: 60, yoyo: true, repeat: 5, onComplete: () => victim.sprite.setX(0) });
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
        const close = !!me && levelAt(me.container.y) === level && Math.hypot(me.container.x - m.x, me.container.y - m.y) <= EVENT_NEAR_RANGE;
        if (!close) toast(m.text, m.tone);
        if (m.kind !== 'buzz') this.addMarker(m.id, m.x, m.y, level);
        break;
      }
      case 'history':
        if (m.id === this.selectedId) g.history = { id: m.id, line: m.line, known: m.known };
        break;
      case 'notice':
        toast(m.text, m.tone);
        break;
      case 'pong':
        g.ping = Math.round(performance.now() - m.ts);
        break;
      case 'error':
        console.warn('[server]', m.message);
        break;
    }
  }

  // ---------- players ----------
  private addView(p: PlayerState) {
    const isSelf = p.id === this.selfId;
    const container = this.add.container(p.x, p.y);
    const shadow = this.add.ellipse(0, -1, 18, 8, 0x000000, 0.28);
    const sprite = this.add.image(0, 0, avatarTexture(this, p.avatar, p.facing)).setOrigin(0.5, 0.95);
    const plate = this.add.image(0, -8, plateTexture(this, false)).setVisible(false);
    const label = this.add
      .text(0, -38, p.name.slice(0, MAX_NAME_LENGTH), {
        fontFamily: FONT, fontSize: '11px', fontStyle: 'bold',
        color: isSelf ? '#ffe9a6' : '#ffffff', stroke: '#151a38', strokeThickness: 3
      })
      .setOrigin(0.5, 1);
    const mark = this.add.text(0, -50, '', { fontSize: '14px' }).setOrigin(0.5, 1);
    container.add([shadow, sprite, plate, label, mark]);
    container.setDepth(p.y);

    if (!isSelf) {
      sprite.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-8, -8, AVATAR_W + 16, AVATAR_H + 14),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
      });
      sprite.on('pointerdown', () => this.select(p.id));
    }
    const v: View = { id: p.id, state: p, container, sprite, plate, mark, bubble: null, bubbleTimer: null, tx: p.x, ty: p.y, phase: Math.random() * Math.PI * 2 };
    this.views.set(p.id, v);
    this.applyState(v);
  }

  /** Re-skin a player from their latest state: pose, facing, plate, marker. */
  private applyState(v: View) {
    const s = v.state;
    const pose: Pose = s.seat ? 'sit' : 'stand';
    v.sprite.setTexture(avatarTexture(this, s.avatar, s.facing, pose));
    v.sprite.y = 0;
    v.plate.setVisible(!!s.held);
    if (s.held) {
      v.plate.setTexture(plateTexture(this, !!s.hotFor));
      const dx = s.facing === 'left' ? -12 : s.facing === 'right' ? 12 : 0;
      v.plate.setPosition(dx, s.seat ? -4 : -8);
    }
    v.mark.setText(
      s.asking ? '🙋' : s.hotFor ? '🏃' : s.watched ? '👀' : s.doing === 'sneak' ? '🤫' : s.doing === 'ride' ? '🏍️' : s.doing === 'work' ? '🛠️' : s.eating ? '😋' : ''
    );
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
    v.bubbleTimer?.remove();
    v.bubble?.destroy();
    const bubble = this.add
      .text(0, -56, text, {
        fontFamily: FONT, fontSize: quick ? '13px' : '12px', fontStyle: 'bold', color: '#151a38',
        backgroundColor: '#fffdf4', padding: { x: 8, y: 5 }, wordWrap: { width: 150 }, align: 'center'
      })
      .setOrigin(0.5, 1)
      .setAlpha(0);
    v.container.add(bubble);
    v.bubble = bubble;
    this.tweens.add({ targets: bubble, alpha: 1, y: -60, duration: 140, ease: 'Sine.easeOut' });
    const life = Phaser.Math.Clamp(1800 + text.length * 55, 2200, 6500);
    v.bubbleTimer = this.time.delayedCall(life, () => {
      this.tweens.add({ targets: bubble, alpha: 0, duration: 400, onComplete: () => { bubble.destroy(); if (v.bubble === bubble) v.bubble = null; } });
    });
  }

  private showEmote(v: View, icon: string, dance: boolean) {
    const t = this.add.text(0, -54, icon, { fontSize: '22px' }).setOrigin(0.5, 1);
    v.container.add(t);
    this.tweens.add({ targets: t, y: -92, alpha: 0, duration: 1300, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
    if (dance) {
      this.tweens.add({ targets: v.sprite, angle: { from: -10, to: 10 }, duration: 160, yoyo: true, repeat: 6, onComplete: () => v.sprite.setAngle(0) });
    }
  }

  // ---------- campus events: "something is happening over there" ----------
  private addMarker(id: number, x: number, y: number, level: Level) {
    const ring = this.add.circle(x, y, 40, 0xffb62e, 0.12).setStrokeStyle(3, 0xffb62e, 0.9).setDepth(99998);
    this.markers.push({ id, x, y, level, until: this.time.now + EVENT_MARKER_MS, ring });
    if (this.markers.length > 4) this.markers.shift()?.ring.destroy();
  }

  private drawGroups(time: number) {
    const gfx = this.groupGfx;
    gfx.clear();
    const pulse = 0.5 + 0.5 * Math.sin(time / 500);
    for (const grp of this.groups) {
      if (grp.level !== this.level) continue;
      const col = GROUP_COLORS[grp.kind];
      const r = grp.r + Math.min(30, grp.n * 3);
      gfx.fillStyle(col, 0.1 + 0.05 * pulse).fillEllipse(grp.x, grp.y + 6, r * 2, r * 1.4);
      gfx.lineStyle(2, col, 0.25 + 0.2 * pulse).strokeEllipse(grp.x, grp.y + 6, r * 2, r * 1.4);
    }
  }

  private updateMarkers(time: number) {
    const cam = this.cameras.main;
    const wv = cam.worldView;
    let target: Marker | null = null;
    for (const mk of [...this.markers]) {
      if (this.time.now > mk.until) {
        mk.ring.destroy();
        this.markers = this.markers.filter((x) => x !== mk);
        continue;
      }
      mk.ring.setVisible(mk.level === this.level);
      mk.ring.setScale(1 + 0.25 * Math.sin(time / 280));
      if (mk.level === this.level && !wv.contains(mk.x, mk.y)) target = mk;
    }
    // An arrow at the edge of the screen pointing toward the latest thing happening off-screen.
    if (!target) return void this.arrow.setVisible(false);
    const cx = wv.centerX;
    const cy = wv.centerY;
    const dx = target.x - cx;
    const dy = target.y - cy;
    const hw = wv.width / 2 - 34 / cam.zoom;
    const hh = wv.height / 2 - 70 / cam.zoom;
    const t = Math.min(hw / Math.max(Math.abs(dx), 1), hh / Math.max(Math.abs(dy), 1));
    this.arrow.setVisible(true).setScale(1 / cam.zoom).setPosition(cx + dx * t, cy + dy * t).setRotation(Math.atan2(dy, dx));
  }

  // ---------- UI sync ----------
  private refreshUi() {
    const me = this.selfId ? this.views.get(this.selfId) : undefined;
    if (!me) return;
    const spot = nearestSpot(CAMPUS_MAP, me.container.x, me.container.y, SPOT_REACH);
    g.spot = spot ? { id: spot.id, kind: spot.kind, label: spot.label, price: spot.price } : null;
    const zoneId = zoneAt(CAMPUS_MAP, me.container.x, me.container.y)?.id;
    g.inClass = !!zoneId && CLASS_ZONES.includes(zoneId);
    if (this.selectedId) {
      const v = this.views.get(this.selectedId);
      if (!v) return this.select(null);
      const sameLevel = levelAt(v.container.y) === levelAt(me.container.y);
      g.selected = { state: { ...v.state }, dist: Math.hypot(v.container.x - me.container.x, v.container.y - me.container.y), sameLevel };
      this.ring.setVisible(true).setPosition(v.container.x, v.container.y - 1);
    }
  }

  update(time: number, delta: number) {
    const k = 1 - Math.exp((-delta / 1000) * 14);
    for (const v of this.views.values()) {
      const dx = v.tx - v.container.x;
      const dy = v.ty - v.container.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 220 * 220) v.container.setPosition(v.tx, v.ty);
      else {
        v.container.x += dx * k;
        v.container.y += dy * k;
      }
      const seated = !!v.state.seat;
      const walking = !seated && (v.state.moving || d2 > 4);
      if (!this.tweens.isTweening(v.sprite)) v.sprite.y = walking ? -Math.abs(Math.sin(time / 110 + v.phase)) * 3 : 0;
      if (v.state.eating) v.plate.y = (seated ? -4 : -8) + Math.sin(time / 140) * 1.5;
      v.container.setDepth(v.container.y);
    }

    this.readKeyboard();
    this.drawGroups(time);
    this.updateMarkers(time);

    const me = this.selfId ? this.views.get(this.selfId) : undefined;
    if (me) {
      const lvl = levelAt(me.container.y);
      if (lvl !== this.level) this.setLevel(lvl);
      const zone = zoneAt(CAMPUS_MAP, me.container.x, me.container.y);
      const name = zone?.name ?? 'Campus grounds';
      if (name !== this.lastZone) {
        this.lastZone = name;
        g.zone = name;
      }
      // Hut roofs fade out when you stand under them.
      for (const r of this.layers.roofs) {
        const target = zone?.id === r.zone ? 0.06 : 0.3;
        r.img.setAlpha(r.img.alpha + (target - r.img.alpha) * 0.15);
      }
    }
    void AVATAR_H;
    void AVATAR_W;
  }
}
