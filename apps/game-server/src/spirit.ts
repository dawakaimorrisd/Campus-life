import {
  BEDTIME_MULT, CAMPUS_MAP, GROUP_PAY, GROUP_TICK_MS, JOKES, JOKE_COOLDOWN_MS, JOKE_GAP_MS, JOKE_LAUGH_LISTENER, JOKE_LAUGH_TELLER,
  JOKE_MAX_LAUGHS, JOKE_WINDOW_MS, MEET_MAX, MEET_PAY, MEET_RANGE, NIGHT_BONUS_CAP, NIGHT_PASS_PAY, NIGHT_POINT_PAY, STORIES,
  STORY_COOLDOWN_MS, STORY_LINE_MS, STORY_LISTENER_PAY, STORY_MAX_LISTENERS, STORY_TELLER_PAY, levelAt, zoneAt, type EmoteKind
} from '@campus/shared';
import { hearRange, say } from './chat';
import type { ServerPlayer, World } from './world';

interface StorySession { teller: string; title: string; lines: readonly string[]; idx: number; nextAt: number; heard: Map<string, number> }
interface JokeSession { teller: string; punch: string; punchAt: number; windowEnds: number; laughers: Set<string>; punched: boolean }

/**
 * Campus spirit: being good company pays. Sitting in a group, telling a story or a joke, meeting a new friend and
 * making it through the night all earn a little money. During bedtime the quiet night circle pays extra.
 */
export class SpiritEngine {
  private lastGroup = new Map<string, number>();
  private stories = new Map<string, StorySession>();
  private jokes = new Map<string, JokeSession>();
  private cooldown = new Map<string, number>();
  private met = new Set<string>();
  private metCount = new Map<string, number>();
  private nightPoints = new Map<string, number>();
  private lastNightPoint = new Map<string, number>();

  constructor(private world: World) {
    world.clock.onPhase((from, to, now) => {
      if (to === 'dusk') this.startNight();
      else if (to === 'dawn') this.endNight(now);
      if (to === 'class' && from !== 'class' && world.clock.lesson === 1) {
        world.earned.clear();
        this.metCount.clear();
      }
    });
  }

  /** Special bonus and the bedtime bonus together. */
  private mult(): number {
    let m = this.world.clock.mult('stories');
    if (this.world.clock.phase === 'bedtime') m *= BEDTIME_MULT;
    return m;
  }

  private nightPoint(id: string, n = 1) {
    if (!this.world.clock.isNight) return;
    this.nightPoints.set(id, (this.nightPoints.get(id) ?? 0) + n);
  }

  private startNight() {
    this.nightPoints.clear();
    this.lastNightPoint.clear();
  }

  /** Dawn: the night is over. Pay those who joined in, and give everybody a recap of the day. */
  private endNight(now: number) {
    void now;
    for (const id of this.world.players.keys()) {
      const p = this.world.players.get(id);
      if (!p) continue;
      const pts = this.nightPoints.get(id) ?? 0;
      if (pts > 0) {
        const bonus = NIGHT_PASS_PAY + Math.min(NIGHT_BONUS_CAP, pts * NIGHT_POINT_PAY);
        this.world.credit(p, bonus);
        this.world.notice(p, `🌅 You passed the night with the campus! +${bonus} LD`, 'good');
        this.world.log('passed_night', p.id);
      } else {
        this.world.notice(p, '🌅 You slept through the night. Next time, join the party or the night circle for a bonus.', 'info');
      }
    }
    // recap: what the day was worth
    for (const p of this.world.players.values()) {
      const earned = this.world.earned.get(p.id) ?? 0;
      this.world.notice(p, `📒 Good morning! Yesterday you earned ${earned} LD in total. You have ${Math.floor(p.money)} LD.`, 'info');
    }
  }

  private hearers(p: ServerPlayer): ServerPlayer[] {
    const out: ServerPlayer[] = [];
    for (const o of this.world.players.values()) {
      if (o === p || levelAt(o.y) !== levelAt(p.y)) continue;
      if (Math.hypot(o.x - p.x, o.y - p.y) <= hearRange(p, o)) out.push(o);
    }
    return out;
  }

  private canTell(p: ServerPlayer, what: string): boolean {
    const now = this.world.now();
    if (this.world.clock.phase === 'class' && zoneAt(CAMPUS_MAP, p.x, p.y)?.id) {
      const z = zoneAt(CAMPUS_MAP, p.x, p.y)!.id;
      if (z === 'student_hall' || z.startsWith('college_')) { this.world.notice(p, 'Class is in session. Save it for the break.', 'info'); return false; }
    }
    if (p.doing && p.doing !== 'dance') { this.world.notice(p, 'Finish what you are doing first.', 'info'); return false; }
    if (this.stories.has(p.id) || this.jokes.has(p.id)) { this.world.notice(p, 'You are already telling something.', 'info'); return false; }
    const wait = (this.cooldown.get(`${what}:${p.id}`) ?? 0) - now;
    if (wait > 0) { this.world.notice(p, `Give them a rest. You can do that again in ${Math.ceil(wait / 1000)}s.`, 'info'); return false; }
    if (this.hearers(p).length === 0) { this.world.notice(p, 'Nobody is close enough to hear you. Find some friends first.', 'info'); return false; }
    return true;
  }

  tellStory(p: ServerPlayer) {
    if (!this.canTell(p, 'story')) return;
    const st = STORIES[Math.floor(Math.random() * STORIES.length)];
    this.world.stand(p);
    p.path = []; p.dirX = 0; p.dirY = 0;
    p.doing = 'story';
    p.doingUntil = Number.MAX_SAFE_INTEGER;
    this.world.pushState(p);
    this.stories.set(p.id, { teller: p.id, title: st.title, lines: st.lines, idx: 0, nextAt: this.world.now() + 400, heard: new Map() });
    this.cooldown.set(`story:${p.id}`, this.world.now() + STORY_COOLDOWN_MS);
    for (const o of this.hearers(p)) this.world.notice(o, `📖 ${p.name} is telling "${st.title}". Stay and listen!`, 'fun');
    this.world.notice(p, `📖 You begin: "${st.title}". Stay put until the end.`, 'fun');
  }

  tellJoke(p: ServerPlayer) {
    if (!this.canTell(p, 'joke')) return;
    const j = JOKES[Math.floor(Math.random() * JOKES.length)];
    const now = this.world.now();
    this.world.stand(p);
    p.path = []; p.dirX = 0; p.dirY = 0;
    p.doing = 'joke';
    p.doingUntil = Number.MAX_SAFE_INTEGER;
    this.world.pushState(p);
    say(this.world, p, j.setup, false);
    this.cooldown.set(`joke:${p.id}`, now + JOKE_COOLDOWN_MS);
    this.jokes.set(p.id, { teller: p.id, punch: j.punch, punchAt: now + JOKE_GAP_MS, windowEnds: now + JOKE_GAP_MS + JOKE_WINDOW_MS, laughers: new Set(), punched: false });
    this.world.notice(p, '😂 Wait for the punchline...', 'fun');
  }

  /** Emotes that matter to company: laughing at a joke, waving at a stranger. */
  noteEmote(p: ServerPlayer, kind: EmoteKind) {
    if (kind === 'laugh' || kind === 'clap') {
      for (const s of this.jokes.values()) {
        const t = this.world.players.get(s.teller);
        if (!t || t.id === p.id || !s.punched || s.laughers.has(p.id) || s.laughers.size >= JOKE_MAX_LAUGHS) continue;
        if (levelAt(t.y) !== levelAt(p.y) || Math.hypot(t.x - p.x, t.y - p.y) > hearRange(t, p)) continue;
        s.laughers.add(p.id);
        this.world.credit(p, JOKE_LAUGH_LISTENER * this.mult());
        this.nightPoint(p.id);
        return;
      }
    }
    if (kind === 'wave') this.meet(p);
  }

  private meet(p: ServerPlayer) {
    if ((this.metCount.get(p.id) ?? 0) >= MEET_MAX) return;
    let best: ServerPlayer | null = null;
    let bd = MEET_RANGE;
    for (const o of this.world.players.values()) {
      if (o === p || levelAt(o.y) !== levelAt(p.y)) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) return;
    const key = [p.id, best.id].sort().join('|');
    if (this.met.has(key) || (this.metCount.get(best.id) ?? 0) >= MEET_MAX) return;
    if (this.world.memory.bond(p.id, best.id) > 0) { this.met.add(key); return; }
    this.met.add(key);
    this.metCount.set(p.id, (this.metCount.get(p.id) ?? 0) + 1);
    this.metCount.set(best.id, (this.metCount.get(best.id) ?? 0) + 1);
    const pay = MEET_PAY * this.world.clock.mult('stories');
    this.world.credit(p, pay);
    this.world.credit(best, pay);
    this.world.notice(p, `🤝 You met ${best.name}! +${pay} LD`, 'good');
    this.world.notice(best, `🤝 You met ${p.name}! +${pay} LD`, 'good');
    this.world.log('together', p.id, best.id);
    this.nightPoint(p.id, 2);
    this.nightPoint(best.id, 2);
  }

  /** About once a second. */
  tick(now: number) {
    // company: sitting or standing still with at least two others
    for (const c of this.world.clusters) {
      if (c.n < 3) continue;
      for (const id of c.ids) {
        const p = this.world.players.get(id);
        if (!p || p.moving) continue;
        if ((this.lastGroup.get(id) ?? 0) > now) continue;
        this.lastGroup.set(id, now + GROUP_TICK_MS);
        this.world.credit(p, GROUP_PAY * this.mult());
        this.nightPoint(id);
      }
    }
    // being at the party and dancing counts towards passing the night
    if (this.world.clock.isNight) {
      for (const p of this.world.players.values()) {
        if ((this.lastNightPoint.get(p.id) ?? 0) > now) continue;
        const inside = zoneAt(CAMPUS_MAP, p.x, p.y)?.id === 'student_center';
        if (inside || p.doing === 'dance') {
          this.lastNightPoint.set(p.id, now + 30_000);
          this.nightPoint(p.id, p.doing === 'dance' ? 2 : 1);
        }
      }
    }
    this.runStories(now);
    this.runJokes(now);
  }

  private runStories(now: number) {
    for (const [id, s] of [...this.stories]) {
      const p = this.world.players.get(id);
      if (!p || p.moving || p.doing !== 'story') { this.endStory(s, p, now); continue; }
      if (now < s.nextAt) continue;
      if (s.idx < s.lines.length) {
        say(this.world, p, s.lines[s.idx], false);
        for (const o of this.hearers(p)) s.heard.set(o.id, (s.heard.get(o.id) ?? 0) + 1);
        s.idx++;
        s.nextAt = now + STORY_LINE_MS;
      } else this.endStory(s, p, now);
    }
  }

  private endStory(s: StorySession, p: ServerPlayer | undefined, now: number) {
    this.stories.delete(s.teller);
    void now;
    if (!p) return;
    if (p.doing === 'story') this.world.cancelDoing(p);
    const mult = this.mult();
    const fans = [...s.heard].filter(([, n]) => n >= 2).map(([id]) => this.world.players.get(id)).filter((x): x is ServerPlayer => !!x).slice(0, STORY_MAX_LISTENERS);
    if (!fans.length) return this.world.notice(p, 'Nobody stayed to listen to the end. Try again with friends nearby.', 'info');
    const pay = STORY_TELLER_PAY * fans.length * mult;
    this.world.credit(p, pay);
    this.world.notice(p, `📖 ${fans.length} ${fans.length === 1 ? 'person' : 'people'} listened to the end. +${pay} LD`, 'good');
    this.nightPoint(p.id, 2);
    for (const f of fans) {
      const lp = STORY_LISTENER_PAY * mult;
      this.world.credit(f, lp);
      this.world.notice(f, `📖 Thanks for listening to ${p.name}'s story. +${lp} LD`, 'good');
      this.nightPoint(f.id, 1);
    }
    this.world.log('told_story', p.id);
  }

  private runJokes(now: number) {
    for (const [id, s] of [...this.jokes]) {
      const p = this.world.players.get(id);
      if (!p) { this.jokes.delete(id); continue; }
      if (!s.punched && now >= s.punchAt) {
        s.punched = true;
        say(this.world, p, s.punch, false);
      }
      if (now >= s.windowEnds) {
        this.jokes.delete(id);
        if (p.doing === 'joke') this.world.cancelDoing(p);
        const n = s.laughers.size;
        if (n > 0) {
          const pay = JOKE_LAUGH_TELLER * n * this.mult();
          this.world.credit(p, pay);
          this.world.notice(p, `😂 ${n} ${n === 1 ? 'person' : 'people'} laughed! +${pay} LD`, 'good');
          this.nightPoint(p.id, 2);
          this.world.log('joked', p.id);
        } else this.world.notice(p, 'Tough crowd. Nobody laughed. Try another joke later!', 'info');
      }
    }
  }

  removed(id: string) {
    this.stories.delete(id);
    this.jokes.delete(id);
    this.lastGroup.delete(id);
  }
}
