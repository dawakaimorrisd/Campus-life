/**
 * Recreation Ground extras: the Sprint Track (a friendly race there and back) and the Carousel.
 * Pure data and rules; the server decides who wins.
 */
const TILE = 32; // same as map.ts (kept local so the two files do not import each other)

// ---- Sprint race: run from the start line to the flag and back
export const RACE_OPEN_MS = 20_000;
export const RACE_COUNTDOWN_MS = 3_000;
export const RACE_MAX_MS = 25_000;
export const RACE_COOLDOWN_MS = 30_000;
/** After the winner finishes, the others get this long to get back. */
export const RACE_GRACE_MS = 8_000;
export const RACE_MIN_RUNNERS = 2;
export const RACE_MAX_RUNNERS = 6;
/** Waiting list for the next race. */
export const RACE_QUEUE_MAX = 12;
/** After a race ends, the next one opens by itself if people are waiting. */
export const RACE_AUTO_OPEN_MS = 12_000;
/** Leaving the start area this far before GO is a false start. */
export const RACE_FALSE_START_PX = 48;
export const RACE_WIN_PAY = 12;
export const RACE_FINISH_PAY = 3;
/** Pixel positions: the start line is the column of tiles x 3..4, the flag is at tile x 17. */
export const RACE_START_X = 5 * TILE;
export const RACE_FLAG_X = 17 * TILE;
export const RACE_Y0 = 14 * TILE;
export const RACE_Y1 = 20 * TILE;

export type RacePhase = 'idle' | 'open' | 'running';
export interface RaceResult { id: string; name: string; place: number; ms: number }
export interface RaceState {
  phase: RacePhase;
  entrants: Array<{ id: string; name: string; turned: boolean; lane: number }>;
  /** Waiting for a place in the next race, in order. */
  queue: Array<{ id: string; name: string }>;
  cap: number;
  /** Who got a false start (they are out). */
  out: string[];
  /** open: the race starts at this time; running: the race ends at this time. */
  startsAt: number;
  endsAt: number;
  results: RaceResult[];
  now: number;
}

// ---- Carousel
export const CAROUSEL_PRICE = 2;
export const CAROUSEL_TIME_MS = 12_000;
export const CAROUSEL_MAX = 6;
export const CAROUSEL_COMPANY_PAY = 3;
export const CAROUSEL_RADIUS = 1.35; // tiles from the centre
export const CAROUSEL_SPIN = 1.1; // radians per second
/** The spin angle at server time t, the same for everybody. */
export const carouselAngle = (nowMs: number) => (nowMs / 1000) * CAROUSEL_SPIN;

export type Team = 'blue' | 'red';

// ---- Football matches
export const FB_TEAM_CAP = 4;
export const FB_MIN_PLAYERS = 2;
export const FB_QUEUE_MAX = 12;
export const FB_LOBBY_MS = 30_000;
export const FB_MATCH_MS = 3 * 60_000;
export const FB_GOALS_TO_WIN = 5;
export const FB_GOAL_PAY = 4;
export const FB_WIN_PAY = 8;
export const FB_DRAW_PAY = 3;
export const FB_LOSE_PAY = 2;
export const FB_COOLDOWN_MS = 15_000;
export type FootballPhase = 'idle' | 'lobby' | 'match';
export interface FootballState {
  phase: FootballPhase;
  blue: Array<{ id: string; name: string }>;
  red: Array<{ id: string; name: string }>;
  queue: Array<{ id: string; name: string }>;
  score: { blue: number; red: number };
  /** lobby: kick-off time; match: full time. */
  startsAt: number;
  endsAt: number;
  cap: number;
  /** The last finished match (shown for a while). */
  last: { blue: number; red: number; winner: Team | null } | null;
  now: number;
}
export interface CarouselState { riders: number; max: number; fare: number }
export interface GamesState { football: FootballState; carousel: CarouselState }
export type GameId = 'football' | 'race' | 'carousel';
export const GAME_IDS: readonly GameId[] = ['football', 'race', 'carousel'];
/** Games can only be joined from here. */
export const GAME_ZONES = ['recreation', 'sprint_track'] as const;
