/**
 * The Campus Jobs Board (blueprint section 9). Students post small paid jobs for each other; another student claims
 * one, does it, hands it in in person, and the poster accepts. The money is held (escrow) from the moment a job is
 * posted until it is paid out or handed back, so it can never be spent twice or paid twice.
 *
 * Paid help is a favour between students. It never changes anybody's grades or academic record.
 */
export type BoardKind = 'assignment' | 'notes' | 'presentation' | 'research' | 'errand' | 'lost';

export interface BoardKindDef {
  id: BoardKind;
  label: string;
  icon: string;
  /** What the worker is expected to do, in plain words. */
  hint: string;
}
export const BOARD_KINDS: readonly BoardKindDef[] = [
  { id: 'assignment', label: 'Assignment help', icon: '📝', hint: 'Sit with the poster and help them understand the assignment.' },
  { id: 'notes', label: 'Lecture notes', icon: '📓', hint: 'Share your notes with the poster.' },
  { id: 'presentation', label: 'Presentation prep', icon: '🎤', hint: 'Help the poster prepare a short talk.' },
  { id: 'research', label: 'Research help', icon: '🔎', hint: 'Help the poster find answers, for example in the Library.' },
  { id: 'errand', label: 'Run an errand', icon: '🏃', hint: 'Fetch or carry something for the poster.' },
  { id: 'lost', label: 'Find a lost item', icon: '🎒', hint: 'Look around campus and bring the poster their lost item.' }
];

export type BoardSubjectId = 'college_cj' | 'college_nursing' | 'college_business' | 'college_agri' | 'college_education' | 'library' | 'campus';
export const BOARD_SUBJECTS: ReadonlyArray<{ id: BoardSubjectId; label: string }> = [
  { id: 'college_cj', label: 'Criminal Justice' },
  { id: 'college_nursing', label: 'Nursing and Midwifery' },
  { id: 'college_business', label: 'Business and Public Administration' },
  { id: 'college_agri', label: 'Agriculture' },
  { id: 'college_education', label: 'Education' },
  { id: 'library', label: 'Library' },
  { id: 'campus', label: 'Around campus' }
];

export const BOARD_REWARDS = [10, 15, 20, 30, 40, 60] as const;
export const BOARD_DEADLINES_MIN = [3, 5, 10] as const;

/** At most this many open jobs on the board, and this many a student may have posted at once. */
export const BOARD_MAX_JOBS = 12;
export const BOARD_MAX_POSTS = 2;
export const BOARD_POST_COOLDOWN_MS = 15_000;
/** The worker hands the job in face to face: within this many pixels of the poster. */
export const BOARD_HAND_IN_RANGE = 200;
/** If the poster does not answer a hand-in for this long, it is accepted automatically so workers are protected. */
export const BOARD_AUTO_ACCEPT_MS = 90_000;

export type BoardState = 'available' | 'claimed' | 'submitted';
export type BoardAct = 'claim' | 'release' | 'submit' | 'accept' | 'cancel';

export interface BoardJob {
  id: number;
  kind: BoardKind;
  subject: BoardSubjectId;
  reward: number;
  state: BoardState;
  posterId: string;
  posterName: string;
  workerId: string | null;
  workerName: string | null;
  /** Server time by which the job must be finished. */
  deadline: number;
  /** Server time when a hand-in is accepted automatically (0 until handed in). */
  acceptBy: number;
}

export const boardTitle = (j: Pick<BoardJob, 'kind' | 'subject'>): string => {
  const k = BOARD_KINDS.find((x) => x.id === j.kind);
  const s = BOARD_SUBJECTS.find((x) => x.id === j.subject);
  return `${k?.icon ?? ''} ${k?.label ?? 'Job'} · ${s?.label ?? ''}`.trim();
};

/** What the person looking at this job should do next, in plain words. */
export function boardNext(j: BoardJob, me: string): string {
  const poster = j.posterId === me;
  const worker = j.workerId === me;
  switch (j.state) {
    case 'available': return poster ? 'Waiting for someone to claim it.' : 'Open. Claim it to start.';
    case 'claimed':
      return poster ? `${j.workerName ?? 'Someone'} is on it. Wait for them to come and hand it in.` : worker ? `Find ${j.posterName} and hand it in when you are close.` : `${j.workerName ?? 'Someone'} claimed it.`;
    case 'submitted':
      return poster ? `${j.workerName ?? 'Someone'} handed it in. Accept to pay them.` : worker ? `Handed in. ${j.posterName} will accept it soon.` : 'Handed in.';
  }
}
