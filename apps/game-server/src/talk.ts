import {
  CAMPUS_MAP, SPOT_REACH, TALK_ANSWER_WINDOW_MS, TALK_CLAP_PAY, TALK_COOLDOWN_MS, TALK_LISTENER_PAY, TALK_LISTEN_FRAC, TALK_MAX_CLAPS, TALK_MAX_MS,
  TALK_MIN_MS, TALK_QUESTION_ANSWER_PAY, TALK_QUESTION_ASKER_PAY, TALK_QUESTION_MAX, TALK_SPEAKER_MAX_LISTENERS, TALK_SPEAKER_PAY_EACH, TALK_TOPICS,
  distToRect, levelAt, levelOfRow, zoneAt, type EmoteKind, type TalkState
} from '@campus/shared';
import type { ServerPlayer, World } from './world';

interface Talk {
  id: string;
  topic: number;
  startedAt: number;
  endsAt: number;
  listenMs: Map<string, number>;
  claps: Set<string>;
  questions: Array<{ by: string; at: number; answered: boolean }>;
  lastTick: number;
}

/**
 * The Lecture and Presentation Area. One speaker at the lectern at a time. Listening is free and always optional.
 * The speaker's voice carries across the area; listeners can clap and ask a question; a speaker who answers a
 * question in chat earns a little more. Rewards are small and need real listeners, so a talk to an empty area pays nothing.
 */
export class TalkEngine {
  private cur: Talk | null = null;
  private cooldown = new Map<string, number>();
  private lastJson = '';

  constructor(private world: World) {}

  private get lectern() { return CAMPUS_MAP.spots.find((s) => s.kind === 'lectern')!; }
  private inArea(p: ServerPlayer) { return zoneAt(CAMPUS_MAP, p.x, p.y)?.id === 'lecture_area' && levelAt(p.y) === 'ground'; }

  state(): TalkState {
    const t = this.cur;
    const sp = t ? this.world.players.get(t.id) : undefined;
    if (!t || !sp) return { speaker: null, now: this.world.now() };
    return {
      speaker: { id: t.id, name: sp.name, topic: TALK_TOPICS[t.topic], endsAt: t.endsAt, listeners: this.listeners(t).length, questions: t.questions.filter((q) => !q.answered).length },
      now: this.world.now()
    };
  }

  private listeners(t: Talk): ServerPlayer[] {
    const out: ServerPlayer[] = [];
    for (const p of this.world.players.values()) if (p.id !== t.id && this.inArea(p)) out.push(p);
    return out;
  }

  private publish(force = false) {
    const s = this.state();
    const json = JSON.stringify({ ...s, now: 0 });
    if (!force && json === this.lastJson) return;
    this.lastJson = json;
    this.world.broadcast({ t: 'talk', ...s });
  }

  open(p: ServerPlayer) {
    this.world.send(p, { t: 'open', what: 'lectern' });
    this.world.send(p, { t: 'talk', ...this.state() });
  }

  start(p: ServerPlayer, topic: number) {
    const now = this.world.now();
    const spot = this.lectern;
    if (levelAt(p.y) !== levelOfRow(spot.rect.y) || distToRect(CAMPUS_MAP, spot.rect, p.x, p.y) > SPOT_REACH) return this.world.notice(p, 'Walk up to the lectern first.', 'info');
    if (this.cur) return this.world.notice(p, 'Someone is speaking. Take a seat and listen, then you can go next.', 'info');
    const ph = this.world.clock.phase;
    if (ph === 'class') return this.world.notice(p, 'Class is in session. The lectern opens at break time.', 'info');
    if (ph === 'party' || ph === 'bedtime') return this.world.notice(p, 'The lectern is closed for the night.', 'info');
    if (p.doing && p.doing !== 'dance') return this.world.notice(p, 'Finish what you are doing first.', 'info');
    const wait = (this.cooldown.get(p.id) ?? 0) - now;
    if (wait > 0) return this.world.notice(p, `Let someone else speak. You can give another talk in ${Math.ceil(wait / 1000)}s.`, 'info');
    this.world.stand(p);
    p.path = []; p.dirX = 0; p.dirY = 0;
    p.doing = 'present';
    p.doingUntil = Number.MAX_SAFE_INTEGER;
    this.world.pushState(p);
    this.cur = { id: p.id, topic, startedAt: now, endsAt: now + TALK_MAX_MS, listenMs: new Map(), claps: new Set(), questions: [], lastTick: now };
    this.cooldown.set(p.id, now + TALK_COOLDOWN_MS);
    this.world.notice(p, `🎙️ You are speaking: "${TALK_TOPICS[topic]}". Type in chat and everyone here hears you. Tap Finish when you are done.`, 'fun');
    const door = this.lectern.rect;
    this.world.events.emit('buzz', `${p.name} is giving a talk at the Lecture Area 🎙️`, { x: (door.x + 1) * CAMPUS_MAP.tile, y: (door.y + 0.5) * CAMPUS_MAP.tile }, { key: 'talk', cooldownMs: 60_000, tone: 'fun', priority: false });
    this.publish(true);
  }

  end(p: ServerPlayer) {
    if (this.cur?.id === p.id) this.finish(this.world.now(), 'You finished your talk.');
  }

  /** A listener asks the speaker a question. The speaker answers by typing in chat. */
  ask(p: ServerPlayer) {
    const t = this.cur;
    if (!t || p.id === t.id) return this.world.notice(p, 'There is no talk to ask about right now.', 'info');
    if (!this.inArea(p)) return this.world.notice(p, 'Come into the Lecture Area to ask a question.', 'info');
    if (t.questions.some((q) => q.by === p.id)) return this.world.notice(p, 'You already asked. Let others ask too.', 'info');
    if (t.questions.length >= TALK_QUESTION_MAX) return this.world.notice(p, 'That is enough questions for this talk.', 'info');
    t.questions.push({ by: p.id, at: this.world.now(), answered: false });
    const sp = this.world.players.get(t.id);
    if (sp) this.world.notice(sp, `✋ ${p.name} has a question. Answer it in chat.`, 'fun');
    this.world.notice(p, 'Your question was passed to the speaker.', 'good');
    this.publish();
  }

  noteEmote(p: ServerPlayer, kind: EmoteKind) {
    const t = this.cur;
    if (!t || p.id === t.id || (kind !== 'clap' && kind !== 'laugh') || !this.inArea(p) || t.claps.has(p.id) || t.claps.size >= TALK_MAX_CLAPS) return;
    t.claps.add(p.id);
  }

  /** The speaker typed something: it answers the oldest open question. */
  noteSay(p: ServerPlayer) {
    const t = this.cur;
    if (!t || t.id !== p.id) return;
    const now = this.world.now();
    const q = t.questions.find((x) => !x.answered && now - x.at <= TALK_ANSWER_WINDOW_MS);
    if (!q) return;
    q.answered = true;
    const asker = this.world.players.get(q.by);
    this.world.credit(p, TALK_QUESTION_ANSWER_PAY * this.world.clock.mult('stories'));
    if (asker) {
      this.world.credit(asker, TALK_QUESTION_ASKER_PAY * this.world.clock.mult('stories'));
      this.world.notice(asker, `${p.name} answered your question. +${TALK_QUESTION_ASKER_PAY} LD`, 'good');
    }
    this.publish();
  }

  tick(now: number) {
    const t = this.cur;
    if (!t) return;
    const sp = this.world.players.get(t.id);
    if (!sp || sp.doing !== 'present' || sp.moving) return this.finish(now, sp ? 'You left the lectern.' : '');
    const dt = now - t.lastTick;
    t.lastTick = now;
    for (const l of this.listeners(t)) t.listenMs.set(l.id, (t.listenMs.get(l.id) ?? 0) + dt);
    if (now >= t.endsAt) return this.finish(now, 'Time is up. Thank you for speaking!');
    this.publish();
  }

  private finish(now: number, msg: string) {
    const t = this.cur;
    if (!t) return;
    this.cur = null;
    const sp = this.world.players.get(t.id);
    if (sp && sp.doing === 'present') this.world.cancelDoing(sp);
    const dur = now - t.startedAt;
    if (sp) {
      if (msg) this.world.notice(sp, msg, 'info');
      if (dur >= TALK_MIN_MS) {
        const need = dur * TALK_LISTEN_FRAC;
        const fans = [...t.listenMs].filter(([, ms]) => ms >= need).map(([id]) => this.world.players.get(id)).filter((x): x is ServerPlayer => !!x);
        const m = this.world.clock.mult('stories');
        const pay = (TALK_SPEAKER_PAY_EACH * Math.min(TALK_SPEAKER_MAX_LISTENERS, fans.length) + TALK_CLAP_PAY * t.claps.size) * m;
        if (fans.length) {
          this.world.credit(sp, pay);
          this.world.notice(sp, `🎙️ ${fans.length} ${fans.length === 1 ? 'person' : 'people'} listened${t.claps.size ? ` and ${t.claps.size} clapped` : ''}. +${Math.round(pay)} LD`, 'good');
          this.world.log('gave_talk', sp.id);
        } else this.world.notice(sp, 'Nobody stayed to listen this time. Try again when friends are around.', 'info');
        for (const f of fans) {
          this.world.credit(f, TALK_LISTENER_PAY * m);
          this.world.notice(f, `🎓 You listened to ${sp.name}'s talk. +${Math.round(TALK_LISTENER_PAY * m)} LD`, 'good');
          this.world.log('together', sp.id, f.id);
        }
      } else this.world.notice(sp, 'That talk was too short to count. Speak for at least 15 seconds next time.', 'info');
    }
    this.publish(true);
  }

  removed(id: string) {
    if (this.cur?.id === id) { this.cur = null; this.publish(true); }
    this.cooldown.delete(id);
  }
}
