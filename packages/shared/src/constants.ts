// ---------- simulation ----------
export const TICK_RATE = 20;
export const PLAYER_SPEED = 150;
export const DEFAULT_SERVER_PORT = 8080;

// ---------- identity ----------
export const MAX_NAME_LENGTH = 16;
export const START_MONEY = 100;

// ---------- distances (world pixels; 1 tile = 32px) ----------
export const HEAR_RANGE = 320;
export const HEAR_RANGE_MUFFLED = 140;
export const EMOTE_RANGE = 640;
export const INTERACT_RANGE = 96;
export const MISCHIEF_RANGE = 80;
export const FOLLOW_RANGE = 480;
export const FOLLOW_GIVEUP = 900;
export const FOLLOW_GAP = 52;
export const INVITE_RANGE = 640;
export const JOIN_RANGE = 640;
export const SIT_MAX_DIST = 480;
export const HELP_KEEP_RANGE = 130;
export const SEAT_HINT_RANGE = 160;
/** Anyone this close (and on the same level) shows up in "nearby". */
export const NEARBY_RANGE = 360;

// ---------- talk ----------
export const CHAT_MAX = 120;
export const CHAT_BURST = 6;
export const CHAT_WINDOW_MS = 8000;
export const EMOTE_COOLDOWN_MS = 700;

// ---------- social verbs ----------
export const INVITE_TTL_MS = 20_000;
export const MAX_FOLLOWERS = 6;
export const EAT_TIME_MS = 8000;
export const HELP_TIME_MS = 7000;
export const HELP_ASK_TTL_MS = 60_000;
export const HELP_REWARD = 15;
export const HELP_PAIR_COOLDOWN_MS = 5 * 60_000;
export const HELP_FAR_GRACE_MS = 4000;
export const FOOD_COOLDOWN_MS = 8000;
export const FOOD_PRICE = 10;
export const GIVE_MAX = 500;
export const GIVE_AMOUNTS = [10, 50, 100] as const;
export const STEAL_COOLDOWN_MS = 20_000;
export const STEAL_VICTIM_COOLDOWN_MS = 90_000;
export const STOLEN_HOT_MS = 60_000;
export const PRANK_PAIR_COOLDOWN_MS = 15_000;
export const MISCHIEF_SHIELD_MS = 10_000;

// ---------- groups (Phase 5) ----------
/** People this close (px) belong to the same cluster. */
export const GROUP_LINK = 120;
/** A cluster this big shows up as a visible gathering. */
export const GROUP_MIN = 3;
export const GROUP_MAX_PAIRS = 8;
export const INVITE_ALL_RANGE = 320;
export const INVITE_ALL_MAX = 8;

// ---------- campus events (Phase 6) ----------
export const EVENT_TICK_MS = 1000;
export const EVENT_GLOBAL_GAP_MS = 8000;
export const GATHERING_MIN = 4;
export const GATHERING_AGE_MS = 8000;
export const GATHERING_COOLDOWN_MS = 120_000;
export const SITTING_TOGETHER_MS = 45_000;
export const GROUP_LEFT_DISTANCE = 240;
export const EVENT_NEAR_RANGE = 380;
export const EVENT_MARKER_MS = 45_000;

// ---------- money, jobs, spots (Phase 7) ----------
export const MUSIC_PRICE = 15;
export const MUSIC_COOLDOWN_MS = 90_000;
export const MUSIC_RANGE = 420;
export const MOTO_PRICE = 5;
export const MOTO_TIME_MS = 12_000;
export const MOTO_SPEED = 2.2;
export const WORK_TIME_MS = 8000;
export const WORK_PAY = 8;
export const WORK_COOLDOWN_MS = 45_000;
export const SPOT_REACH = 56;

// ---------- mischief consequences (Phase 8) ----------
export const CHASE_BOOST = 1.2;
export const CHASE_BOOST_MS = 8000;
export const REPEAT_THIEF_LIMIT = 3;
export const REPEAT_THIEF_WINDOW_MS = 10 * 60_000;
export const REPEAT_THIEF_LOCK_MS = 3 * 60_000;
export const ESCAPE_COOLDOWN_MS = 60_000;
export const ESCAPE_WINDOW_MS = 15_000;
export const SNEAK_MS = 6000;

// ---------- social memory + buzz (Phases 9, 10) ----------
export const TOGETHER_SAMPLE_MS = 30_000;
export const TOGETHER_PAIR_COOLDOWN_MS = 5 * 60_000;
export const MEMORY_FLUSH_MS = 15_000;
export const PERSIST_MS = 30_000;
export const WELCOME_BACK_MS = 6 * 3600_000;
export const BOND_NOTIFY_MIN = 3;
export const BUZZ_HALF_LIFE_MS = 3 * 24 * 3600_000;
export const BUZZ_KNOWN_FOR = 14;
export const BUZZ_TALKED_ABOUT = 30;
export const BUZZ_SPIKE_COOLDOWN_MS = 3600_000;
