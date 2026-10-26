/**
 * Everyday campus life (Phases E to H): classes with a bell, the jobs board, the Marketplace, the football
 * ball, and the weather. Shared so the server decides and every phone draws the same thing.
 */
import type { ZoneId } from './map';

// ---------------------------------------------------------------- classes (Phase E)
/** A class is 5 real minutes and a break is 1.5 minutes. See clock.ts for the whole day. */
export const CLASS_MS = 300_000;
export const BREAK_MS = 90_000;
/** Arriving later than this after the bell counts as late (an instructor's mood can change it). */
export const LATE_AFTER_MS = 25_000;

/**
 * What happens inside a class, as shares of its length (about 1 minute of teaching, 3 of interaction, 1 of
 * assignments). Nothing is dead air: every part has something to do and ends when that thing is done.
 */
export type ClassSegmentId = 'settle' | 'lesson1' | 'quiz1' | 'discuss' | 'quick' | 'practice' | 'quiz2' | 'review' | 'wrapup';
export interface ClassSegment { id: ClassSegmentId; at: number; label: string; icon: string; what: string }
export const CLASS_SEGMENTS: readonly ClassSegment[] = [
  { id: 'settle', at: 0, label: 'Roll call', icon: '📋', what: 'Get to your seat. Attendance is taken.' },
  { id: 'lesson1', at: 0.05, label: 'Teaching', icon: '📖', what: 'The instructor teaches the lesson.' },
  { id: 'quiz1', at: 0.2, label: 'Quiz 1', icon: '🙋', what: 'A question for the room. Answer on your screen.' },
  { id: 'discuss', at: 0.28, label: 'Discussion', icon: '💬', what: 'The instructor goes over the answer. Talk with your neighbours.' },
  { id: 'quick', at: 0.34, label: 'Quick round', icon: '⚡', what: 'Three fast true-or-false questions.' },
  { id: 'practice', at: 0.52, label: 'Practice', icon: '✏️', what: 'Work through an example with the instructor.' },
  { id: 'quiz2', at: 0.6, label: 'Quiz 2', icon: '🙋', what: 'A harder question for the room.' },
  { id: 'review', at: 0.68, label: 'Review', icon: '🔁', what: 'The instructor sums up the lesson.' },
  { id: 'wrapup', at: 0.8, label: 'Assignments', icon: '📝', what: 'Assignments are collected, and new ones are given.' }
];
/** Which part of the class we are in, from how far through it is (0 to 1). */
export const classSegmentAt = (frac: number): ClassSegment => {
  let cur = CLASS_SEGMENTS[0];
  for (const s of CLASS_SEGMENTS) if (frac >= s.at) cur = s;
  return cur;
};
/** When the instructor collects the assignments (share of the class). */
export const COLLECT_AT = 0.8;
/** What the instructor says in each part. */
export const SEGMENT_LINES: Partial<Record<ClassSegmentId, readonly string[]>> = {
  settle: ['Good morning, class. Settle down. Roll call.', 'Take your seats, please. I am calling the roll.', 'Quiet, everyone. Let us begin.'],
  discuss: ['Talk to your neighbour. Why is that the answer?', 'Who got it right? Tell us how you knew.', 'Good thinking. Let us go through it.'],
  quick: ['Quick round! True or false. Be fast.', 'Three quick ones. Keep up, class.'],
  practice: ['Now let us try an example together.', 'Watch the board. I will do one, then you try.', 'Write this down. We will use it later.'],
  review: ['To sum up today: remember the main points.', 'Let us review what we covered.', 'If you are unsure, ask me after class.'],
  wrapup: ['Assignments, please. I am collecting them now.', 'Hand in your work. New assignments are on the board.', 'That is all for today. Check your assignment.']
};
/** You must be in class for at least this share of the lesson to be marked present. */
export const ATTEND_FRAC = 0.5;
export const ATTEND_PAY = 8;
export const LATE_PAY = 4;
/** Rooms where a lesson happens (the Library is a study place, not a class). */
export const CLASS_ROOMS: readonly ZoneId[] = ['student_hall', 'college_cj', 'college_nursing', 'college_business', 'college_agri', 'college_education'];

export const LECTURE_LINES: Record<string, readonly string[]> = {
  student_hall: ['Open your notes. Today is general studies.', 'Who can tell me why we study history?', 'Quiet at the back, please.'],
  college_cj: ['A witness statement must be written exactly as given.', 'Chain of custody. Say it with me.', 'Law without order is only paper.'],
  college_nursing: ['Wash your hands before and after. Always.', 'A good midwife listens first.', 'Check the pulse. Count with me.'],
  college_business: ['Revenue minus cost is profit. Write that down.', 'A budget is a promise to yourself.', 'Public service means the public comes first.'],
  college_agri: ['Rice needs water, but not too much.', 'Good soil is the farmer\'s bank.', 'Cassava, plantain, pepper: who grows what?'],
  college_education: ['Teaching is learning twice.', 'Every child can learn. Find the way.', 'Plan the lesson, then teach the lesson.']
};
export const BREAK_LINES = ['Break time! Go and eat something.', 'Class is over. See you at the Palaver Hut.'];

// ---------------------------------------------------------------- jobs board (Phase F)
export interface JobDef {
  id: string;
  label: string;
  to: ZoneId;
  pay: number;
  /** Seconds you have to get there. */
  secs: number;
}
export const JOBS: readonly JobDef[] = [
  { id: 'chalk', label: 'Take chalk to the College of Education', to: 'college_education', pay: 25, secs: 100 },
  { id: 'forms', label: 'Deliver forms to the Administrative Hall', to: 'admin_hall', pay: 15, secs: 70 },
  { id: 'tea', label: 'Carry tea to the Back Palaver', to: 'back_palaver', pay: 14, secs: 70 },
  { id: 'notes', label: 'Return lecture notes to the Library', to: 'library', pay: 22, secs: 90 },
  { id: 'flyers', label: 'Pin flyers at the Student Center', to: 'student_center', pay: 14, secs: 70 },
  { id: 'water', label: 'Bring water to the Palaver Hut', to: 'palaver_hut', pay: 12, secs: 60 },
  { id: 'files', label: 'Files for the College of Criminal Justice', to: 'college_cj', pay: 24, secs: 100 },
  { id: 'kit', label: 'First aid kit for Nursing and Midwifery', to: 'college_nursing', pay: 24, secs: 100 },
  { id: 'seeds', label: 'Seed packets for the College of Agriculture', to: 'college_agri', pay: 24, secs: 100 },
  { id: 'ledgers', label: 'Ledgers for Business and Public Administration', to: 'college_business', pay: 24, secs: 100 },
  { id: 'ball', label: 'Take the match ball to the Recreation Ground', to: 'recreation', pay: 16, secs: 80 },
  { id: 'stool', label: 'Carry a stool to the Social Ground', to: 'social_ground', pay: 16, secs: 80 }
];
export const JOB_SLOTS = 3;
export interface JobSlot {
  slot: number;
  id: string;
  label: string;
  pay: number;
  secs: number;
  /** Name of the student doing this job right now. */
  takenBy: string | null;
}
export interface ActiveJob {
  label: string;
  to: ZoneId;
  pay: number;
  endsAt: number;
  now: number;
}

// ---------------------------------------------------------------- marketplace (Phase F)
export type MarketItemId = 'drink' | 'bracelet' | 'charm';
export interface MarketItem {
  id: MarketItemId;
  name: string;
  icon: string;
  price: number;
  desc: string;
  /** How long the effect lasts. */
  ms: number;
}
export const MARKET_ITEMS: readonly MarketItem[] = [
  { id: 'drink', name: 'Energy drink', icon: '🥤', price: 8, desc: 'Walk faster for 40 seconds.', ms: 40_000 },
  { id: 'bracelet', name: 'Glow bracelet', icon: '✨', price: 10, desc: 'You glow, and your dancing counts double at parties. 3 minutes.', ms: 180_000 },
  { id: 'charm', name: 'Lucky charm', icon: '🍀', price: 15, desc: 'Better odds of sneaking past a guard. 5 minutes.', ms: 300_000 }
];
export const DRINK_SPEED = 1.5;
export const CHARM_SNEAK_BONUS = 0.25;

// ---------------------------------------------------------------- football (Phase G)
export const BALL_FRICTION = 1.5;
export const BALL_RADIUS = 9;
export const KICK_SPEED = 640;
export const NUDGE_SPEED = 250;
export const KICK_RANGE = 70;
export const NUDGE_RANGE = 34;
export const GOAL_PAY = 5;
export const GOAL_RESTART_MS = 3500;

export interface BallState {
  /** Position (px), velocity (px/s) and the server time they were true. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  at: number;
  now: number;
  /** A goal was just scored: who, so the crowd can cheer. */
  goalBy: string | null;
}

// ---------------------------------------------------------------- weather and day cycle (Phase H)
export type WeatherKind = 'clear' | 'cloudy' | 'rain';
/** One full day on campus lasts this long in real time. */
export const DAY_MS = 14 * 60_000;
export interface WeatherState {
  kind: WeatherKind;
  now: number;
  endsAt: number;
  /** Server time when the day last began, so every phone shows the same hour. */
  dayStartAt: number;
}
