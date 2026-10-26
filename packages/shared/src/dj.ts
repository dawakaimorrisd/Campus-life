/**
 * The Student Center DJ. The server decides which track plays and when; every client synthesises that same
 * track locally, so nobody downloads music and there are no rights to worry about.
 */

/** Every track slot lasts 15 seconds, then the DJ picks again. */
export const TRACK_MS = 15000;

export interface Track {
  id: number;
  name: string;
  /** Beats per minute; also drives the lights. */
  bpm: number;
  /** What the DJ says when this one comes on. */
  intro: string;
}

export const TRACKS: readonly Track[] = [
  { id: 0, name: 'Afrobeat', bpm: 108, intro: 'Afrobeat! Move your body!' },
  { id: 1, name: 'Highlife', bpm: 118, intro: 'Highlife, the old school way!' },
  { id: 2, name: 'Hipco', bpm: 94, intro: 'Hipco time, say it loud!' },
  { id: 3, name: 'Amapiano', bpm: 112, intro: 'Log drum! Amapiano!' },
  { id: 4, name: 'Reggae', bpm: 78, intro: 'Easy now, reggae vibes.' },
  { id: 5, name: 'Gospel House', bpm: 124, intro: 'Hands up! Gospel house!' }
];

export const DJ_OPEN_LINES = ['Student Center is OPEN! Come dance!', 'We are live! Who is in the building?!'];
export const DJ_CLOSE_LINES = ['That was the last one. Thank you, BCC!', 'Party is over. Walk safe, everybody!'];
export const DJ_HYPE_LINES = ['The floor is FULL! Make some noise!', 'Look at this crowd! Yes!', 'Nobody sits down, nobody!'];
export const DJ_EMPTY_LINES = ['Come on, the floor is waiting for you!', 'Do not be shy, come dance!'];

/** What the server tells clients about the DJ (sent on every change, and to anyone who joins). */
export interface DjState {
  /** Is the party on? */
  on: boolean;
  /** Index into TRACKS (meaningful while `on`). */
  track: number;
  bpm: number;
  /** Server time (ms) when the current track started, and the server's clock right now, so clients can sync. */
  startedAt: number;
  now: number;
  trackMs: number;
  /** When the party ends (ms), 0 if off. */
  endsAt: number;
  /** When the next party opens (ms), 0 if unknown. */
  nextAt: number;
  /** How alive the floor is, 0 to 1. */
  energy: number;
  /** A line for the DJ to say right now, if any. */
  shout: string | null;
}
