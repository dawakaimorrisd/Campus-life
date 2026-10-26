/**
 * Academics: your college, your grade point average, the instructor's mood and assignments.
 * Everything is data so it can be tuned in one place. Grades only come from what you do in class and in the Library:
 * paid help on the Jobs Board never changes them.
 */
import type { ZoneId } from './map';

export type CollegeId = 'cj' | 'nursing' | 'business' | 'agri' | 'education';

export interface College {
  id: CollegeId;
  name: string;
  short: string;
  icon: string;
  /** The classroom that is your home room (a small bonus for attending there). */
  room: ZoneId;
}

export const COLLEGES: readonly College[] = [
  { id: 'cj', name: 'College of Criminal Justice', short: 'Criminal Justice', icon: '⚖️', room: 'college_cj' },
  { id: 'nursing', name: 'College of Nursing and Midwifery', short: 'Nursing', icon: '🩺', room: 'college_nursing' },
  { id: 'business', name: 'College of Business and Public Administration', short: 'Business', icon: '📊', room: 'college_business' },
  { id: 'agri', name: 'College of Agriculture', short: 'Agriculture', icon: '🌾', room: 'college_agri' },
  { id: 'education', name: 'College of Education', short: 'Education', icon: '🍎', room: 'college_education' }
];

export const collegeOf = (id: CollegeId | null | undefined) => COLLEGES.find((c) => c.id === id) ?? null;
export const isCollegeId = (s: unknown): s is CollegeId => COLLEGES.some((c) => c.id === s);

// ---- grades
/** Your GPA is the average of your last marks (0 to 4). */
export const GPA_WINDOW = 12;
export const MARK_ON_TIME = 4;
export const MARK_LATE = 3;
export const MARK_LEFT_EARLY = 2;
export const MARK_ABSENT = 0;
export const MARK_ASSIGNMENT_DONE = 4;
export const MARK_ASSIGNMENT_MISSED = 0;

export const gpaOf = (marks: readonly number[]): number | null => {
  const m = marks.slice(-GPA_WINDOW);
  if (!m.length) return null;
  return Math.round((m.reduce((a, b) => a + b, 0) / m.length) * 10) / 10;
};

export type Standing = "Dean's List" | 'Good standing' | 'Fair' | 'Warning' | 'New student';
export const standingOf = (gpa: number | null): Standing => {
  if (gpa === null) return 'New student';
  if (gpa >= 3.5) return "Dean's List";
  if (gpa >= 2.5) return 'Good standing';
  if (gpa >= 1.5) return 'Fair';
  return 'Warning';
};
/** Dean's List students are paid a little extra for every class they attend. */
export const DEANS_LIST_BONUS = 2;
export const HOME_ROOM_BONUS = 3;

// ---- years, terms and graduation
/** A student needs this many years of passed terms to graduate. */
export const YEARS = 4;
/** Classes in one term (one year). Four classes a day, so two campus days (about an hour and three quarters of play). The server can change it for quick tests. */
export const TERM_LESSONS = 8;
/** To pass a term: a term GPA of at least this... */
export const PASS_GPA = 2.0;
/** ...and being present for at least this share of the term's classes. */
export const PASS_ATTEND = 0.6;
export const HONORS_GPA = 3.5;
export const PROMOTION_PAY_PER_YEAR = 25;
export const GRADUATION_PAY = 150;
export const yearLabel = (y: number) => (y > YEARS ? 'Graduate' : `Year ${y}`);

// ---- instructors
export type Mood = 'cheerful' | 'strict' | 'relaxed' | 'inspired';
export interface MoodDef {
  label: string;
  icon: string;
  /** What it means for students, in plain words. */
  note: string;
  /** How long after the bell you are still on time. */
  lateAfterMs: number;
  /** Extra LD for everyone marked present. */
  bonus: number;
  /** Extra LD for finishing the assignment this lesson hands out. */
  assignBonus: number;
  lines: readonly string[];
}
export const MOODS: Record<Mood, MoodDef> = {
  cheerful: { label: 'Cheerful', icon: '😄', note: 'Everyone present earns a little extra.', lateAfterMs: 25_000, bonus: 2, assignBonus: 0, lines: ['What a lovely day to learn!', 'Smiles, everyone. Now, open your notes.', 'You are doing well. Keep going.'] },
  strict: { label: 'Strict', icon: '😠', note: 'Be on time: late comes sooner today.', lateAfterMs: 12_000, bonus: 0, assignBonus: 0, lines: ['Late is late. Sit down.', 'No talking while I teach.', 'Eyes on the board.'] },
  relaxed: { label: 'Relaxed', icon: '😌', note: 'There is more time to arrive before you count as late.', lateAfterMs: 50_000, bonus: 0, assignBonus: 0, lines: ['Take your time, there is no rush.', 'Settle in. We will begin shortly.', 'Questions are welcome today.'] },
  inspired: { label: 'Inspired', icon: '💡', note: 'The assignment pays more today.', lateAfterMs: 25_000, bonus: 0, assignBonus: 5, lines: ['Today you will build something real.', 'Think big, then write it down.', 'I have a good assignment for you.'] }
};
export const MOOD_IDS = Object.keys(MOODS) as Mood[];

// ---- assignments and the Library
export const ASSIGN_PAY = 10;
/** An assignment is due by the end of the next class, but never sooner than 4 minutes or later than 10. */
export const ASSIGN_MIN_MS = 4 * 60_000;
export const ASSIGN_MAX_MS = 10 * 60_000;
export const ASSIGN_WARN_MS = 90_000;
export const STUDY_TIME_MS = 12_000;
export const STUDY_COOLDOWN_MS = 30_000;
export const STUDY_PAY = 3;
export const READ_TIME_MS = 10_000;
export const READ_COOLDOWN_MS = 60_000;
export const READ_PAY = 4;
/** More than this many chat lines in 10 seconds inside the Library earns a shush. */
export const QUIET_LIMIT = 3;
export const QUIET_WINDOW_MS = 10_000;

export const ASSIGNMENT_TITLES: Record<CollegeId, readonly string[]> = {
  cj: ['Write a witness statement', 'Summarise the chain of custody', 'Case notes: a market dispute'],
  nursing: ['Chart a patient visit', 'Write a hygiene checklist', 'Midwifery case notes'],
  business: ['Draft a small budget', 'Write a one-page business plan', 'Public service report'],
  agri: ['Plan a rice field', 'Soil notes for cassava', 'Write a planting calendar'],
  education: ['Plan a short lesson', 'Write a classroom rule list', 'Teaching reflection']
};
export const GENERAL_ASSIGNMENT_TITLES = ['Study notes', 'A page on today\'s lesson', 'Reading summary'];

export interface AssignmentInfo {
  title: string;
  dueAt: number;
  reward: number;
}

export interface AcademicState {
  college: CollegeId | null;
  /** 1 to YEARS while studying, YEARS + 1 once graduated. */
  year: number;
  /** Classes done this term, and how many the term has. */
  termLessons: number;
  termTarget: number;
  /** Average of this term's marks (null before the first). */
  termGpa: number | null;
  /** Classes attended this term and how many are needed to pass. */
  termAttended: number;
  needAttended: number;
  /** Set once graduated. */
  graduated: { honors: boolean } | null;
  gpa: number | null;
  standing: Standing;
  marks: number;
  mood: Mood | null;
  /** Lessons finished today (0 to 4), for the timetable. */
  lessonsDone: number;
  assignment: AssignmentInfo | null;
  now: number;
}

/** What is saved for a student between visits. */
export interface AcademicRecord {
  college: CollegeId | null;
  marks: number[];
  year?: number;
  termLessons?: number;
  termN?: number;
  termSum?: number;
  termAttended?: number;
  cumN?: number;
  cumSum?: number;
  graduated?: { honors: boolean } | null;
}
