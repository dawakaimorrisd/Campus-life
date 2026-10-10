import type { Avatar } from '@campus/shared';

export interface PlayerRecord {
  money: number;
  lastSeenMs: number | null;
}
export interface RelRow {
  kind: string;
  a: string;
  b: string;
  count: number;
  lastMs: number;
}
export interface BuzzRow {
  id: string;
  helper: number;
  connector: number;
  funny: number;
  trouble: number;
  total: number;
  updatedMs: number;
}

/**
 * Everything the game keeps across visits. The world works without a store
 * (memory and buzz then only last for the session), so a stopped database
 * never blocks you from playing.
 */
export interface Store {
  loadPlayer(id: string): Promise<PlayerRecord | null>;
  savePlayer(id: string, name: string, avatar: Avatar, money: number): Promise<void>;
  loadRelationships(id: string): Promise<{ rows: RelRow[]; names: Record<string, string> }>;
  saveRelationships(rows: Array<{ kind: string; a: string; b: string; delta: number; lastMs: number }>): Promise<void>;
  logInteractions(rows: Array<{ kind: string; a: string; b: string | null; atMs: number }>): Promise<void>;
  loadBuzz(id: string): Promise<BuzzRow | null>;
  saveBuzz(rows: BuzzRow[]): Promise<void>;
}

/** Never let a slow database stall a join or a tick. */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      }
    );
  });
}
