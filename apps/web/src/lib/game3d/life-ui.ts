import {
  COLLEGES, MOODS, classSegmentAt, formatCampusTime, YEARS, collegeOf, BOARD_DEADLINES_MIN, BOARD_KINDS, BOARD_MAX_POSTS, BOARD_REWARDS, BOARD_SUBJECTS, MARKET_ITEMS, TALK_TOPICS, boardNext, boardTitle,
  type AcademicState, type GamesState, type ClassSegmentId, type QuizState, type RaceState, type ActiveJob, type BoardJob, type BoardKind, type BoardSubjectId, type ClientMsg, type ClockPhase, type ClockState, type JobSlot, type TalkState
} from '@campus/shared';

type Send = (m: ClientMsg) => void;

const CSS = `
.c3d-life{position:absolute;left:max(10px,env(safe-area-inset-left));top:max(58px,calc(env(safe-area-inset-top) + 50px));display:flex;flex-direction:column;gap:6px;align-items:flex-start;pointer-events:none;max-width:46vw}
.c3d-life .chip{display:none;flex-direction:column;gap:1px;padding:5px 10px;border-radius:12px;background:rgba(21,26,56,.82);color:#fff;font:800 12px/1.15 "Bricolage Grotesque",system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.4)}
.c3d-life .chip small{font-weight:700;font-size:11px;opacity:.8}
.c3d-life .chip.class{background:rgba(30,70,52,.88)}
.c3d-life .chip.late{background:rgba(110,60,20,.9)}
.c3d-life .chip.free{background:rgba(24,86,120,.9)}
.c3d-life .chip.dusk{background:rgba(120,58,40,.92)}
.c3d-life .chip.party{background:rgba(120,36,110,.92)}
.c3d-life .chip.bedtime{background:rgba(32,34,92,.94)}
.c3d-life .chip.dawn{background:rgba(150,100,40,.92)}
.c3d-life .chip.special{background:rgba(176,122,10,.95)}
.c3d-life .chip.job{background:rgba(70,40,110,.9);pointer-events:auto;cursor:pointer}
.c3d-life .chip.acad,.c3d-life .chip.race{pointer-events:auto;cursor:pointer}
.c3d-life .chip[style*='flex']:hover{filter:brightness(1.2)}
.c3d-card .item{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.08)}
.c3d-card .item .tx{flex:1;display:flex;flex-direction:column;gap:2px}
.c3d-card .item small{font-weight:600;opacity:.75;font-size:12px}
.c3d-card .item button{flex:none;min-width:84px}
.c3d-card.tall{width:min(390px,94vw);max-height:82vh;overflow:auto}
.c3d-card .tabs{display:flex;gap:6px}
.c3d-card .tabs button{padding:8px 6px;font-size:13px;background:rgba(255,255,255,.12);color:#fff}
.c3d-card .tabs button.on{background:#ffb62e;color:#151a38}
.c3d-card .pick{display:flex;flex-wrap:wrap;gap:6px}
.c3d-card .pick button{flex:none;padding:8px 10px;font-size:13px;background:rgba(255,255,255,.12);color:#fff}
.c3d-card .pick button.on{background:#ffb62e;color:#151a38}
.c3d-card label{display:flex;flex-direction:column;gap:3px;font-size:12px;opacity:.9}
.c3d-card select{font:700 14px inherit;font-family:inherit;padding:8px;border-radius:10px;border:0;background:rgba(255,255,255,.14);color:#fff}
.c3d-card select option{color:#151a38}
.c3d-card .note{font-size:12px;opacity:.75}
.c3d-life .chip.work{background:rgba(26,92,92,.92);pointer-events:auto;cursor:pointer}
.c3d-life .chip.pay{background:rgba(160,110,10,.95);pointer-events:auto;cursor:pointer}
.c3d-life .chip.talk{background:rgba(110,40,90,.92)}
.c3d-life .chip.race{background:rgba(180,60,20,.93)}
.c3d-life .chip.acad{background:rgba(60,50,120,.9);pointer-events:auto;cursor:pointer}
.c3d-card .tt{display:flex;gap:6px}
.c3d-card .tt div{flex:1;text-align:center;padding:8px 2px;border-radius:10px;background:rgba(255,255,255,.1);font-size:12px;font-weight:800}
.c3d-card .tt div.done{background:#2f9e5b}
.c3d-card .tt div.now{background:#ffb62e;color:#151a38}
`;

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * The phone screens for everyday campus life: the class bell chip, the jobs board, your errand, and the market.
 * Every button only asks; the server decides.
 */
export class LifeUi {
  private style: HTMLStyleElement;
  private box: HTMLDivElement;
  private classChip: HTMLDivElement;
  private gamesCard!: HTMLDivElement;
  private gamesBody!: HTMLDivElement;
  private ballChip!: HTMLDivElement;
  private games: GamesState | null = null;
  private jobChip: HTMLDivElement;
  private jobsCard: HTMLDivElement;
  private jobsBody: HTMLDivElement;
  private marketCard: HTMLDivElement;
  private marketBody: HTMLDivElement;
  private clk: ClockState | null = null;
  private specialChip: HTMLDivElement;
  private job: ActiveJob | null = null;
  private boardJobs: BoardJob[] = [];
  private boardChips = new Map<number, HTMLDivElement>();
  private selfId = '';
  private tab: 'board' | 'post' | 'work' = 'board';
  private form: { kind: BoardKind; subject: BoardSubjectId; reward: number; mins: number } = { kind: 'assignment', subject: 'college_nursing', reward: 20, mins: 5 };
  private talk: TalkState = { speaker: null, now: 0 };
  private talkChip!: HTMLDivElement;
  private acadChip!: HTMLDivElement;
  private quizCard!: HTMLDivElement;
  private quizBody!: HTMLDivElement;
  private quiz: QuizState | null = null;
  private officeCard!: HTMLDivElement;
  private officeBody!: HTMLDivElement;
  private raceChip!: HTMLDivElement;
  private race: RaceState | null = null;
  private raceShownUntil = 0;
  private acadCard!: HTMLDivElement;
  private acadBody!: HTMLDivElement;
  private acad: AcademicState | null = null;
  private remindedKey = '';
  private askedCollege = false;
  private tourCard!: HTMLDivElement;
  private tourBody!: HTMLDivElement;
  private tourDone: Record<string, boolean> = {};
  private lecternCard!: HTMLDivElement;
  private lecternBody!: HTMLDivElement;
  private zone: string | null = null;
  private slots: JobSlot[] = [];
  private skew = 0;
  private money = 0;
  private inRoom = false;
  private joinedLate = false;
  private nextPaint = 0;
  /** Called when the bell rings (so the sound and the staff can react). */
  onBell: (phase: 'class' | 'break') => void = () => {};
  /** Called whenever the campus moves to a new part of the day (not on the first message). */
  onPhase: (phase: ClockPhase, lesson: number) => void = () => {};
  /** A reminder the player should see (class about to start). */
  onReminder: (text: string) => void = () => {};

  constructor(private overlay: HTMLElement, private send: Send) {
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    overlay.appendChild(this.style);
    this.box = document.createElement('div');
    this.box.className = 'c3d-life';
    this.classChip = this.chip('class');
    this.specialChip = this.chip('special');
    this.talkChip = this.chip('talk');
    this.raceChip = this.chip('race');
    this.ballChip = this.chip('race');
    this.ballChip.addEventListener('click', () => this.open('games'));
    this.acadChip = this.chip('acad');
    this.acadChip.addEventListener('click', () => this.open('academics'));
    this.jobChip = this.chip('job');
    this.jobChip.addEventListener('click', () => this.send({ t: 'drop_job' }));
    overlay.appendChild(this.box);
    [this.jobsCard, this.jobsBody] = this.card('🧰 Campus Jobs Board', 'Students post paid jobs for each other. The money is held safely until the work is accepted.');
    [this.marketCard, this.marketBody] = this.card('🛍️ Marketplace', 'What would you like?');
    [this.lecternCard, this.lecternBody] = this.card('🎙️ Lecture Area', 'Share an idea. Listening is free and always optional.');
    [this.acadCard, this.acadBody] = this.card('🎓 My studies', 'Your college, grades and today\'s classes.');
    this.acadCard.classList.add('tall');
    [this.quizCard, this.quizBody] = this.card('🙋 Question from the instructor', 'Pick the best answer. A right answer pays and counts as participation.');
    [this.officeCard, this.officeBody] = this.card('🧑‍🏫 Office hours', 'The instructor looks up from the desk.');
    [this.gamesCard, this.gamesBody] = this.card('🎮 Games desk', 'Small groups, fair turns. Pick a game and join. You can only be in one at a time.');
    this.gamesCard.classList.add('tall');
    [this.tourCard, this.tourBody] = this.card('👋 Welcome to Campus Life', '');
    this.tourCard.querySelector('.x')?.remove();
    this.tourCard.style.zIndex = '9';
    this.jobsCard.classList.add('tall');
    this.lecternCard.classList.add('tall');
  }

  private chip(extra: string) {
    const c = document.createElement('div');
    for (const ev of ['pointerdown', 'pointerup']) c.addEventListener(ev, (e) => e.stopPropagation());
    c.className = `chip ${extra}`;
    this.box.appendChild(c);
    return c;
  }

  private card(title: string, sub: string): [HTMLDivElement, HTMLDivElement] {
    const c = document.createElement('div');
    c.className = 'c3d-card';
    for (const ev of ['pointerdown', 'pointerup', 'click', 'touchstart']) c.addEventListener(ev, (e) => e.stopPropagation());
    const h = document.createElement('h3');
    h.textContent = title;
    h.style.paddingRight = '34px';
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'x'; x.textContent = '✕'; x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', () => c.classList.remove('on'));
    c.appendChild(x);
    const p = document.createElement('p');
    p.textContent = sub;
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'alt';
    close.textContent = 'Close';
    close.addEventListener('click', () => c.classList.remove('on'));
    c.append(h, p, body, close);
    this.overlay.appendChild(c);
    return [c, body];
  }

  private now() { return Date.now() + this.skew; }

  // ---------------------------------------------------------------- state in
  applyClock(m: ClockState) {
    const prev = this.clk;
    this.clk = m;
    if (m.now) this.skew = m.now - Date.now();
    if (prev && (prev.phase !== m.phase || prev.lesson !== m.lesson)) {
      if (m.phase === 'class' || (m.phase === 'break' && prev.phase === 'class')) this.onBell(m.phase);
      this.onPhase(m.phase, m.lesson);
    }
    this.paint();
  }
  applyJobs(slots: JobSlot[]) { this.slots = slots; if (this.jobsCard.classList.contains('on')) this.paintJobs(); }
  applyJob(job: ActiveJob | null) { this.job = job; if (job?.now) this.skew = job.now - Date.now(); this.paint(); if (this.jobsCard.classList.contains('on')) this.paintJobs(); }
  setMoney(m: number) { this.money = m; if (this.marketCard.classList.contains('on')) this.paintMarket(); if (this.jobsCard.classList.contains('on')) this.paintJobs(); }
  setInRoom(v: boolean) { if (v !== this.inRoom) { this.inRoom = v; this.paint(); } }
  get segmentId(): ClassSegmentId | null {
    const c = this.clk;
    if (!c || c.phase !== 'class') return null;
    return classSegmentAt(1 - (c.endsAt - this.now()) / Math.max(1, c.endsAt - c.startsAt)).id;
  }
  get inSession() { return this.clk?.phase === 'class'; }
  get phase(): ClockPhase | null { return this.clk?.phase ?? null; }

  open(what: 'jobs' | 'market' | 'lectern' | 'academics' | 'instructor' | 'games') {
    this.closeAll();
    if (what === 'games') { this.gamesCard.classList.add('on'); this.paintGames(); return; }
    if (what === 'instructor') { this.officeCard.classList.add('on'); this.paintOffice(); return; }
    if (what === 'academics') { this.acadCard.classList.add('on'); this.paintAcad(); return; }
    if (what === 'jobs') { this.jobsCard.classList.add('on'); this.paintJobs(); }
    else if (what === 'market') { this.marketCard.classList.add('on'); this.paintMarket(); }
    else { this.lecternCard.classList.add('on'); this.paintLectern(); }
  }
  closeAll() { this.gamesCard.classList.remove('on'); this.officeCard.classList.remove('on'); this.acadCard.classList.remove('on'); this.jobsCard.classList.remove('on'); this.marketCard.classList.remove('on'); this.lecternCard.classList.remove('on'); }

  setSelf(id: string) { this.selfId = id; }
  setPlace(zone: string | null) { if (zone !== this.zone) { this.zone = zone; this.paint(); } }
  applyBoard(jobs: BoardJob[], now: number) {
    this.boardJobs = jobs;
    if (now) this.skew = now - Date.now();
    if (this.jobsCard.classList.contains('on')) this.paintJobs();
    this.paint();
  }
  applyAcademics(a: AcademicState) {
    this.acad = a;
    if (a.now) this.skew = a.now - Date.now();
    const hadCollege = !!this.hadCollege;
    this.hadCollege = !!a.college;
    if (!a.college && !this.askedCollege) {
      this.askedCollege = true;
      this.tour('welcome', () => this.open('academics'));
    } else if (a.college && !hadCollege && this.askedCollege) this.tour('day');
    else if (this.acadCard.classList.contains('on')) this.paintAcad();
    this.paint();
  }
  private hadCollege: boolean | null = null;
  private seen(id: string) { try { return localStorage.getItem('campus-tour-' + id) === '1'; } catch { return !!this.tourDone[id]; } }
  private markSeen(id: string) { this.tourDone[id] = true; try { localStorage.setItem('campus-tour-' + id, '1'); } catch { /* private window */ } }
  /** A short, skippable welcome. Shown once per browser. */
  tour(id: 'welcome' | 'day', then?: () => void) {
    if (this.seen(id)) { then?.(); return; }
    const pages: Array<[string, string]> = id === 'welcome'
      ? [
        ['🚶 Moving around', 'Hold the round pad (bottom left) and drag to walk. On a computer use W A S D or the arrow keys. You can also tap the ground and your student walks there.'],
        ['👆 Tapping things', 'Tap a person to see who they are and say hello. Tap a glowing spot, like a desk, a chair or a door, to use it. Buttons appear at the bottom right when there is something to do.'],
        ['🗺️ Finding your way', 'Open the map (the map button, or press M) to see the whole campus and jump to any place. The box at the top left always tells you what is happening now and what to do next.'],
        ['🎓 Last step', 'Next you will pick your college. It is your home room for classes and cannot be changed later.']
      ]
      : [
        ['📚 Your day', 'A day has 4 short classes with breaks between. When the bell rings, walk to your college room. Being on time earns attendance and a little LD.'],
        ['🙋 In class', 'The instructor teaches, asks you a question and gives true/false rounds. Tap an answer to earn marks. After classes 2 and 4 you get an assignment; hand it in at the Library tables.'],
        ['🌤️ Free time and evenings', 'Between classes, earn LD with jobs, football, the race and the carousel at the Games desk, or just meet friends. At dusk, head to the Student Center for the party.'],
        ['🏆 Your goal', 'Pass each term with a GPA of 2.0 or better to move up a year. Four years and you graduate. Tap the 🎓 chip any time to see how you are doing.']
      ];
    let i = 0;
    const show = () => {
      const [t, text] = pages[i];
      this.closeAll();
      this.tourCard.classList.add('on');
      this.tourBody.replaceChildren();
      this.tourBody.dataset.keep = '1';
      const h = document.createElement('p');
      h.style.cssText = 'font-weight:900;font-size:16px;margin:0';
      h.textContent = t;
      const p = document.createElement('p');
      p.style.margin = '0';
      p.textContent = text;
      const dots = document.createElement('p');
      dots.className = 'note';
      dots.textContent = pages.map((_, k) => (k === i ? '●' : '○')).join(' ');
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px';
      const end = () => { this.markSeen(id); this.tourCard.classList.remove('on'); delete this.tourBody.dataset.keep; then?.(); };
      if (i > 0) row.appendChild(this.btn('Back', () => { i--; show(); }));
      row.appendChild(this.btn(i === pages.length - 1 ? (id === 'welcome' ? 'Choose my college' : "Let's go") : 'Next', () => { if (i === pages.length - 1) end(); else { i++; show(); } }));
      this.tourBody.append(h, p, dots, row);
      if (i < pages.length - 1) { const s = this.btn('Skip', end); s.className = 'alt'; this.tourBody.appendChild(s); }
    };
    show();
  }
  applyQuiz(q: QuizState | null) {
    this.quiz = q;
    if (q?.now) this.skew = q.now - Date.now();
    if (!q) { this.quizCard.classList.remove('on'); return; }
    this.closeAll();
    this.quizCard.classList.add('on');
    this.quizBody.replaceChildren();
    this.quizBody.dataset.keep = '1';
    const p = document.createElement('p');
    p.textContent = q.q;
    p.style.fontWeight = '800';
    this.quizBody.appendChild(p);
    this.quizBody.style.flexDirection = q.kind === 'tf' ? 'row' : 'column';
    q.options.forEach((o, i) => this.quizBody.appendChild(this.btn(o, () => { this.send({ t: 'answer_quiz', id: q.id, choice: i }); this.quizCard.classList.remove('on'); })));
  }
  private paintOffice() {
    const a = this.acad;
    const body = this.officeBody;
    body.replaceChildren();
    const p = (t: string, cls = '') => { const e = document.createElement('p'); e.textContent = t; if (cls) e.className = cls; body.appendChild(e); };
    if (!a || !a.college) { p('Choose your college first (tap the 🎓 chip).'); return; }
    if (a.graduated) { p('"Congratulations, graduate. The campus is proud of you."'); return; }
    let line: string;
    const behind = a.termLessons >= 4 && a.termAttended < Math.floor(a.termLessons * 0.6);
    if (a.termGpa !== null && a.termGpa < 2) line = `"Your term GPA is ${a.termGpa.toFixed(1)}. You need 2.0 to move up. Come to every class and hand in your assignments."`;
    else if (behind) line = `"You have attended ${a.termAttended} of ${a.termLessons} classes this term. You need ${a.needAttended} of ${a.termTarget} to pass. Do not miss more."`;
    else if (a.termGpa !== null && a.termGpa >= 3.5) line = `"Excellent work this term, GPA ${a.termGpa.toFixed(1)}. Keep it up and you will graduate with honors."`;
    else line = `"You are on track for Year ${a.year + 1 > YEARS ? 'graduation' : a.year + 1}. ${a.termLessons} of ${a.termTarget} classes done."`;
    p(line);
    if (a.assignment) {
      p(`📝 ${a.assignment.title} · due in ${clock(a.assignment.dueAt - this.now())}`, 'note');
      body.appendChild(this.btn('Ask for more time', () => { this.send({ t: 'ask_extension' }); }));
      p('You can ask once per assignment. A strict instructor will say no.', 'note');
    } else p('No assignment right now. Attend class to get one.', 'note');
  }
  get college() { return this.acad?.college ?? null; }
  get mood() { return this.acad?.mood ?? null; }
  private paintAcad() {
    const a = this.acad;
    const body = this.acadBody;
    body.replaceChildren();
    if (!a) return;
    const p = (t: string, cls = '') => { const e = document.createElement('p'); e.textContent = t; if (cls) e.className = cls; body.appendChild(e); return e; };
    if (!a.college) {
      p('Choose your college. You can only choose once. Going to class in your home room earns a bonus.');
      for (const c of COLLEGES) {
        const row = document.createElement('div');
        row.className = 'item';
        const tx = document.createElement('div');
        tx.className = 'tx';
        tx.textContent = `${c.icon} ${c.short}`;
        const sm = document.createElement('small');
        sm.textContent = c.name;
        tx.appendChild(sm);
        row.append(tx, this.btn('Join', () => this.send({ t: 'choose_college', college: c.id })));
        body.appendChild(row);
      }
      return;
    }
    const col = collegeOf(a.college)!;
    p(`${col.icon} ${col.name}`);
    p(`GPA ${a.gpa === null ? 'not yet' : a.gpa.toFixed(1)} · ${a.standing}${a.marks ? ` · ${a.marks} marks` : ''}`);
    if (a.graduated) {
      p(`🎓 You graduated${a.graduated.honors ? ' with honors' : ''}. Congratulations! You can still enjoy the campus, run races, give lectures and help on the Jobs Board.`);
      return;
    }
    const prog = document.createElement('div');
    prog.className = 'item';
    const ptx = document.createElement('div');
    ptx.className = 'tx';
    ptx.textContent = `📘 Year ${a.year} of ${YEARS}`;
    const psm = document.createElement('small');
    psm.textContent = `Term: ${a.termLessons} of ${a.termTarget} classes · term GPA ${a.termGpa === null ? '–' : a.termGpa.toFixed(1)} · attended ${a.termAttended} (need ${a.needAttended})`;
    const bar = document.createElement('div');
    bar.style.cssText = 'height:8px;border-radius:6px;background:rgba(255,255,255,.15);overflow:hidden;margin-top:4px';
    const fill = document.createElement('div');
    fill.style.cssText = `height:100%;width:${Math.min(100, Math.round((a.termLessons / a.termTarget) * 100))}%;background:#ffb62e`;
    bar.appendChild(fill);
    ptx.append(psm, bar);
    prog.appendChild(ptx);
    body.appendChild(prog);
    p('To move up: finish the term with a GPA of 2.0 or better and attend most classes. Pass four years to graduate.', 'note');
    const tt = document.createElement('div');
    tt.className = 'tt';
    const c = this.clk;
    for (let i = 1; i <= 4; i++) {
      const d = document.createElement('div');
      const now = c?.phase === 'class' && c.lesson === i;
      const done = a.lessonsDone >= i && !now;
      d.className = now ? 'now' : done ? 'done' : '';
      d.textContent = `${now ? '📚' : done ? '✅' : '⏳'} Class ${i}`;
      tt.appendChild(d);
    }
    body.appendChild(tt);
    if (a.mood) { const m = MOODS[a.mood]; p(`${m.icon} Instructor today: ${m.label}. ${m.note}`, 'note'); }
    if (a.assignment) p(`📝 ${a.assignment.title} · due in ${clock(a.assignment.dueAt - this.now())} · +${a.assignment.reward} LD. Study at the Library tables (upstairs) to hand it in.`);
    else p('No assignment right now. Attend class to get one.', 'note');
    p('Grades come only from attending class and finishing assignments. Paid help never changes them.', 'note');
  }
  applyGames(g: GamesState) {
    this.games = g;
    if (g.football.now) this.skew = g.football.now - Date.now();
    if (this.gamesCard.classList.contains('on')) this.paintGames();
    this.paint();
  }
  private paintGames() {
    const g = this.games;
    const body = this.gamesBody;
    body.replaceChildren();
    if (!g) { body.textContent = 'Loading…'; return; }
    const now = this.now();
    const me = this.selfId;
    const sec = (title: string, how: string) => {
      const h = document.createElement('p');
      h.style.cssText = 'font-weight:800;margin:6px 0 0';
      h.textContent = title;
      const s = document.createElement('p');
      s.className = 'note';
      s.textContent = how;
      body.append(h, s);
    };
    const line = (t: string) => { const e = document.createElement('p'); e.textContent = t; body.appendChild(e); };
    // football
    const f = g.football;
    sec('⚽ Football · 4 a side', 'Two teams, 3 minutes, first to 5 goals. Goals pay LD. Walk the pitch alone for a free kickabout.');
    const inBlue = f.blue.some((x) => x.id === me), inRed = f.red.some((x) => x.id === me), inQ = f.queue.some((x) => x.id === me);
    if (f.phase === 'idle') line('No match yet. Be the first to join a team.');
    else if (f.phase === 'lobby') line(`Kick-off in ${clock(f.startsAt - now)} · 🔵 ${f.blue.length}/${f.cap} · 🔴 ${f.red.length}/${f.cap}`);
    else line(`🔵 ${f.score.blue} – ${f.score.red} 🔴 · ${clock(f.endsAt - now)} left`);
    if (f.last && f.phase !== 'match') line(`Last match: ${f.last.winner ? (f.last.winner === 'blue' ? 'Blue' : 'Red') + ' won' : 'a draw'} ${f.last.blue}–${f.last.red}`);
    if (f.queue.length) line(`Waiting: ${f.queue.map((x) => x.name).join(', ')}`);
    if (inBlue || inRed || inQ) body.appendChild(this.btn(inQ ? `Leave the waiting list (#${f.queue.findIndex((x) => x.id === me) + 1})` : `Leave my team (${inBlue ? 'Blue' : 'Red'})`, () => this.send({ t: 'game_leave', game: 'football' })));
    else {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px';
      row.append(this.btn(`Join Blue 🔵 (${f.blue.length}/${f.cap})`, () => this.send({ t: 'game_join', game: 'football', team: 'blue' })), this.btn(`Join Red 🔴 (${f.red.length}/${f.cap})`, () => this.send({ t: 'game_join', game: 'football', team: 'red' })));
      body.appendChild(row);
    }
    // race
    const rc = this.race;
    sec('🏁 Sprint race · up to 6 runners', 'Stand on your lane. Wait for GO, then run to the flag and back. Moving early is a false start.');
    if (rc) {
      const mine = rc.entrants.some((x) => x.id === me), q = rc.queue.some((x) => x.id === me);
      if (rc.phase === 'idle') line('No race yet. Join to open one.');
      else if (rc.phase === 'open') line(`Starts in ${clock(rc.startsAt - now)} · ${rc.entrants.length}/${rc.cap} runners`);
      else line(`Race on! ${rc.entrants.length} running`);
      if (rc.queue.length) line(`Waiting: ${rc.queue.map((x) => x.name).join(', ')}`);
      if (mine || q) body.appendChild(this.btn(q ? `Leave the waiting list (#${rc.queue.findIndex((x) => x.id === me) + 1})` : 'Leave the race', () => this.send({ t: 'game_leave', game: 'race' })));
      else body.appendChild(this.btn(rc.phase === 'running' || rc.entrants.length >= rc.cap ? 'Join the waiting list' : 'Join the race', () => this.send({ t: 'game_join', game: 'race' })));
    }
    // carousel
    const c = g.carousel;
    sec('🎠 Carousel · ' + c.max + ' seats', `A short, relaxing ride. ${c.fare} LD a seat. Riders keep each other company.`);
    line(`${c.riders}/${c.max} seats taken`);
    body.appendChild(this.btn(c.riders >= c.max ? 'Full, try again soon' : `Ride (${c.fare} LD)`, () => this.send({ t: 'game_join', game: 'carousel' })));
  }
  applyRace(r: RaceState) {
    const was = this.race?.phase;
    this.race = r;
    if (r.now) this.skew = r.now - Date.now();
    if (r.phase === 'idle' && was && was !== 'idle' && r.results.length) this.raceShownUntil = this.now() + 10_000;
    this.paint();
  }
  /** True while somebody is running a race or the results are still on screen. */
  get raceActive() { return !!this.race && (this.race.phase !== 'idle' || this.now() < this.raceShownUntil); }
  applyTalk(t: TalkState) {
    this.talk = t;
    if (t.now) this.skew = t.now - Date.now();
    if (this.lecternCard.classList.contains('on')) this.paintLectern();
    this.paint();
  }
  /** Jobs waiting for a worker (the overview map pulses the Marketplace when there are some). */
  get openJobs() { return this.boardJobs.filter((j) => j.state === 'available').length; }
  get talkActive() { return !!this.talk.speaker; }
  get speaking() { return !!this.talk.speaker && this.talk.speaker.id === this.selfId; }

  // ---------------------------------------------------------------- painting
  private paint() {
    const c = this.clk;
    const now = this.now();
    if (!c) { this.classChip.style.display = 'none'; this.specialChip.style.display = 'none'; }
    else {
      const left = clock(c.endsAt - now);
      let title = '';
      let sub = '';
      switch (c.phase) {
        case 'class':
          { const seg = classSegmentAt(1 - (c.endsAt - now) / Math.max(1, c.endsAt - c.startsAt));
            title = `📚 Class ${c.lesson} of 4 · ${seg.icon} ${seg.label}`;
            sub = this.inRoom ? `${seg.what} · ${left} left` : `go to a classroom · ${left} left`; }
          break;
        case 'break':
          title = '🔔 Break time';
          sub = c.lesson === 2 || c.lesson === 4 ? `free time starts in ${left}` : `next class in ${left}`;
          break;
        case 'free':
          title = '🌤️ Free time';
          sub = `${left} left · earn LD: jobs, football, stories, friends`;
          break;
        case 'dusk':
          title = '🌇 Dusk is falling';
          sub = `Student Center opens in ${left} · head there now`;
          break;
        case 'party':
          title = '🎉 Party night';
          sub = `${left} left · dance, cheer, enjoy`;
          break;
        case 'bedtime':
          title = '🌙 Bedtime';
          sub = `${left} · sit in a group, tell stories and jokes`;
          break;
        default:
          title = '🌅 Good morning';
          sub = `class starts in ${left}`;
      }
      { const fr = Math.min(1, Math.max(0, 1 - (c.endsAt - now) / Math.max(1, c.endsAt - c.startsAt))); title = `🕗 ${formatCampusTime(c.clockFrom + (c.clockTo - c.clockFrom) * fr)} · ${title}`; }
      this.classChip.style.display = 'flex';
      this.classChip.className = `chip class ${c.phase}${c.phase === 'class' && !this.inRoom ? ' late' : ''}`;
      this.classChip.replaceChildren(document.createTextNode(title), Object.assign(document.createElement('small'), { textContent: sub }));
      const sp = c.special;
      if (sp && sp.endsAt > now) {
        this.specialChip.style.display = 'flex';
        this.specialChip.replaceChildren(document.createTextNode(`⭐ ${sp.label}`), Object.assign(document.createElement('small'), { textContent: `${clock(sp.endsAt - now)} left` }));
      } else this.specialChip.style.display = 'none';
    }
    // the sprint race
    const rc = this.race;
    const mineRace = !!rc && rc.entrants.some((e) => e.id === this.selfId);
    const nearTrack = this.zone === 'sprint_track' || this.zone === 'recreation';
    if (rc && (mineRace || nearTrack) && (rc.phase !== 'idle' || now < this.raceShownUntil)) {
      this.raceChip.style.display = 'flex';
      let head = '';
      let sub = '';
      if (rc.phase === 'open') { head = `🏁 Sprint race · ${rc.entrants.length} runners`; sub = `starts in ${clock(rc.startsAt - now)} · join at the start line`; }
      else if (rc.phase === 'running') {
        if (now < rc.startsAt) { head = `🏁 ${Math.max(1, Math.ceil((rc.startsAt - now) / 1000))}…`; sub = 'get ready on the line'; }
        else { head = '🏃 GO! Run to the flag and back'; sub = rc.results.length ? `${rc.results[0].name} is first` : `${clock(rc.endsAt - now)} left`; }
      } else { const w = rc.results[0]; head = w ? `🏆 ${w.name} won in ${(w.ms / 1000).toFixed(1)}s` : '🏁 Race over'; sub = rc.results.slice(1, 3).map((x) => `#${x.place} ${x.name}`).join(' · '); }
      this.raceChip.replaceChildren(document.createTextNode(head), Object.assign(document.createElement('small'), { textContent: sub }));
    } else this.raceChip.style.display = 'none';
    // football chip: only for people in the match or standing by the pitch
    const fb = this.games?.football;
    if (fb && fb.phase !== 'idle' && (fb.blue.some((x) => x.id === this.selfId) || fb.red.some((x) => x.id === this.selfId) || this.zone === 'recreation')) {
      this.ballChip.style.display = 'flex';
      const mineF = fb.blue.some((x) => x.id === this.selfId) ? '🔵' : fb.red.some((x) => x.id === this.selfId) ? '🔴' : '';
      const head = fb.phase === 'lobby' ? `⚽ Football kick-off in ${clock(fb.startsAt - now)}` : `⚽ 🔵 ${fb.score.blue} – ${fb.score.red} 🔴`;
      const sub = fb.phase === 'lobby' ? `${mineF ? 'you are ' + mineF : 'tap to join'} · ${fb.blue.length + fb.red.length} players` : `${clock(fb.endsAt - now)} left${mineF ? ' · you are ' + mineF : ''}`;
      this.ballChip.replaceChildren(document.createTextNode(head), Object.assign(document.createElement('small'), { textContent: sub }));
    } else this.ballChip.style.display = 'none';
    // grades chip and reminders
    const ac = this.acad;
    if (ac && ac.college) {
      this.acadChip.style.display = 'flex';
      const asg = ac.assignment;
      this.acadChip.replaceChildren(document.createTextNode(`🎓 GPA ${ac.gpa === null ? '–' : ac.gpa.toFixed(1)}`), Object.assign(document.createElement('small'), { textContent: asg ? `📝 due in ${clock(asg.dueAt - now)}` : 'tap for my studies' }));
    } else if (ac && !ac.college) {
      this.acadChip.style.display = 'flex';
      this.acadChip.replaceChildren(document.createTextNode('🎓 Choose your college'), Object.assign(document.createElement('small'), { textContent: 'tap here' }));
    } else this.acadChip.style.display = 'none';
    if (c && c.phase === 'break' && c.endsAt - now <= 20_000 && c.endsAt - now > 0) {
      const key = `${c.day}:${c.lesson}`;
      if (key !== this.remindedKey) {
        this.remindedKey = key;
        const home = collegeOf(this.acad?.college);
        this.onReminder(`⏰ Class ${c.lesson + 1 > 4 ? 'is over for today' : c.lesson + 1} starts in 20 seconds.${home && c.lesson < 4 ? ` Your home room is ${home.short}.` : ''}`);
      }
    }
    // the talk happening at the lectern (shown to people in the Lecture Area, and to the speaker)
    const sp = this.talk.speaker;
    if (sp && (this.zone === 'lecture_area' || sp.id === this.selfId)) {
      this.talkChip.style.display = 'flex';
      this.talkChip.replaceChildren(
        document.createTextNode(`🎙️ ${sp.id === this.selfId ? 'You are speaking' : `${sp.name} is speaking`}`),
        Object.assign(document.createElement('small'), { textContent: `${sp.topic} · ${clock(sp.endsAt - now)} left · ${sp.listeners} listening` })
      );
    } else this.talkChip.style.display = 'none';
    // my jobs from the board: tap to act
    const mineJobs = this.boardJobs.filter((x) => x.posterId === this.selfId || x.workerId === this.selfId).filter((x) => x.state !== 'available' || x.workerId === this.selfId);
    const keep = new Set(mineJobs.map((x) => x.id));
    for (const [id, el] of this.boardChips) if (!keep.has(id)) { el.remove(); this.boardChips.delete(id); }
    for (const x of mineJobs) {
      let el = this.boardChips.get(x.id);
      if (!el) {
        el = document.createElement('div');
        el.addEventListener('click', () => {
          const cur = this.boardJobs.find((y) => y.id === x.id);
          if (!cur) return;
          if (cur.state === 'claimed' && cur.workerId === this.selfId) this.send({ t: 'board_act', act: 'submit', id: cur.id });
          else if (cur.state === 'submitted' && cur.posterId === this.selfId) this.send({ t: 'board_act', act: 'accept', id: cur.id });
          else this.open('jobs');
        });
        this.box.insertBefore(el, this.jobChip);
        this.boardChips.set(x.id, el);
      }
      const asWorker = x.workerId === this.selfId;
      el.className = `chip ${x.state === 'submitted' && !asWorker ? 'pay' : 'work'}`;
      el.style.display = 'flex';
      const head = x.state === 'submitted' && !asWorker ? `📬 ${x.workerName} handed in · tap to pay ${x.reward} LD` : asWorker ? `📝 ${boardTitle(x)}` : `⏳ ${boardTitle(x)}`;
      const sub = asWorker ? (x.state === 'claimed' ? `find ${x.posterName} · tap to hand in · ${clock(x.deadline - now)}` : `waiting for ${x.posterName} to accept`) : x.state === 'claimed' ? `${x.workerName} is on it · ${clock(x.deadline - now)}` : '';
      el.replaceChildren(document.createTextNode(head), Object.assign(document.createElement('small'), { textContent: sub }));
    }
    const j = this.job;
    if (!j) this.jobChip.style.display = 'none';
    else {
      this.jobChip.style.display = 'flex';
      this.jobChip.replaceChildren(
        document.createTextNode(`📦 ${j.label}`),
        Object.assign(document.createElement('small'), { textContent: `${clock(j.endsAt - now)} left · +${j.pay} LD · tap to give back` })
      );
    }
  }

  private btn(label: string, fn: () => void, cls = '', disabled = false) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (cls) b.className = cls;
    b.disabled = disabled;
    b.addEventListener('click', fn);
    return b;
  }

  private paintJobs() {
    const body = this.jobsBody;
    body.replaceChildren();
    const tabs = document.createElement('div');
    tabs.className = 'tabs';
    const mine = this.boardJobs.filter((j) => j.posterId === this.selfId || j.workerId === this.selfId).length;
    for (const [id, label] of [['board', `Jobs (${this.boardJobs.length})`], ['post', 'Post a job'], ['work', 'Campus work']] as const) {
      tabs.appendChild(this.btn(label + (id === 'board' && mine ? ' •' : ''), () => { this.tab = id; this.paintJobs(); }, this.tab === id ? 'on' : ''));
    }
    body.appendChild(tabs);
    if (this.tab === 'board') this.paintBoard(body);
    else if (this.tab === 'post') this.paintPost(body);
    else this.paintErrands(body);
  }

  private paintBoard(body: HTMLElement) {
    const now = this.now();
    const me = this.selfId;
    const working = this.boardJobs.some((j) => j.workerId === me);
    if (!this.boardJobs.length) {
      const p = document.createElement('p');
      p.textContent = 'No jobs on the board yet. Tap "Post a job" to ask for help, or try Campus work for errands.';
      body.appendChild(p);
    }
    for (const j of this.boardJobs) {
      const row = document.createElement('div');
      row.className = 'item';
      const tx = document.createElement('div');
      tx.className = 'tx';
      tx.textContent = boardTitle(j);
      const sm = document.createElement('small');
      const who = j.posterId === me ? 'You posted' : `${j.posterName} posted`;
      sm.textContent = `${who} · ${j.reward} LD · ${clock(j.deadline - now)} left`;
      const nx = document.createElement('small');
      nx.textContent = boardNext(j, me);
      tx.append(sm, nx);
      row.appendChild(tx);
      const act = (a: 'claim' | 'release' | 'submit' | 'accept' | 'cancel') => this.send({ t: 'board_act', act: a, id: j.id });
      if (j.posterId === me) {
        if (j.state === 'available') row.appendChild(this.btn('Cancel', () => act('cancel'), 'alt'));
        else if (j.state === 'submitted') row.appendChild(this.btn('Accept', () => act('accept')));
      } else if (j.workerId === me) {
        if (j.state === 'claimed') { row.appendChild(this.btn('Hand in', () => act('submit'))); }
      } else if (j.state === 'available') {
        row.appendChild(this.btn('Claim', () => { act('claim'); }, '', working));
      } else row.appendChild(this.btn('Taken', () => {}, 'alt', true));
      body.appendChild(row);
      if (j.workerId === me && j.state === 'claimed') {
        const rel = this.btn('Give this job back', () => act('release'), 'alt');
        body.appendChild(rel);
      }
    }
    const n = document.createElement('p');
    n.className = 'note';
    n.textContent = 'Paid help is a favour between students. It never changes anybody\'s grades. Hand a job in face to face: stand close to the person who posted it.';
    body.appendChild(n);
  }

  private paintPost(body: HTMLElement) {
    const f = this.form;
    const mineCount = this.boardJobs.filter((j) => j.posterId === this.selfId).length;
    const kinds = document.createElement('div');
    kinds.className = 'pick';
    for (const k of BOARD_KINDS) kinds.appendChild(this.btn(`${k.icon} ${k.label}`, () => { f.kind = k.id; this.paintJobs(); }, f.kind === k.id ? 'on' : ''));
    const hint = document.createElement('p');
    hint.className = 'note';
    hint.textContent = BOARD_KINDS.find((k) => k.id === f.kind)?.hint ?? '';
    const sel = (label: string, opts: Array<[string, string]>, cur: string, set: (v: string) => void) => {
      const l = document.createElement('label');
      l.textContent = label;
      const s = document.createElement('select');
      for (const [v, t] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === cur) o.selected = true; s.appendChild(o); }
      s.addEventListener('change', () => set(s.value));
      l.appendChild(s);
      return l;
    };
    body.append(
      kinds, hint,
      sel('About', BOARD_SUBJECTS.map((x) => [x.id, x.label]), f.subject, (v) => { f.subject = v as BoardSubjectId; }),
      sel('You pay', BOARD_REWARDS.map((r) => [String(r), `${r} LD`]), String(f.reward), (v) => { f.reward = Number(v); this.paintJobs(); }),
      sel('Finish within', BOARD_DEADLINES_MIN.map((m) => [String(m), `${m} minutes`]), String(f.mins), (v) => { f.mins = Number(v); })
    );
    const full = mineCount >= BOARD_MAX_POSTS;
    const post = this.btn(full ? `You have ${BOARD_MAX_POSTS} jobs posted` : `Post job (hold ${f.reward} LD)`, () => {
      this.send({ t: 'post_job', kind: f.kind, subject: f.subject, reward: f.reward, mins: f.mins });
      this.tab = 'board';
      this.paintJobs();
    }, '', full || this.money < f.reward);
    body.appendChild(post);
    const n = document.createElement('p');
    n.className = 'note';
    n.textContent = `You have ${Math.floor(this.money)} LD. The reward is held until the job is accepted, and you get it back if nobody does it.`;
    body.appendChild(n);
  }

  private paintErrands(body: HTMLElement) {
    const busy = !!this.job;
    const intro = document.createElement('p');
    intro.className = 'note';
    intro.textContent = 'Campus work: small errands from the college office. One at a time, each yours until you finish or run out of time.';
    body.appendChild(intro);
    for (const s of this.slots) {
      const row = document.createElement('div');
      row.className = 'item';
      const tx = document.createElement('div');
      tx.className = 'tx';
      tx.textContent = s.label;
      const sm = document.createElement('small');
      sm.textContent = s.takenBy ? `${s.takenBy} is on it` : `+${s.pay} LD · ${s.secs} seconds`;
      tx.appendChild(sm);
      row.append(tx, this.btn(s.takenBy ? 'Taken' : 'Take it', () => { this.send({ t: 'take_job', slot: s.slot }); this.closeAll(); }, '', !!s.takenBy || busy));
      body.appendChild(row);
    }
    if (busy) {
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = 'You already have an errand. Finish it, or tap its chip to give it back.';
      body.appendChild(note);
    }
  }

  private paintLectern() {
    const body = this.lecternBody;
    body.replaceChildren();
    const sp = this.talk.speaker;
    if (sp && sp.id === this.selfId) {
      const p = document.createElement('p');
      p.textContent = `You are speaking: "${sp.topic}". Type in chat and everyone in the area hears you.`;
      body.append(p, this.btn('Finish my talk', () => { this.send({ t: 'end_talk' }); this.closeAll(); }));
    } else if (sp) {
      const p = document.createElement('p');
      p.textContent = `${sp.name} is speaking: "${sp.topic}". Take a bench and listen, clap, or ask a question. You can go next.`;
      body.appendChild(p);
    } else {
      const p = document.createElement('p');
      p.textContent = 'Pick a topic and speak for up to 90 seconds. People who stay and listen earn a little, and so do you. A talk needs listeners to pay.';
      body.appendChild(p);
      const list = document.createElement('div');
      list.className = 'pick';
      TALK_TOPICS.forEach((t, i) => list.appendChild(this.btn(t, () => { this.send({ t: 'present', topic: i }); this.closeAll(); })));
      body.appendChild(list);
    }
  }

  private paintMarket() {
    this.marketBody.replaceChildren();
    const sale = this.clk?.special?.id === 'market' && this.clk.special.endsAt > this.now() ? 0.5 : 1;
    for (const it of MARKET_ITEMS) {
      const price = Math.max(1, Math.round(it.price * sale));
      const row = document.createElement('div');
      row.className = 'item';
      const tx = document.createElement('div');
      tx.className = 'tx';
      tx.textContent = `${it.icon} ${it.name}`;
      const sm = document.createElement('small');
      sm.textContent = it.desc;
      tx.appendChild(sm);
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = sale < 1 ? `${price} LD (sale!)` : `${price} LD`;
      b.disabled = this.money < price;
      b.addEventListener('click', () => this.send({ t: 'buy', item: it.id }));
      row.append(tx, b);
      this.marketBody.appendChild(row);
    }
  }

  /** Called every frame; repaints a couple of times a second. */
  update() {
    const t = performance.now();
    if (t < this.nextPaint) return;
    this.nextPaint = t + 500;
    this.paint();
  }

  dispose() {
    this.box.remove();
    this.jobsCard.remove();
    this.marketCard.remove();
    this.lecternCard.remove();
    this.style.remove();
  }
}
