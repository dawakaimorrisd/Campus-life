/**
 * The campus clock. One shared day on campus, the same for everybody:
 *
 *   Class, Break, Class, Break      the bell rhythm (twice in a row)
 *   Free time (15 min)              earn money: jobs, market, football, stories, friends
 *   Class, Break, Class, Break
 *   Free time (15 min)
 *   Dusk (1 min)                    the campus slowly darkens; everyone is called to the Student Center
 *   Entertainment night (4 min)     the Student Center opens: DJ, dancing, stage
 *   Bedtime (1 min)                 the party ends; a quiet night circle: stories, jokes, good company
 *   Dawn (30 s)                     the sun rises; a recap of your day; then it starts again
 *
 * Darkness lasts 5 minutes (the party plus bedtime). Everything here is data, so a different rhythm is one edit.
 */
import { BREAK_MS, CLASS_MS } from './life';

export type ClockPhase = 'class' | 'break' | 'free' | 'dusk' | 'party' | 'bedtime' | 'dawn';

/**
 * The timing is built around what there is to DO in each part of the day, not around a stopwatch.
 * A class is 5 real minutes (shown on the campus clock as one hour): about a minute of teaching, about three of
 * interaction (a quiz, a quick true-or-false round, practice, a second quiz) and about a minute of assignments.
 * A break is a minute and a half (15 campus minutes): enough to walk to the next room, grab food and chat. Free time is long because that is where
 * errands, matches, races, the Library and friends happen. The campus clock shown to players runs at its own pace
 * inside each part, so "9:15 AM" always means the same part of the day.
 */
export const FREE_LUNCH_MS = 10 * 60_000;
export const FREE_AFTERNOON_MS = 12 * 60_000;
export const FREE_MS = FREE_LUNCH_MS;
export const DUSK_MS = 90_000;
export const PARTY_MS = 6 * 60_000;
export const BEDTIME_MS = 2 * 60_000;
export const DAWN_MS = 45_000;

export interface PlanStep {
  phase: ClockPhase;
  ms: number;
  /** Which lesson of the day (1 to 4) for class and the break after it; 0 otherwise. */
  lesson: 0 | 1 | 2 | 3 | 4;
  /** The campus clock at the start and end of this part, in minutes after midnight (for display only). */
  from: number;
  to: number;
}

const hm = (h: number, m = 0) => h * 60 + m;
export const DAY_PLAN: readonly PlanStep[] = [
  { phase: 'class', ms: CLASS_MS, lesson: 1, from: hm(8), to: hm(9) },
  { phase: 'break', ms: BREAK_MS, lesson: 1, from: hm(9), to: hm(9, 15) },
  { phase: 'class', ms: CLASS_MS, lesson: 2, from: hm(9, 15), to: hm(10, 15) },
  { phase: 'break', ms: BREAK_MS, lesson: 2, from: hm(10, 15), to: hm(10, 30) },
  { phase: 'free', ms: FREE_LUNCH_MS, lesson: 0, from: hm(10, 30), to: hm(12) },
  { phase: 'class', ms: CLASS_MS, lesson: 3, from: hm(12), to: hm(13) },
  { phase: 'break', ms: BREAK_MS, lesson: 3, from: hm(13), to: hm(13, 15) },
  { phase: 'class', ms: CLASS_MS, lesson: 4, from: hm(13, 15), to: hm(14, 15) },
  { phase: 'break', ms: BREAK_MS, lesson: 4, from: hm(14, 15), to: hm(14, 30) },
  { phase: 'free', ms: FREE_AFTERNOON_MS, lesson: 0, from: hm(14, 30), to: hm(17) },
  { phase: 'dusk', ms: DUSK_MS, lesson: 0, from: hm(17), to: hm(18) },
  { phase: 'party', ms: PARTY_MS, lesson: 0, from: hm(18), to: hm(21) },
  { phase: 'bedtime', ms: BEDTIME_MS, lesson: 0, from: hm(21), to: hm(22) },
  { phase: 'dawn', ms: DAWN_MS, lesson: 0, from: hm(7, 30), to: hm(8) }
];

/** "9:15 AM" from minutes after midnight. */
export function formatCampusTime(min: number): string {
  const m = Math.round(((min % 1440) + 1440) % 1440);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** The phases when it is light and students are on their daily routine. */
export const DAYTIME: readonly ClockPhase[] = ['class', 'break', 'free'];

/** A short-lived bonus during free time, to give the long stretches a pulse. */
export type SpecialId = 'jobs' | 'goals' | 'stories' | 'market';
export interface SpecialDef {
  id: SpecialId;
  label: string;
  /** Shown to everybody when it starts. */
  banner: string;
  /** Pay multiplier (market: price multiplier). */
  mult: number;
}
export const SPECIALS: readonly SpecialDef[] = [
  { id: 'jobs', label: 'Double pay on errands', banner: 'Jobs board bonus: errands pay DOUBLE for 90 seconds!', mult: 2 },
  { id: 'goals', label: 'Goals pay double', banner: 'Match day! Goals on the Recreation Ground pay DOUBLE for 90 seconds!', mult: 2 },
  { id: 'stories', label: 'Story time bonus', banner: 'Story time! Stories, jokes and good company pay DOUBLE for 90 seconds!', mult: 2 },
  { id: 'market', label: 'Market sale: half price', banner: 'Market sale! Everything at the stall is HALF PRICE for 90 seconds!', mult: 0.5 }
];
export const SPECIAL_MS = 90_000;
/** A new special every so often during free time. */
export const SPECIAL_EVERY_MS: [number, number] = [2.5 * 60_000, 4 * 60_000];

export interface ClockState {
  phase: ClockPhase;
  lesson: number;
  /** 0-based number of this day on this server. */
  day: number;
  now: number;
  startsAt: number;
  endsAt: number;
  /** When today began, and how long the lit part of the day (class, break, free) lasts, so every phone paints the same sky. */
  dayStartAt: number;
  activeMs: number;
  special: { id: SpecialId; label: string; endsAt: number } | null;
  /** The campus clock at the start and end of this part (minutes after midnight), so every phone can show the time. */
  clockFrom: number;
  clockTo: number;
}

/** Where we are in the sun's journey (0 dawn, about 0.35 noon, 0.62 golden hour, 0.76 night, back to 1.0 = dawn). */
export function skyPhase(c: ClockState, nowMs: number): number {
  const frac = (a: number, b: number) => (b > a ? Math.min(1, Math.max(0, (nowMs - a) / (b - a))) : 0);
  switch (c.phase) {
    case 'dusk': return 0.6 + 0.16 * frac(c.startsAt, c.endsAt);
    case 'party': return 0.76 + 0.1 * frac(c.startsAt, c.endsAt);
    case 'bedtime': return 0.86 + 0.06 * frac(c.startsAt, c.endsAt);
    case 'dawn': return 0.92 + 0.08 * frac(c.startsAt, c.endsAt);
    default: return 0.6 * Math.min(1, Math.max(0, (nowMs - c.dayStartAt) / (c.activeMs || 1)));
  }
}
