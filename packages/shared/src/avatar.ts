import { MAX_NAME_LENGTH } from './constants';

/** Avatars are three palette indexes. The client draws them; the server only validates them. */
export interface Avatar {
  skin: number;
  shirt: number;
  hair: number;
}

export const SKIN_TONES = [0xf1c9a5, 0xd9a273, 0xb97a4b, 0x8d5a34, 0x6b4025, 0x4a2c18] as const;
export const SHIRT_COLORS = [
  0xe5484d, 0xf5a524, 0xf2d13b, 0x3fb26b, 0x2fa8a0,
  0x3b82f6, 0x6e56cf, 0xe254a3, 0xf4f1ea, 0x2b2f3a
] as const;
export const HAIR_COLORS = [0x15110e, 0x3b2314, 0x7a4a24, 0xc58b3e, 0x8c8c94, 0xd23f6a] as const;

export function isAvatar(v: unknown): v is Avatar {
  if (typeof v !== 'object' || v === null) return false;
  const a = v as Record<string, unknown>;
  const ok = (n: unknown, len: number) =>
    typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < len;
  return ok(a.skin, SKIN_TONES.length) && ok(a.shirt, SHIRT_COLORS.length) && ok(a.hair, HAIR_COLORS.length);
}

/** 0xRRGGBB -> "#rrggbb" */
export function toCss(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

/** Strip control chars / odd symbols, collapse spaces, trim, cap length. */
export function sanitizeName(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N} _.\-']/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

export function isValidPlayerId(id: string): boolean {
  return /^[a-zA-Z0-9-]{8,64}$/.test(id);
}
