/**
 * The Student Lecture and Presentation Area (blueprint section 14): a lectern on a small platform with benches
 * facing it. A student gives a short talk, others listen, clap, ask questions, and talk afterwards. Taking part is
 * always optional, and listening is free.
 */
export const TALK_TOPICS: readonly string[] = [
  'How I study and stay focused',
  'Why I chose my college',
  'A funny thing that happened on campus',
  'My hometown and its people',
  'A business idea for the campus',
  'Farming tips that really work',
  'How to stay healthy as a student',
  'The music I love and why',
  'My football tactics',
  'What I learned in the Library',
  'Being new on campus',
  'Something I am proud of'
];
export const TALK_MAX_MS = 90_000;
export const TALK_MIN_MS = 15_000;
export const TALK_COOLDOWN_MS = 150_000;
/** A listener must stay in the lecture area for at least this share of the talk to count. */
export const TALK_LISTEN_FRAC = 0.5;
export const TALK_SPEAKER_PAY_EACH = 4;
export const TALK_SPEAKER_MAX_LISTENERS = 6;
export const TALK_LISTENER_PAY = 3;
export const TALK_CLAP_PAY = 2;
export const TALK_MAX_CLAPS = 6;
export const TALK_QUESTION_MAX = 3;
export const TALK_ANSWER_WINDOW_MS = 30_000;
export const TALK_QUESTION_ASKER_PAY = 2;
export const TALK_QUESTION_ANSWER_PAY = 3;
/** How far a speaker's voice carries at the lectern (pixels). */
export const TALK_VOICE_RANGE = 420;

export interface TalkState {
  /** The speaker right now, or null when the lectern is free. */
  speaker: { id: string; name: string; topic: string; endsAt: number; listeners: number; questions: number } | null;
  now: number;
}
