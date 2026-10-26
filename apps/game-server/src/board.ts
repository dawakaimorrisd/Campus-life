import {
  BOARD_AUTO_ACCEPT_MS, BOARD_HAND_IN_RANGE, BOARD_MAX_JOBS, BOARD_MAX_POSTS, BOARD_POST_COOLDOWN_MS, CAMPUS_MAP, SPOT_REACH,
  boardTitle, distToRect, levelAt, levelOfRow, type BoardAct, type BoardJob, type BoardKind, type BoardSubjectId
} from '@campus/shared';
import type { ServerPlayer, World } from './world';

/**
 * The Campus Jobs Board: jobs posted by students for other students.
 *
 * Rules (all decided here, never by a client):
 * - Posting needs the full reward. It is taken from the poster at once and held (escrow) until the job is paid or
 *   handed back, so it can never be spent twice.
 * - One claimant per job; claiming is a single step on the server, so two students cannot both win.
 * - The worker hands the job in face to face (close to the poster). The poster accepts and the money is released
 *   exactly once. If the poster does not answer in 90 seconds the hand-in is accepted automatically.
 * - Unclaimed or unfinished jobs expire at their deadline and the poster is refunded.
 * - A poster can cancel only while nobody has claimed it; a worker can give a job back any time before handing in.
 * - Leaving the game: open jobs are refunded, a claimed job is cancelled and refunded, a handed-in job is paid.
 */
interface Job extends BoardJob { postedAt: number }

export class BoardEngine {
  private jobs = new Map<number, Job>();
  private nextId = 1;
  private lastPost = new Map<string, number>();
  private lastJson = '';
  private busy = new Set<number>();
  private leaving: ServerPlayer | null = null;

  private who(id: string | null): ServerPlayer | undefined {
    if (!id) return undefined;
    return this.world.players.get(id) ?? (this.leaving?.id === id ? this.leaving : undefined);
  }

  /** Money this player has posted and not yet got back or paid out. It is saved with their balance, so a restart refunds it. */
  held(id: string): number {
    let n = 0;
    for (const j of this.jobs.values()) if (j.posterId === id) n += j.reward;
    return n;
  }

  constructor(private world: World) {}

  list(): BoardJob[] {
    return [...this.jobs.values()].map(({ postedAt, ...j }) => { void postedAt; return j; });
  }

  /** How many jobs are waiting for a worker (for the overview map). */
  get openCount() { return [...this.jobs.values()].filter((j) => j.state === 'available').length; }

  private publish(force = false) {
    const jobs = this.list();
    const json = JSON.stringify(jobs);
    if (!force && json === this.lastJson) return;
    this.lastJson = json;
    this.world.broadcast({ t: 'board', jobs, now: this.world.now() });
  }

  sendTo(p: ServerPlayer) {
    this.world.send(p, { t: 'board', jobs: this.list(), now: this.world.now() });
  }

  /** Called when someone stands at the board. */
  open(p: ServerPlayer) {
    this.world.send(p, { t: 'open', what: 'jobs' });
    this.sendTo(p);
    this.world.send(p, { t: 'jobs', slots: this.world.jobs.list() });
  }

  private nearBoard(p: ServerPlayer): boolean {
    return CAMPUS_MAP.spots.some((s) => s.kind === 'jobs' && levelAt(p.y) === levelOfRow(s.rect.y) && distToRect(CAMPUS_MAP, s.rect, p.x, p.y) <= SPOT_REACH + 40);
  }

  private postedBy(id: string) { return [...this.jobs.values()].filter((j) => j.posterId === id).length; }
  private workingOn(id: string) { return [...this.jobs.values()].find((j) => j.workerId === id && j.state !== 'available'); }

  post(p: ServerPlayer, kind: BoardKind, subject: BoardSubjectId, reward: number, mins: number) {
    const now = this.world.now();
    if (!this.nearBoard(p)) return this.world.notice(p, 'Walk up to the Campus Jobs Board to post a job.', 'info');
    if (this.jobs.size >= BOARD_MAX_JOBS) return this.world.notice(p, 'The board is full right now. Try again in a little while.', 'warn');
    if (this.postedBy(p.id) >= BOARD_MAX_POSTS) return this.world.notice(p, `You already have ${BOARD_MAX_POSTS} jobs on the board.`, 'warn');
    const wait = (this.lastPost.get(p.id) ?? 0) - now;
    if (wait > 0) return this.world.notice(p, `Give it a moment. You can post again in ${Math.ceil(wait / 1000)}s.`, 'info');
    if (p.money < reward) return this.world.notice(p, `That job pays ${reward} LD and you have ${Math.floor(p.money)} LD.`, 'warn');
    p.money -= reward; // held until the job is paid or handed back
    this.world.pushSelf(p);
    this.lastPost.set(p.id, now + BOARD_POST_COOLDOWN_MS);
    const job: Job = {
      id: this.nextId++, kind, subject, reward, state: 'available', posterId: p.id, posterName: p.name, workerId: null, workerName: null,
      deadline: now + mins * 60_000, acceptBy: 0, postedAt: now
    };
    this.jobs.set(job.id, job);
    this.world.notice(p, `Posted: ${boardTitle(job)}. ${reward} LD is held until it is done.`, 'good');
    this.world.log('posted_job', p.id);
    this.publish();
  }

  act(p: ServerPlayer, act: BoardAct, id: number) {
    const j = this.jobs.get(id);
    if (!j) return this.world.notice(p, 'That job is gone.', 'info');
    if (this.busy.has(id)) return;
    this.busy.add(id);
    try {
      switch (act) {
        case 'claim': return this.claim(p, j);
        case 'release': return this.release(p, j);
        case 'submit': return this.submit(p, j);
        case 'accept': return this.accept(p, j, false);
        case 'cancel': return this.cancel(p, j);
      }
    } finally {
      this.busy.delete(id);
    }
  }

  private claim(p: ServerPlayer, j: Job) {
    if (!this.nearBoard(p)) return this.world.notice(p, 'Walk up to the Campus Jobs Board to claim a job.', 'info');
    if (j.state !== 'available') return this.world.notice(p, 'Someone already claimed that one.', 'warn');
    if (j.posterId === p.id) return this.world.notice(p, 'You cannot claim your own job.', 'info');
    if (this.workingOn(p.id)) return this.world.notice(p, 'Finish or give back your current job first.', 'warn');
    j.state = 'claimed';
    j.workerId = p.id;
    j.workerName = p.name;
    this.world.notice(p, `Claimed! Find ${j.posterName}, do the job together, then hand it in when you are close.`, 'good');
    const poster = this.world.players.get(j.posterId);
    if (poster) this.world.notice(poster, `${p.name} claimed your job. They will come and find you.`, 'fun');
    this.publish();
  }

  private release(p: ServerPlayer, j: Job) {
    if (j.workerId !== p.id || j.state !== 'claimed') return;
    this.giveBack(j, `${p.name} gave your job back. It is open again.`);
    this.world.notice(p, 'You gave the job back.', 'info');
    this.publish();
  }

  private giveBack(j: Job, tellPoster?: string) {
    j.state = 'available';
    j.workerId = null;
    j.workerName = null;
    j.acceptBy = 0;
    const poster = this.world.players.get(j.posterId);
    if (poster && tellPoster) this.world.notice(poster, tellPoster, 'info');
  }

  private submit(p: ServerPlayer, j: Job) {
    if (j.workerId !== p.id || j.state !== 'claimed') return;
    const poster = this.world.players.get(j.posterId);
    if (!poster) return this.world.notice(p, `${j.posterName} is not here right now.`, 'warn');
    if (levelAt(poster.y) !== levelAt(p.y) || Math.hypot(poster.x - p.x, poster.y - p.y) > BOARD_HAND_IN_RANGE) {
      return this.world.notice(p, `Walk up to ${j.posterName} to hand it in.`, 'info');
    }
    j.state = 'submitted';
    j.acceptBy = this.world.now() + BOARD_AUTO_ACCEPT_MS;
    this.world.notice(p, `Handed in to ${j.posterName}. Waiting for them to accept.`, 'good');
    this.world.notice(poster, `📬 ${p.name} handed in your job. Open the board chip to accept and pay ${j.reward} LD.`, 'fun');
    this.publish();
  }

  private accept(p: ServerPlayer | null, j: Job, auto: boolean) {
    if (j.state !== 'submitted') return;
    if (!auto && p && j.posterId !== p.id) return;
    this.jobs.delete(j.id); // gone first, so it can never be paid twice
    const worker = this.who(j.workerId);
    if (worker) {
      this.world.credit(worker, j.reward);
      this.world.notice(worker, `${auto ? `${j.posterName} was busy, so it was accepted for you. ` : `${j.posterName} accepted your work. `}+${j.reward} LD`, 'good');
    }
    const poster = this.world.players.get(j.posterId);
    if (poster) this.world.notice(poster, `Paid ${j.reward} LD to ${j.workerName ?? 'the worker'}. Thank you!`, 'info');
    if (j.workerId) this.world.log('helped', j.workerId, j.posterId);
    this.publish();
  }

  private cancel(p: ServerPlayer, j: Job) {
    if (j.posterId !== p.id) return;
    if (j.state !== 'available') return this.world.notice(p, 'Someone is already working on it. You can cancel when it expires.', 'warn');
    this.jobs.delete(j.id);
    this.refund(j, 'Cancelled. Your money is back.');
    this.publish();
  }

  private refund(j: Job, why: string) {
    const poster = this.world.players.get(j.posterId);
    if (poster) {
      poster.money += j.reward;
      this.world.pushSelf(poster);
      this.world.notice(poster, `${why} +${j.reward} LD`, 'info');
    }
  }

  tick(now: number) {
    for (const j of [...this.jobs.values()]) {
      if (j.state === 'submitted' && now >= j.acceptBy) this.accept(null, j, true);
      else if (j.state !== 'submitted' && now >= j.deadline) {
        this.jobs.delete(j.id);
        this.refund(j, `Your job "${boardTitle(j)}" ran out of time.`);
        const w = j.workerId ? this.world.players.get(j.workerId) : undefined;
        if (w) this.world.notice(w, `Time ran out on "${boardTitle(j)}".`, 'warn');
      }
    }
    this.publish();
  }

  /** A player is leaving. Their open jobs are refunded; their work is handed back or paid. */
  removed(p: ServerPlayer) {
    this.lastPost.delete(p.id);
    this.leaving = p;
    for (const j of [...this.jobs.values()]) {
      if (j.posterId === p.id) {
        if (j.state === 'submitted') { this.accept(null, j, true); continue; }
        this.jobs.delete(j.id);
        p.money += j.reward; // p is still referenced, so the refund is saved with the rest of their money
        const w = j.workerId ? this.world.players.get(j.workerId) : undefined;
        if (w) this.world.notice(w, `${j.posterName} left campus, so the job was cancelled.`, 'info');
      } else if (j.workerId === p.id && j.state === 'claimed') {
        this.giveBack(j, `${p.name} left campus, so your job is open again.`);
      } else if (j.workerId === p.id && j.state === 'submitted') {
        // work is already handed in: pay it now so the leaver is not cheated
        this.accept(null, j, true);
      }
    }
    this.leaving = null;
    this.publish();
  }
}
