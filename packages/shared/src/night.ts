/**
 * Event nights at the Student Center (Phase D).
 *
 * Three separate permissions, all checked by the server:
 *  - ENTRY: pay the guard at the door, or try to sneak past him.
 *  - AUDIENCE: once inside, watching, talking and dancing on the floor are free.
 *  - STAGE: a singer or dancer package plus a reserved slot (a few per night, 30 seconds each).
 */

export type NightPhase = 'off' | 'announced' | 'open' | 'closing';
export type PerformerKind = 'singer' | 'dancer';

export const ENTRY_FEE = 30;
export const PACKAGE_PRICE: Record<PerformerKind, number> = { singer: 45, dancer: 35 };
export const SLOT_COUNT = 4;
export const SLOT_MS = 30_000;
/** How long people get a warning before the doors open, and before the party ends. */
export const ANNOUNCE_MS = 45_000;
export const CLOSING_MS = 30_000;
/** First slot starts this long after opening, so people can arrive and buy a package first. */
export const FIRST_SLOT_DELAY_MS = 30_000;
/** Each cheer from the crowd during a slot adds this much to the performer's pay (up to CHEER_CAP cheers). */
export const CHEER_PAY = 5;
export const CHEER_CAP = 12;
/** Sneaking past the guard: chance of success, and how long you must wait after being caught. */
export const SNEAK_CHANCE = 0.35;
export const SNEAK_LOCKOUT_MS = 20_000;

export const GUARD_ENTRY_LINES = [
  'Ticket please. Entry is tonight only.',
  'Hold on, my friend. Entry fee first.',
  'No ticket, no entry. Simple.'
];
export const GUARD_CAUGHT_LINES = ['Ah-ah! I see you. Go back!', 'Not so fast! Come and pay.', 'You think I am sleeping? Pay!'];
export const GUARD_LET_IN_LINES = ['Go on. Enjoy yourself.', 'Okay, welcome. Behave yourself inside.'];

export interface NightSlot {
  /** 0-based order on the night. */
  i: number;
  startsAt: number;
  endsAt: number;
  /** Who booked it (null while free), what they are doing, and their name for the board. */
  kind: PerformerKind | null;
  name: string | null;
  /** Booked by this id (so a client can tell which slot is theirs). */
  by: string | null;
}

/** What the server tells everybody about the night, on every change and to anyone who joins. */
export interface NightState {
  phase: NightPhase;
  /** Server time now (for clock sync). */
  now: number;
  /** When the doors open (0 if unknown) and when the night ends (0 if not running). */
  opensAt: number;
  closesAt: number;
  fee: number;
  prices: Record<PerformerKind, number>;
  slots: NightSlot[];
  /** Who is on stage right now, if anyone. */
  onStage: { name: string; kind: PerformerKind; endsAt: number } | null;
}
