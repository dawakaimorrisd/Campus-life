import {
  CAMPUS_MAP, CHAT_BURST, CHAT_MAX, CHAT_WINDOW_MS, EMOTE_COOLDOWN_MS, EMOTE_RANGE, HEAR_RANGE, HEAR_RANGE_MUFFLED,
  dist, isIndoor, levelAt, zoneAt, type EmoteKind
} from '@campus/shared';
import type { ServerPlayer, World } from './world';

/** Strip control characters, collapse whitespace, trim, cap length. */
export function sanitizeChat(raw: string): string {
  return raw.replace(/[\p{C}\u2028\u2029]/gu, " ").replace(/\s+/g, " ").trim().slice(0, CHAT_MAX);
}

function allowChat(world: World, p: ServerPlayer): boolean {
  const now = world.now();
  p.chatTimes = p.chatTimes.filter((t) => now - t < CHAT_WINDOW_MS);
  if (p.chatTimes.length >= CHAT_BURST) { world.notice(p, 'Slow down a little.', 'warn'); return false; }
  p.chatTimes.push(now);
  return true;
}

/** How far can `a`'s voice carry to `b`? Walls and doorways muffle it. */
export function hearRange(a: ServerPlayer, b: ServerPlayer): number {
  const za = zoneAt(CAMPUS_MAP, a.x, a.y)?.id ?? null;
  const zb = zoneAt(CAMPUS_MAP, b.x, b.y)?.id ?? null;
  return za !== zb && (isIndoor(za) || isIndoor(zb)) ? HEAR_RANGE_MUFFLED : HEAR_RANGE;
}

/** Nearby talk: only people physically close enough, on the same floor, hear it. */
export function say(world: World, p: ServerPlayer, raw: string, quick: boolean) {
  const text = sanitizeChat(raw);
  if (!text || !allowChat(world, p)) return;
  for (const o of world.players.values()) {
    if (o === p || (levelAt(o.y) === levelAt(p.y) && dist(p, o) <= hearRange(p, o))) {
      world.send(o, { t: 'speech', id: p.id, text, q: quick });
    }
  }
}

/** Private message: deliberate, works at any distance. */
export function whisper(world: World, p: ServerPlayer, toId: string, raw: string) {
  const text = sanitizeChat(raw);
  const to = world.players.get(toId);
  if (!to || to === p || !text || !allowChat(world, p)) return;
  const msg = { t: 'whisper', from: p.id, fromName: p.name, to: to.id, toName: to.name, text } as const;
  world.send(to, msg);
  world.send(p, msg);
}

export function emote(world: World, p: ServerPlayer, kind: EmoteKind) {
  const now = world.now();
  if (now - p.lastEmoteAt < EMOTE_COOLDOWN_MS) return;
  p.lastEmoteAt = now;
  world.sendNear(p, EMOTE_RANGE, (o) => ({ t: 'emote', id: p.id, kind }) as const);
}
