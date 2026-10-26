import type { Avatar } from '@campus/shared';

/**
 * Phase 1 identity: a guest profile kept in this browser.
 * The auth step replaces this with a real account; the game server already
 * has a marked spot where it will verify a signed token instead of this id.
 */
export interface Profile {
  playerId: string;
  name: string;
  avatar: Avatar;
}

const KEY = 'campuslife.profile.v1';

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    if (p && typeof p.playerId === 'string' && typeof p.name === 'string' && p.avatar) return p;
  } catch {
    /* ignore corrupt data */
  }
  return null;
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage blocked: the game still works, you just re-enter your name next time */
  }
}

export function newPlayerId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'p-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
