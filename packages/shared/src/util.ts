import type { EmoteKind, HelpKind } from './protocol';
import type { Vec, ZoneId } from './map';

export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Stable 0..1 value from a string (gives each follower their own spot). */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export const QUICK_PHRASES = ['Yo', 'Bro', 'Come', 'Wait', 'Where you going?', "Let's go", "I'm coming", 'What happened?', '😂'] as const;

export const EMOTE_ICONS: Record<EmoteKind, string> = {
  wave: '👋', laugh: '😂', point: '👉', clap: '👏', dance: '💃', shake: '🙅', think: '🤔'
};
export const EMOTE_LABELS: Record<EmoteKind, string> = {
  wave: 'Wave', laugh: 'Laugh', point: 'Point', clap: 'Clap', dance: 'Dance', shake: 'No way', think: 'Hmm'
};
export const HELP_LABELS: Record<HelpKind, string> = {
  assignment: 'an assignment',
  find: 'finding something'
};

/** Short names used in invites and notices ("Come to the Library"). */
export const PLACE_NAMES: Record<ZoneId | 'here', string> = {
  agri_office: 'the Dept of Agriculture',
  admin_hall: 'the Administrative Hall',
  admin_hallway: 'the Admin Hallway',
  student_hall: 'the Student Hall',
  staircase: 'the staircase',
  student_center: 'the Student Center',
  classroom_a: 'Classroom 1',
  classroom_b: 'Classroom 2',
  upstairs_corridor: 'the upstairs corridor',
  library: 'the Library',
  palaver_hut: 'the Palaver Hut',
  back_palaver: 'the Back Palaver',
  here: 'where they are'
};

/** The places people actually invite each other to. */
export const INVITE_PLACES: ReadonlyArray<ZoneId | 'here'> = [
  'here', 'palaver_hut', 'back_palaver', 'student_center', 'student_hall', 'library', 'classroom_a', 'admin_hall'
];
