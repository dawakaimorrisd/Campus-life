import {
  ASSIGNMENT_TITLES, ASSIGN_MAX_MS, ASSIGN_MIN_MS, ASSIGN_PAY, ASSIGN_WARN_MS, CAMPUS_MAP, COLLEGES, DEANS_LIST_BONUS, GENERAL_ASSIGNMENT_TITLES,
  QUIZ_SLOTS, QUIZ_TF_PAY, QUIZ_TF_STREAK_BONUS, COLLECT_AT, QUIZ_BANK, QUIZ_FIRST_BONUS, QUIZ_MARK, QUIZ_PAY, SPOT_REACH, distToRect, levelAt, CLASS_MS,
  GPA_WINDOW, GRADUATION_PAY, HONORS_GPA, HOME_ROOM_BONUS, PASS_ATTEND, PASS_GPA, PROMOTION_PAY_PER_YEAR, TERM_LESSONS, YEARS, yearLabel, MARK_ASSIGNMENT_DONE, MARK_ASSIGNMENT_MISSED, MOODS, MOOD_IDS, QUIET_LIMIT, QUIET_WINDOW_MS, READ_COOLDOWN_MS,
  READ_PAY, STUDY_COOLDOWN_MS, STUDY_PAY, collegeOf, gpaOf, hash01, standingOf, zoneAt,
  type QuizQ, type QuizState, type AcademicRecord, type AcademicState, type AssignmentInfo, type CollegeId, type Mood
} from '@campus/shared';
import type { ServerPlayer, World } from './world';

interface Acad {
  college: CollegeId | null;
  marks: number[];
  year: number;
  termLessons: number;
  termN: number;
  termSum: number;
  termAttended: number;
  cumN: number;
  cumSum: number;
  graduated: { honors: boolean } | null;
  assignment: (AssignmentInfo & { warned: boolean; extended: boolean }) | null;
  answered: number;
  tfRight: number;
  dirty: boolean;
  noise: number[];
}

/**
 * Colleges, grades, instructor moods, assignments and the Library.
 * The ClassEngine tells this class what happened at each bell; this class owns everything about marks.
 * Grades come only from attendance, assignments done through Library study, never from paid help.
 */
export class AcademicsEngine {
  private acad = new Map<string, Acad>();
  private mood: Mood | null = null;
  private lessonsDone = 0;
  private quizTimes: number[] = [];
  private quizIndex = 0;
  private quizWindow = 20_000;
  private collectAt = 0;
  private quizId = 0;
  private quizzes = new Map<string, { id: number; kind: 'mcq' | 'tf'; q: QuizQ; options: string[]; correct: number; endsAt: number; first: boolean }>();

  constructor(private world: World, private termTarget = TERM_LESSONS) {
    world.clock.onPhase((from, to) => {
      if (to === 'dawn') { this.lessonsDone = 0; this.mood = null; this.broadcast(); }
      else if (to === 'class') { this.pickMood(); this.scheduleQuizzes(); }
      else if (from === 'class') { this.closeQuizzes(); this.broadcast(); }
    });
  }

  // ---------------------------------------------------------------- state
  private of(p: { id: string }): Acad {
    let a = this.acad.get(p.id);
    if (!a) { a = { college: null, marks: [], year: 1, termLessons: 0, termN: 0, termSum: 0, termAttended: 0, cumN: 0, cumSum: 0, graduated: null, answered: 0, tfRight: 0, assignment: null, dirty: false, noise: [] }; this.acad.set(p.id, a); }
    return a;
  }

  load(id: string, rec?: AcademicRecord | null) {
    if (!rec) return;
    const a = this.of({ id });
    a.college = COLLEGES.some((c) => c.id === rec.college) ? rec.college : null;
    a.marks = Array.isArray(rec.marks) ? rec.marks.filter((n) => typeof n === 'number' && n >= 0 && n <= 4).slice(-GPA_WINDOW) : [];
    const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
    a.year = Math.floor(num(rec.year, 1, YEARS + 1, 1));
    a.termLessons = Math.floor(num(rec.termLessons, 0, 1000, 0));
    a.termN = Math.floor(num(rec.termN, 0, 100000, 0));
    a.termSum = num(rec.termSum, 0, 400000, 0);
    a.termAttended = Math.floor(num(rec.termAttended, 0, 1000, 0));
    a.cumN = Math.floor(num(rec.cumN, 0, 100000, 0));
    a.cumSum = num(rec.cumSum, 0, 400000, 0);
    a.graduated = rec.graduated && a.year > YEARS ? { honors: !!rec.graduated.honors } : null;
    if (a.year > YEARS && !a.graduated) a.graduated = { honors: false };
  }
  record(id: string): AcademicRecord {
    const a = this.of({ id });
    return { college: a.college, marks: a.marks.slice(-GPA_WINDOW), year: a.year, termLessons: a.termLessons, termN: a.termN, termSum: a.termSum, termAttended: a.termAttended, cumN: a.cumN, cumSum: a.cumSum, graduated: a.graduated };
  }
  isGraduate(p: { id: string }) { return !!this.of(p).graduated; }
  /** What other players see under the name. */
  publicOf(p: { id: string }): { yr: number; col: CollegeId | undefined } { const a = this.of(p); return { yr: a.year, col: a.college ?? undefined }; }
  isDirty(id: string) { return !!this.acad.get(id)?.dirty; }
  clean(id: string) { const a = this.acad.get(id); if (a) a.dirty = false; }
  college(p: { id: string }) { return this.of(p).college; }
  gpa(p: { id: string }) { return gpaOf(this.of(p).marks); }
  get currentMood() { return this.mood; }
  assignment(p: { id: string }) { return this.of(p).assignment; }

  state(p: { id: string }): AcademicState {
    const a = this.of(p);
    const g = gpaOf(a.marks);
    return {
      college: a.college, year: a.year, termLessons: a.termLessons, termTarget: this.termTarget,
      termGpa: a.termN ? Math.round((a.termSum / a.termN) * 10) / 10 : null, termAttended: a.termAttended, needAttended: Math.ceil(this.termTarget * PASS_ATTEND), graduated: a.graduated,
      gpa: g, standing: standingOf(g), marks: a.marks.length, mood: this.mood, lessonsDone: this.lessonsDone,
      assignment: a.assignment ? { title: a.assignment.title, dueAt: a.assignment.dueAt, reward: a.assignment.reward } : null, now: this.world.now()
    };
  }
  sendTo(p: ServerPlayer) { this.world.send(p, { t: 'academics', ...this.state(p) }); }
  broadcast() { for (const p of this.world.players.values()) this.sendTo(p); }

  removed(id: string) { this.acad.delete(id); }

  // ---------------------------------------------------------------- the instructor's mood
  private pickMood() {
    const c = this.world.clock.state();
    this.mood = MOOD_IDS[Math.floor(hash01(`mood:${c.day}:${c.lesson}`) * MOOD_IDS.length)];
    this.broadcast();
    const def = MOODS[this.mood];
    for (const p of this.world.players.values()) {
      const z = zoneAt(CAMPUS_MAP, p.x, p.y)?.id;
      if (z && this.world.classes.isRoom(z)) this.world.notice(p, `${def.icon} The instructor is ${def.label.toLowerCase()} today. ${def.note}`, 'info');
    }
  }
  /** How long after the bell you are still on time, right now. */
  get lateAfterMs() { return this.world.clock.scaleMs(this.mood ? MOODS[this.mood].lateAfterMs : 25_000); }

  // ---------------------------------------------------------------- colleges
  choose(p: ServerPlayer, id: CollegeId) {
    const a = this.of(p);
    if (a.college) return this.world.notice(p, `You are already in the ${collegeOf(a.college)!.name}.`, 'warn');
    const c = collegeOf(id);
    if (!c) return;
    a.college = id;
    a.dirty = true;
    this.world.notice(p, `${c.icon} Welcome to the ${c.name}. Attending class in your home room earns a bonus.`, 'good');
    this.world.log('enrolled', p.id);
    this.sendTo(p);
    this.world.pushState(p);
    void this.world.persistPlayer(p);
  }

  // ---------------------------------------------------------------- marks
  private addMark(p: ServerPlayer, mark: number) {
    const a = this.of(p);
    if (a.graduated) return;
    a.termN++; a.termSum += mark; a.cumN++; a.cumSum += mark;
    a.marks.push(mark);
    if (a.marks.length > GPA_WINDOW) a.marks.splice(0, a.marks.length - GPA_WINDOW);
    a.dirty = true;
  }

  /**
   * One lesson ended for this student. outcome: 'on_time' | 'late' | 'early' | 'absent'.
   * Returns the extra LD earned (home room, mood, Dean's List) so the class code can pay it with the attendance.
   */
  lessonResult(p: ServerPlayer, mark: number, present: boolean, zone: string | null, basePay: number): { extra: number; parts: string[] } {
    const a0 = this.of(p);
    if (a0.graduated) return { extra: 0, parts: [] };
    this.addMark(p, mark);
    a0.termLessons++;
    if (present) a0.termAttended++;
    const parts: string[] = [];
    let extra = 0;
    if (present && basePay > 0) {
      const a = this.of(p);
      const home = collegeOf(a.college);
      if (home && zone === home.room) { extra += HOME_ROOM_BONUS; parts.push(`${HOME_ROOM_BONUS} home room`); }
      const m = this.mood ? MOODS[this.mood].bonus : 0;
      if (m) { extra += m; parts.push(`${m} ${this.mood}`); }
      if (standingOf(gpaOf(a.marks)) === "Dean's List") { extra += DEANS_LIST_BONUS; parts.push(`${DEANS_LIST_BONUS} Dean's List`); }
    }
    if (a0.termLessons >= this.termTarget) this.endTerm(p);
    return { extra, parts };
  }

  /** The term is over: promote, make repeat, or graduate. */
  private endTerm(p: ServerPlayer) {
    const a = this.of(p);
    const gpa = a.termN ? a.termSum / a.termN : 0;
    const attended = a.termAttended;
    const need = Math.ceil(this.termTarget * PASS_ATTEND);
    const year = a.year;
    a.termLessons = 0; a.termN = 0; a.termSum = 0; a.termAttended = 0;
    a.dirty = true;
    const gTxt = gpa.toFixed(1);
    if (gpa >= PASS_GPA && attended >= need) {
      if (year >= YEARS) {
        const cum = a.cumN ? a.cumSum / a.cumN : gpa;
        const honors = cum >= HONORS_GPA;
        a.year = YEARS + 1;
        a.graduated = { honors };
        a.assignment = null;
        this.world.credit(p, GRADUATION_PAY);
        this.world.notice(p, `🎓 You graduated${honors ? ' with honors' : ''}! Final GPA ${cum.toFixed(1)}. +${GRADUATION_PAY} LD`, 'good');
        const col = collegeOf(a.college);
        this.world.events.emit('buzz', `🎓 ${p.name} graduated${honors ? ' with honors' : ''}${col ? ` from the ${col.name}` : ''}!`, { x: p.x, y: p.y }, { key: `grad:${p.id}`, cooldownMs: 0, tone: 'fun', priority: true });
        this.world.log('graduated', p.id);
      } else {
        a.year = year + 1;
        const pay = PROMOTION_PAY_PER_YEAR * year;
        this.world.credit(p, pay);
        this.world.notice(p, `🎉 Term passed (GPA ${gTxt}). You are promoted to ${yearLabel(a.year)}. +${pay} LD`, 'good');
        this.world.events.emit('buzz', `${p.name} moved up to ${yearLabel(a.year)}!`, { x: p.x, y: p.y }, { key: `promo:${p.id}`, cooldownMs: 0, tone: 'fun', priority: false });
        this.world.log('promoted', p.id);
      }
    } else {
      const why = gpa < PASS_GPA ? `your term GPA was ${gTxt} (you need ${PASS_GPA.toFixed(1)})` : `you attended ${attended} of ${this.termTarget} classes (you need ${need})`;
      this.world.notice(p, `📕 You did not pass this term: ${why}. You repeat ${yearLabel(year)}. Attend class and finish assignments to move up.`, 'warn');
      this.world.log('repeated', p.id);
    }
    this.world.pushSelf(p);
    this.world.pushState(p);
  }

  /** The class ended: hand an assignment to everyone who was marked present, then update every screen. */
  classEnded(presentIds: string[]) {
    this.lessonsDone = Math.min(4, this.lessonsDone + 1);
    const lessonNo = this.world.clock.lesson;
    if (lessonNo !== 2 && lessonNo !== 4) { this.broadcast(); return; }
    const now = this.world.now();
    const next = this.world.clock.state();
    // handed out after lessons 2 and 4 (free time follows), collected at the wrap-up of the next class
    const due = this.world.clock.msUntilNextWrapup(now);
    for (const id of presentIds) {
      const p = this.world.players.get(id);
      if (!p || this.of(p).assignment || this.of(p).graduated) continue;
      const a = this.of(p);
      const pool = a.college ? ASSIGNMENT_TITLES[a.college] : GENERAL_ASSIGNMENT_TITLES;
      const title = pool[Math.floor(hash01(`as:${id}:${now}`) * pool.length)];
      const reward = ASSIGN_PAY + (this.mood ? MOODS[this.mood].assignBonus : 0);
      a.assignment = { title, dueAt: due, reward, warned: false, extended: false };
      this.world.notice(p, `📝 Assignment: ${title}. Finish it at the Library tables before it is due (+${reward} LD).`, 'info');
    }
    this.broadcast();
  }

  // ---------------------------------------------------------------- class quiz
  private roomKey(z: string | null | undefined): string | null {
    if (!z || !this.world.classes.isRoom(z)) return null;
    if (z === 'student_hall') return 'general';
    return COLLEGES.find((c) => c.room === z)?.id ?? null;
  }
  private scheduleQuizzes() {
    const start = this.world.clock.startsAtMs;
    const len = Math.max(1, this.world.clock.endsAtMs - start);
    this.quizTimes = QUIZ_SLOTS.map((s) => start + len * s.at);
    this.quizIndex = 0;
    this.collectAt = start + len * COLLECT_AT;
    this.quizzes.clear();
    for (const x of this.acad.values()) { x.tfRight = 0; }
  }
  private askQuizzes(now: number) {
    const c = this.world.clock.state();
    const rooms = new Map<string, ServerPlayer[]>();
    for (const p of this.world.players.values()) {
      if (p.id.startsWith('bot-') || this.of(p).graduated) continue;
      const z = zoneAt(CAMPUS_MAP, p.x, p.y)?.id;
      if (!z || !this.roomKey(z)) continue;
      (rooms.get(z) ?? rooms.set(z, []).get(z)!).push(p);
    }
    for (const [z, list] of rooms) {
      const slot = QUIZ_SLOTS[Math.min(this.quizIndex, QUIZ_SLOTS.length - 1)];
      const len = Math.max(1, this.world.clock.endsAtMs - this.world.clock.startsAtMs);
      const window = Math.min(slot.windowMs, len * slot.maxFrac);
      const bank = QUIZ_BANK[this.roomKey(z)!];
      const q = bank[Math.floor(hash01(`quiz:${c.day}:${c.lesson}:${this.quizIndex}:${z}`) * bank.length)];
      let text = q.q;
      let options: string[] = [...q.options];
      let correct: number = q.answer;
      if (slot.kind === 'tf') {
        // turn the question into a statement that is either true or false
        const isTrue = hash01(`tf:${c.day}:${c.lesson}:${this.quizIndex}:${z}`) < 0.5;
        const wrong = q.options.filter((_, i) => i !== q.answer);
        const shown = isTrue ? q.options[q.answer] : wrong[Math.floor(hash01(`tfw:${this.quizIndex}:${z}`) * wrong.length)];
        text = `True or false? ${q.q} → "${shown}"`;
        options = ['True', 'False'];
        correct = isTrue ? 0 : 1;
      }
      const quiz = { id: ++this.quizId, kind: slot.kind, q, options, correct, endsAt: now + window, first: true };
      this.quizzes.set(z, quiz);
      for (const p of list) {
        this.of(p).answered = 0;
        this.world.send(p, { t: 'quiz', quiz: { id: quiz.id, kind: slot.kind, q: text, options, endsAt: quiz.endsAt, now } });
        if (slot.kind === 'mcq') this.world.notice(p, '🙋 The instructor asks the class a question. Answer for a participation mark.', 'info');
      }
    }
  }
  private closeQuizzes() {
    if (!this.quizzes.size) return;
    this.quizzes.clear();
    for (const p of this.world.players.values()) this.world.send(p, { t: 'quiz', quiz: null });
  }
  answer(p: ServerPlayer, id: number, choice: number) {
    const a = this.of(p);
    const z = zoneAt(CAMPUS_MAP, p.x, p.y)?.id ?? '';
    const quiz = this.quizzes.get(z);
    if (!quiz || quiz.id !== id || a.answered === id || a.graduated) return;
    if (this.world.now() > quiz.endsAt) return this.world.notice(p, 'Too late. The question is closed.', 'warn');
    a.answered = id;
    this.world.send(p, { t: 'quiz', quiz: null });
    if (choice === quiz.correct) {
      if (quiz.kind === 'tf') {
        a.tfRight++;
        const streak = a.tfRight === 3;
        const pay = QUIZ_TF_PAY + (streak ? QUIZ_TF_STREAK_BONUS : 0);
        this.world.credit(p, pay);
        this.world.pushSelf(p);
        this.world.notice(p, streak ? `⚡ Three out of three! +${pay} LD` : `✅ Right! +${pay} LD`, 'good');
        return;
      }
      const bonus = quiz.first ? QUIZ_FIRST_BONUS : 0;
      quiz.first = false;
      this.addMark(p, QUIZ_MARK);
      this.world.credit(p, QUIZ_PAY + bonus);
      this.world.pushSelf(p);
      this.world.notice(p, `✅ Correct! +${QUIZ_PAY + bonus} LD${bonus ? ' (first right answer)' : ''}`, 'good');
      this.world.log('answered', p.id);
      this.sendTo(p);
    } else {
      this.world.notice(p, quiz.kind === 'tf' ? 'Not quite.' : `Not quite. The answer was "${quiz.q.options[quiz.q.answer]}".`, 'info');
    }
  }

  // ---------------------------------------------------------------- office hours
  private nearInstructor(p: ServerPlayer) {
    return CAMPUS_MAP.spots.some((s) => s.kind === 'instructor' && levelAt(p.y) === levelAt(s.rect.y * CAMPUS_MAP.tile) && distToRect(CAMPUS_MAP, s.rect, p.x, p.y) <= SPOT_REACH + 40);
  }
  office(p: ServerPlayer) {
    if (this.world.classes.inSession) return this.world.notice(p, 'The instructor: "We are in class. Come and see me after the bell."', 'info');
    this.sendTo(p);
    this.world.send(p, { t: 'open', what: 'instructor' });
  }
  /** Ask for more time on the assignment. Once per assignment; a strict instructor says no. */
  extend(p: ServerPlayer) {
    const a = this.of(p);
    if (!this.nearInstructor(p)) return this.world.notice(p, 'Go and see the instructor in person.', 'warn');
    if (this.world.classes.inSession) return this.world.notice(p, 'The instructor: "Not during class."', 'info');
    if (!a.assignment) return this.world.notice(p, 'You have no assignment to ask about.', 'info');
    if (a.assignment.extended) return this.world.notice(p, 'The instructor: "I already gave you extra time."', 'info');
    a.assignment.extended = true;
    const mood = this.mood ?? 'relaxed';
    if (mood === 'strict') return this.world.notice(p, '😠 The instructor: "No extensions. Be on time next time."', 'warn');
    const extra = this.world.clock.scaleMs(mood === 'relaxed' ? 240_000 : mood === 'cheerful' ? 180_000 : 120_000);
    a.assignment.dueAt += extra;
    a.assignment.warned = false;
    this.world.notice(p, `${MOODS[mood].icon} The instructor gives you more time on the assignment.`, 'good');
    this.sendTo(p);
  }

  tick(now: number) {
    if (this.world.classes.inSession && this.quizTimes.length && now >= this.quizTimes[0]) { this.quizTimes.shift(); this.askQuizzes(now); this.quizIndex++; }
    if (this.world.classes.inSession && this.collectAt && now >= this.collectAt) { this.collectAt = 0; this.world.broadcast({ t: 'notice', text: '📝 The instructor is collecting assignments.', tone: 'info' }); }
    for (const [z, q] of this.quizzes) if (now > q.endsAt + 1500) { this.quizzes.delete(z); for (const p of this.world.players.values()) if (zoneAt(CAMPUS_MAP, p.x, p.y)?.id === z) this.world.send(p, { t: 'quiz', quiz: null }); }
    for (const [id, a] of this.acad) {
      const p = this.world.players.get(id);
      if (!p || !a.assignment) continue;
      if (now >= a.assignment.dueAt) {
        this.addMark(p, MARK_ASSIGNMENT_MISSED);
        this.world.notice(p, `You missed the assignment "${a.assignment.title}". It counts against your GPA.`, 'warn');
        a.assignment = null;
        this.sendTo(p);
      } else if (!a.assignment.warned && a.assignment.dueAt - now <= this.world.clock.scaleMs(ASSIGN_WARN_MS)) {
        a.assignment.warned = true;
        this.world.notice(p, '⏰ Your assignment is due soon. Study at the Library tables.', 'warn');
      }
    }
  }

  // ---------------------------------------------------------------- the Library
  /** Called when a study or read session finishes. */
  finishedStudy(p: ServerPlayer, spotId: string) {
    const a = this.of(p);
    if (spotId.startsWith('read')) {
      this.world.credit(p, READ_PAY);
      this.world.setCooldown(p, `study:${spotId}`, READ_COOLDOWN_MS);
      this.world.notice(p, `You finished a chapter. +${READ_PAY} LD`, 'good');
      this.world.log('read', p.id);
      this.world.pushSelf(p);
      return;
    }
    this.world.setCooldown(p, `study:${spotId}`, STUDY_COOLDOWN_MS);
    if (a.assignment) {
      const { title, reward } = a.assignment;
      a.assignment = null;
      this.addMark(p, MARK_ASSIGNMENT_DONE);
      this.world.credit(p, reward);
      this.world.notice(p, `✅ "${title}" handed in. +${reward} LD`, 'good');
      this.world.log('studied', p.id);
    } else {
      this.world.credit(p, STUDY_PAY);
      this.world.notice(p, `Good study session. +${STUDY_PAY} LD`, 'good');
      this.world.log('studied', p.id);
    }
    this.world.pushSelf(p);
    this.sendTo(p);
  }

  /** Chat in the Library: a few lines are fine, a lot earns a shush that breaks your study. */
  noise(p: ServerPlayer, now: number) {
    if (zoneAt(CAMPUS_MAP, p.x, p.y)?.id !== 'library') return;
    const a = this.of(p);
    a.noise = a.noise.filter((t) => now - t < QUIET_WINDOW_MS);
    a.noise.push(now);
    if (a.noise.length > QUIET_LIMIT) {
      a.noise = [];
      this.world.notice(p, '🤫 Shh! This is a quiet zone.', 'warn');
      if (p.doing === 'study') this.world.cancelDoing(p);
    }
  }
}
