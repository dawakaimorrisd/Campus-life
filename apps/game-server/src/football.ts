import {
  CAMPUS_MAP, FB_COOLDOWN_MS, FB_GOALS_TO_WIN, FB_GOAL_PAY, FB_LOBBY_MS, FB_LOSE_PAY, FB_MATCH_MS, FB_MIN_PLAYERS, FB_QUEUE_MAX, FB_TEAM_CAP,
  FB_WIN_PAY, FB_DRAW_PAY, TILE,
  type FootballPhase, type FootballState, type Team
} from '@campus/shared';
import type { ServerPlayer, World } from './world';

const REC = CAMPUS_MAP.rec;

/**
 * Football matches. At most 4 a side. Press Join at the Games desk to open a lobby (30 seconds), pick Blue or Red or let
 * the game balance. When the lobby ends everyone is placed on their half and the match runs 3 minutes or until one side
 * scores 5. During a match only the players in it can touch the ball; others watch or join the waiting list.
 * When the pitch is not in a match the ball is free for a casual kickabout (no score, no pay).
 */
export class FootballEngine {
  private phase: FootballPhase = 'idle';
  private teams = new Map<string, Team>();
  private names = new Map<string, string>();
  private queue: Array<{ id: string; name: string }> = [];
  private score = { blue: 0, red: 0 };
  private startsAt = 0;
  private endsAt = 0;
  private cooldownUntil = 0;
  private lobbyExtensions = 0;
  private last: FootballState['last'] = null;
  private lastShownUntil = 0;
  private away = new Map<string, number>();
  private warnedAt = new Map<string, number>();

  constructor(private world: World) {}

  get inMatch() { return this.phase === 'match'; }
  has(id: string) { return this.teams.has(id) || this.queue.some((q) => q.id === id); }
  inGame(id: string) { return this.teams.has(id); }
  teamOf(id: string): Team | undefined { return this.phase === 'idle' ? undefined : this.teams.get(id); }
  canTouch(p: { id: string }) { return this.phase !== 'match' || this.teams.get(p.id) !== undefined; }
  private list(t: Team) { return [...this.teams].filter(([, x]) => x === t).map(([id]) => ({ id, name: this.names.get(id) ?? '?' })); }
  private count(t: Team) { return [...this.teams.values()].filter((x) => x === t).length; }

  state(): FootballState {
    const now = this.world.now();
    return {
      phase: this.phase, blue: this.list('blue'), red: this.list('red'), queue: this.queue.slice(), score: { ...this.score },
      startsAt: this.startsAt, endsAt: this.endsAt, cap: FB_TEAM_CAP, last: now < this.lastShownUntil ? this.last : null, now
    };
  }
  private changed() { this.world.games.broadcast(); }

  private place(p: ServerPlayer, team: Team) {
    this.teams.set(p.id, team);
    this.names.set(p.id, p.name);
    this.world.pushState(p);
  }

  join(p: ServerPlayer, want?: Team) {
    const now = this.world.now();
    if (this.teams.has(p.id)) return this.world.notice(p, 'You are already in this match.', 'info');
    if (this.queue.some((q) => q.id === p.id)) return this.world.notice(p, 'You are already on the waiting list.', 'info');
    const full = (t: Team) => this.count(t) >= FB_TEAM_CAP;
    const open = this.phase === 'lobby';
    if (this.phase === 'idle' && now >= this.cooldownUntil && !this.queue.length) {
      this.phase = 'lobby';
      this.startsAt = now + FB_LOBBY_MS;
      this.lobbyExtensions = 0;
      this.score = { blue: 0, red: 0 };
      this.world.events.emit('buzz', `${p.name} opened a football match at the Recreation Ground. Join a team!`, { x: p.x, y: p.y }, { key: 'fb', cooldownMs: 30_000, tone: 'fun', priority: false });
    } else if (!open) {
      if (this.queue.length >= FB_QUEUE_MAX) return this.world.notice(p, 'The waiting list is full. Try again later.', 'warn');
      this.queue.push({ id: p.id, name: p.name });
      this.world.notice(p, this.phase === 'match' ? `A match is on. You are on the waiting list (place ${this.queue.length}) for the next one.` : `You are on the waiting list (place ${this.queue.length}).`, 'info');
      return this.changed();
    }
    let team: Team;
    if (want && !full(want)) team = want;
    else if (want && full(want)) {
      const other: Team = want === 'blue' ? 'red' : 'blue';
      if (full(other)) { this.queue.push({ id: p.id, name: p.name }); this.world.notice(p, 'Both teams are full. You are on the waiting list.', 'info'); return this.changed(); }
      this.world.notice(p, `${want === 'blue' ? 'Blue' : 'Red'} is full, so you joined ${other === 'blue' ? 'Blue' : 'Red'}.`, 'info');
      team = other;
    } else {
      if (full('blue') && full('red')) { this.queue.push({ id: p.id, name: p.name }); this.world.notice(p, 'Both teams are full. You are on the waiting list.', 'info'); return this.changed(); }
      team = this.count('blue') <= this.count('red') ? (full('blue') ? 'red' : 'blue') : (full('red') ? 'blue' : 'red');
    }
    this.place(p, team);
    this.world.notice(p, `You joined ${team === 'blue' ? '🔵 Blue' : '🔴 Red'}. Kick-off in ${Math.max(0, Math.ceil((this.startsAt - now) / 1000))}s. Stay on the Recreation Ground.`, 'good');
    this.changed();
  }

  leave(p: ServerPlayer, quiet = false) {
    const had = this.teams.delete(p.id);
    const qi = this.queue.findIndex((q) => q.id === p.id);
    if (qi >= 0) this.queue.splice(qi, 1);
    this.away.delete(p.id);
    if (had) this.world.pushState(p);
    if (!had && qi < 0) return;
    if (!quiet) this.world.notice(p, 'You left the football game.', 'info');
    if (this.phase === 'match' && (this.count('blue') === 0 || this.count('red') === 0)) this.finish(this.world.now(), 'A team is empty, so the match ended.');
    else if (this.phase === 'lobby' && this.teams.size === 0) { this.phase = 'idle'; this.cooldownUntil = 0; }
    this.fillFromQueue();
    this.changed();
  }

  /** In the lobby, free places go to people waiting. */
  private fillFromQueue() {
    if (this.phase !== 'lobby') return;
    while (this.queue.length && this.teams.size < FB_TEAM_CAP * 2) {
      const q = this.queue.shift()!;
      const p = this.world.players.get(q.id);
      if (!p || !this.world.games.inArea(p)) continue;
      const team: Team = this.count('blue') <= this.count('red') ? 'blue' : 'red';
      this.place(p, team);
      this.world.notice(p, `A place opened. You are on ${team === 'blue' ? '🔵 Blue' : '🔴 Red'} in the next match!`, 'good');
    }
  }

  tick(now: number) {
    if (this.phase === 'idle') {
      if (this.queue.length && now >= this.cooldownUntil) {
        this.phase = 'lobby'; this.startsAt = now + FB_LOBBY_MS; this.lobbyExtensions = 0; this.score = { blue: 0, red: 0 };
        this.fillFromQueue();
        this.changed();
      }
      return;
    }
    // players who wander off the grounds are taken out after a few seconds
    for (const id of [...this.teams.keys()]) {
      const p = this.world.players.get(id);
      if (!p) { this.leaveById(id); continue; }
      if (this.world.games.inArea(p)) this.away.delete(id);
      else {
        const t = this.away.get(id) ?? now;
        this.away.set(id, t);
        if (now - t > 8000) { this.world.notice(p, 'You left the Recreation Ground, so you are out of the game.', 'warn'); this.leave(p, true); }
      }
    }
    if (this.phase === 'lobby' && now >= this.startsAt) this.kickOff(now);
    else if (this.phase === 'match' && (now >= this.endsAt || this.score.blue >= FB_GOALS_TO_WIN || this.score.red >= FB_GOALS_TO_WIN)) this.finish(now);
  }

  private leaveById(id: string) {
    this.teams.delete(id); this.away.delete(id);
    if (this.phase === 'match' && (this.count('blue') === 0 || this.count('red') === 0)) this.finish(this.world.now(), 'A team is empty, so the match ended.');
    this.changed();
  }

  private kickOff(now: number) {
    // balance: if one side has everybody (and 2+ players), move half across
    if (this.teams.size >= FB_MIN_PLAYERS && (this.count('blue') === 0 || this.count('red') === 0)) {
      const from: Team = this.count('blue') === 0 ? 'red' : 'blue';
      const to: Team = from === 'blue' ? 'red' : 'blue';
      const ids = [...this.teams].filter(([, t]) => t === from).map(([id]) => id);
      for (const id of ids.slice(0, Math.floor(ids.length / 2))) { this.teams.set(id, to); const p = this.world.players.get(id); if (p) this.world.pushState(p); }
    }
    if (this.teams.size < FB_MIN_PLAYERS) {
      if (this.teams.size > 0 && this.lobbyExtensions < 2) {
        this.lobbyExtensions++;
        this.startsAt = now + FB_LOBBY_MS;
        for (const id of this.teams.keys()) { const p = this.world.players.get(id); if (p) this.world.notice(p, 'Waiting for one more player. The lobby is open another 30 seconds.', 'info'); }
      } else {
        for (const id of [...this.teams.keys()]) { const p = this.world.players.get(id); if (p) { this.world.notice(p, 'Not enough players for a match. Try again with a friend.', 'info'); this.world.pushState(p); } }
        this.teams.clear(); this.phase = 'idle'; this.cooldownUntil = now + 5000;
      }
      return this.changed();
    }
    this.phase = 'match';
    this.endsAt = now + FB_MATCH_MS;
    this.score = { blue: 0, red: 0 };
    this.world.ball.reset();
    // everybody to their own half, spread out
    const pitch = REC.pitch;
    for (const team of ['blue', 'red'] as const) {
      const ids = [...this.teams].filter(([, t]) => t === team).map(([id]) => id);
      ids.forEach((id, i) => {
        const p = this.world.players.get(id);
        if (!p) return;
        const x = (team === 'blue' ? pitch.x + 4 + (i % 2) * 2 : pitch.x + pitch.w - 4 - (i % 2) * 2) * TILE;
        const y = (pitch.y + (pitch.h * (i + 1)) / (ids.length + 1)) * TILE;
        this.world.stand(p);
        p.path = []; p.dirX = 0; p.dirY = 0; p.x = x; p.y = y; p.facing = team === 'blue' ? 'right' : 'left'; p.moving = false;
        this.world.broadcast({ t: 'snap', tick: this.world.tick, moves: [{ id, x: Math.round(x), y: Math.round(y), f: p.facing, m: false }] });
        this.world.notice(p, `Kick-off! You are on ${team === 'blue' ? '🔵 Blue (attack right)' : '🔴 Red (attack left)'}. First to ${FB_GOALS_TO_WIN} or the best score in 3 minutes wins.`, 'fun');
      });
    }
    this.world.events.emit('buzz', 'A football match has kicked off at the Recreation Ground ⚽', { x: pitch.x * TILE, y: pitch.y * TILE }, { key: 'fbstart', cooldownMs: 30_000, tone: 'fun', priority: false });
    this.changed();
  }

  /** The ball crossed a goal line. side 'right' means it went into the right goal (Blue scores). */
  goal(side: 'left' | 'right', touchId: string | null): boolean {
    if (this.phase !== 'match') return false;
    const team: Team = side === 'right' ? 'blue' : 'red';
    this.score[team]++;
    const scorer = touchId ? this.world.players.get(touchId) : undefined;
    if (scorer && this.teams.get(scorer.id) === team) {
      const pay = FB_GOAL_PAY * this.world.clock.mult('goals');
      this.world.credit(scorer, pay);
      this.world.pushSelf(scorer);
      this.world.notice(scorer, `GOAL for ${team === 'blue' ? '🔵 Blue' : '🔴 Red'}! +${pay} LD`, 'fun');
      this.world.log('scored', scorer.id);
    }
    this.changed();
    return true;
  }

  private finish(now: number, note?: string) {
    const { blue, red } = this.score;
    const winner: Team | null = blue === red ? null : blue > red ? 'blue' : 'red';
    for (const [id, team] of this.teams) {
      const p = this.world.players.get(id);
      if (!p) continue;
      const pay = winner === null ? FB_DRAW_PAY : winner === team ? FB_WIN_PAY : FB_LOSE_PAY;
      this.world.credit(p, pay);
      this.world.pushSelf(p);
      this.world.notice(p, `${note ? note + ' ' : ''}Full time: Blue ${blue} – ${red} Red. ${winner === null ? 'A draw.' : winner === team ? 'You won!' : 'Good game.'} +${pay} LD`, winner === team ? 'good' : 'info');
      this.world.log('played_football', p.id);
    }
    const ids = [...this.teams.keys()];
    this.world.events.emit('buzz', `Full time at the Recreation Ground: Blue ${blue} – ${red} Red ⚽`, { x: REC.start.x * TILE, y: REC.start.y * TILE }, { key: 'fbend', cooldownMs: 0, tone: 'fun', priority: false });
    this.last = { blue, red, winner };
    this.lastShownUntil = now + 15_000;
    this.teams.clear();
    for (const id of ids) { const p = this.world.players.get(id); if (p) this.world.pushState(p); }
    this.phase = 'idle';
    this.cooldownUntil = now + FB_COOLDOWN_MS;
    this.startsAt = this.endsAt = 0;
    this.world.ball.reset();
    for (const q of this.queue) { const p = this.world.players.get(q.id); if (p) this.world.notice(p, 'The next match opens soon. You are on the list.', 'info'); }
    this.changed();
  }

  removed(id: string) {
    this.leaveById(id);
    const qi = this.queue.findIndex((q) => q.id === id);
    if (qi >= 0) this.queue.splice(qi, 1);
    if (this.phase === 'lobby' && this.teams.size === 0 && !this.queue.length) { this.phase = 'idle'; }
  }
}
