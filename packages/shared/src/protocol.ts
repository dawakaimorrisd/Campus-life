import { isAvatar, type Avatar } from './avatar';
import { ZONE_IDS, type Facing, type ZoneId } from './map';

export type ItemKind = 'plate';
export const EMOTES = ['wave', 'laugh', 'point', 'clap', 'dance', 'shake', 'think'] as const;
export type EmoteKind = (typeof EMOTES)[number];
export const HELP_KINDS = ['assignment', 'find'] as const;
export type HelpKind = (typeof HELP_KINDS)[number];
export type InvitePlace = ZoneId | 'here';
export type Doing = 'work' | 'ride' | 'sneak';
export type CampusEventKind = 'gathering' | 'eating' | 'group_left' | 'steal' | 'escape' | 'music' | 'looking' | 'buzz';

/** A visible cluster of 3+ people (social gravity). */
export interface GroupInfo {
  x: number;
  y: number;
  r: number;
  n: number;
  kind: 'chat' | 'eating' | 'walking' | 'study';
  level: 'ground' | 'upper';
}

export interface PlayerState {
  id: string;
  name: string;
  avatar: Avatar;
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  seat: string | null;
  held: ItemKind | null;
  following: string | null;
  eating: boolean;
  asking: HelpKind | null;
  /** Victim id while holding a plate taken from them and it is still "hot". */
  hotFor: string | null;
  doing: Doing | null;
  /** People are watching this player after repeated mischief. */
  watched: boolean;
}

export interface SelfState {
  money: number;
  mischief: boolean;
}

export interface SnapMove {
  id: string;
  x: number;
  y: number;
  f: Facing;
  m: boolean;
}

// ---------- client -> server ----------
export type ClientMsg =
  | { t: 'join'; playerId: string; name: string; avatar: Avatar }
  | { t: 'ping'; ts: number }
  | { t: 'move_to'; x: number; y: number }
  | { t: 'dir'; x: number; y: number }
  | { t: 'sit'; seat: string }
  | { t: 'stand' }
  | { t: 'say'; text: string; q?: boolean }
  | { t: 'whisper'; to: string; text: string }
  | { t: 'emote'; kind: EmoteKind }
  | { t: 'invite'; to: string; place: InvitePlace }
  | { t: 'invite_reply'; id: string; accept: boolean }
  | { t: 'follow'; to: string }
  | { t: 'unfollow' }
  | { t: 'join_in'; to: string }
  | { t: 'give'; to: string; item: ItemKind | 'money'; amount?: number }
  | { t: 'take_food' }
  | { t: 'ask_help'; kind: HelpKind }
  | { t: 'cancel_help' }
  | { t: 'offer_help'; to: string }
  | { t: 'steal'; to: string }
  | { t: 'reclaim'; from: string }
  | { t: 'prank'; to: string }
  | { t: 'settings'; mischief: boolean }
  // groups, spots, escape, memory (Phases 5 to 10)
  | { t: 'invite_all'; place: InvitePlace }
  | { t: 'use_spot'; spot: string }
  | { t: 'escape' }
  | { t: 'cancel_activity' }
  | { t: 'peek'; id: string };

// ---------- server -> client ----------
export type NoticeTone = 'info' | 'good' | 'warn' | 'fun';

export type ServerMsg =
  | { t: 'welcome'; selfId: string; tick: number; players: PlayerState[]; self: SelfState }
  | { t: 'player_joined'; player: PlayerState }
  | { t: 'player_left'; id: string }
  | { t: 'player_state'; player: PlayerState }
  | { t: 'snap'; tick: number; moves: SnapMove[] }
  | { t: 'self'; self: SelfState }
  | { t: 'speech'; id: string; text: string; q: boolean }
  | { t: 'whisper'; from: string; fromName: string; to: string; toName: string; text: string }
  | { t: 'emote'; id: string; kind: EmoteKind }
  | { t: 'invite'; id: string; from: string; fromName: string; place: InvitePlace; ttl: number }
  | { t: 'invite_result'; id: string; accepted: boolean; name: string }
  | { t: 'help_started'; withId: string; withName: string; kind: HelpKind; role: 'helper' | 'requester'; total: number }
  | { t: 'help_progress'; pct: number }
  | { t: 'help_done'; withName: string; role: 'helper' | 'requester'; reward: number }
  | { t: 'help_ended'; reason: string }
  | { t: 'mischief'; kind: 'steal' | 'prank' | 'reclaim'; actor: string; victim: string; actorName: string; victimName: string }
  | { t: 'groups'; groups: GroupInfo[] }
  | { t: 'campus_event'; id: number; kind: CampusEventKind; text: string; x: number; y: number; tone: NoticeTone }
  | { t: 'history'; id: string; line: string | null; known: string | null }
  | { t: 'notice'; text: string; tone: NoticeTone }
  | { t: 'pong'; ts: number }
  | { t: 'error'; message: string };

// ---------- validation of untrusted input ----------
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isId = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length <= 64;
const isText = (s: unknown): s is string => typeof s === 'string' && s.length <= 400;

/** Returns null if the message is malformed. Never trust the client. */
export function parseClientMsg(raw: unknown): ClientMsg | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  switch (m.t) {
    case 'join':
      return typeof m.playerId === 'string' && typeof m.name === 'string' && isAvatar(m.avatar)
        ? { t: 'join', playerId: m.playerId, name: m.name, avatar: m.avatar }
        : null;
    case 'ping':
      return isNum(m.ts) ? { t: 'ping', ts: m.ts } : null;
    case 'move_to':
      return isNum(m.x) && isNum(m.y) ? { t: 'move_to', x: m.x, y: m.y } : null;
    case 'dir':
      return isNum(m.x) && isNum(m.y) ? { t: 'dir', x: Math.sign(m.x), y: Math.sign(m.y) } : null;
    case 'sit':
      return isId(m.seat) ? { t: 'sit', seat: m.seat } : null;
    case 'stand':
      return { t: 'stand' };
    case 'say':
      return isText(m.text) ? { t: 'say', text: m.text, q: m.q === true } : null;
    case 'whisper':
      return isId(m.to) && isText(m.text) ? { t: 'whisper', to: m.to, text: m.text } : null;
    case 'emote':
      return typeof m.kind === 'string' && (EMOTES as readonly string[]).includes(m.kind)
        ? { t: 'emote', kind: m.kind as EmoteKind }
        : null;
    case 'invite':
      return isId(m.to) && typeof m.place === 'string' && (m.place === 'here' || (ZONE_IDS as readonly string[]).includes(m.place))
        ? { t: 'invite', to: m.to, place: m.place as InvitePlace }
        : null;
    case 'invite_all':
      return typeof m.place === 'string' && (m.place === 'here' || (ZONE_IDS as readonly string[]).includes(m.place))
        ? { t: 'invite_all', place: m.place as InvitePlace }
        : null;
    case 'use_spot':
      return isId(m.spot) ? { t: 'use_spot', spot: m.spot } : null;
    case 'escape':
      return { t: 'escape' };
    case 'cancel_activity':
      return { t: 'cancel_activity' };
    case 'peek':
      return isId(m.id) ? { t: 'peek', id: m.id } : null;
    case 'invite_reply':
      return isId(m.id) && typeof m.accept === 'boolean' ? { t: 'invite_reply', id: m.id, accept: m.accept } : null;
    case 'follow':
      return isId(m.to) ? { t: 'follow', to: m.to } : null;
    case 'unfollow':
      return { t: 'unfollow' };
    case 'join_in':
      return isId(m.to) ? { t: 'join_in', to: m.to } : null;
    case 'give':
      return isId(m.to) && (m.item === 'plate' || m.item === 'money')
        ? { t: 'give', to: m.to, item: m.item, amount: isNum(m.amount) ? m.amount : undefined }
        : null;
    case 'take_food':
      return { t: 'take_food' };
    case 'ask_help':
      return typeof m.kind === 'string' && (HELP_KINDS as readonly string[]).includes(m.kind)
        ? { t: 'ask_help', kind: m.kind as HelpKind }
        : null;
    case 'cancel_help':
      return { t: 'cancel_help' };
    case 'offer_help':
      return isId(m.to) ? { t: 'offer_help', to: m.to } : null;
    case 'steal':
      return isId(m.to) ? { t: 'steal', to: m.to } : null;
    case 'reclaim':
      return isId(m.from) ? { t: 'reclaim', from: m.from } : null;
    case 'prank':
      return isId(m.to) ? { t: 'prank', to: m.to } : null;
    case 'settings':
      return typeof m.mischief === 'boolean' ? { t: 'settings', mischief: m.mischief } : null;
    default:
      return null;
  }
}
