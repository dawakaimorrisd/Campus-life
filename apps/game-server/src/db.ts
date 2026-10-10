import pg from 'pg';
import type { Avatar } from '@campus/shared';
import type { BuzzRow, PlayerRecord, RelRow, Store } from './store';

/** Postgres implementation of the game's durable memory. */
class PgStore implements Store {
  constructor(private pool: pg.Pool) {}

  async loadPlayer(id: string): Promise<PlayerRecord | null> {
    const r = await this.pool.query('SELECT money, extract(epoch from last_seen) * 1000 AS seen FROM players WHERE id = $1', [id]);
    if (!r.rows.length) return null;
    return { money: Number(r.rows[0].money), lastSeenMs: r.rows[0].seen === null ? null : Number(r.rows[0].seen) };
  }

  async savePlayer(id: string, name: string, avatar: Avatar, money: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO players (id, name, avatar, money) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, avatar = EXCLUDED.avatar, money = EXCLUDED.money, last_seen = now()`,
      [id, name, JSON.stringify(avatar), Math.max(0, Math.floor(money))]
    );
  }

  async loadRelationships(id: string): Promise<{ rows: RelRow[]; names: Record<string, string> }> {
    const r = await this.pool.query(
      `SELECT r.kind, r.a, r.b, r.count, extract(epoch from r.last_at) * 1000 AS last_ms, pa.name AS an, pb.name AS bn
         FROM relationships r
         LEFT JOIN players pa ON pa.id = r.a
         LEFT JOIN players pb ON pb.id = r.b
        WHERE r.a = $1 OR r.b = $1`,
      [id]
    );
    const names: Record<string, string> = {};
    const rows: RelRow[] = r.rows.map((x: Record<string, unknown>) => {
      if (x.an) names[String(x.a)] = String(x.an);
      if (x.bn) names[String(x.b)] = String(x.bn);
      return { kind: String(x.kind), a: String(x.a), b: String(x.b), count: Number(x.count), lastMs: Number(x.last_ms) };
    });
    return { rows, names };
  }

  async saveRelationships(rows: Array<{ kind: string; a: string; b: string; delta: number; lastMs: number }>): Promise<void> {
    if (!rows.length) return;
    await this.pool.query(
      `INSERT INTO relationships (kind, a, b, count, last_at)
       SELECT k, x, y, d, to_timestamp(l / 1000.0)
         FROM unnest($1::text[], $2::text[], $3::text[], $4::int[], $5::float8[]) AS t(k, x, y, d, l)
       ON CONFLICT (kind, a, b) DO UPDATE SET count = relationships.count + EXCLUDED.count, last_at = EXCLUDED.last_at`,
      [rows.map((r) => r.kind), rows.map((r) => r.a), rows.map((r) => r.b), rows.map((r) => r.delta), rows.map((r) => r.lastMs)]
    );
  }

  async logInteractions(rows: Array<{ kind: string; a: string; b: string | null; atMs: number }>): Promise<void> {
    if (!rows.length) return;
    await this.pool.query(
      `INSERT INTO interactions (kind, a, b, at)
       SELECT k, x, y, to_timestamp(t / 1000.0)
         FROM unnest($1::text[], $2::text[], $3::text[], $4::float8[]) AS u(k, x, y, t)`,
      [rows.map((r) => r.kind), rows.map((r) => r.a), rows.map((r) => r.b), rows.map((r) => r.atMs)]
    );
  }

  async loadBuzz(id: string): Promise<BuzzRow | null> {
    const r = await this.pool.query(
      'SELECT helper, connector, funny, trouble, total, extract(epoch from updated_at) * 1000 AS at FROM buzz WHERE player_id = $1',
      [id]
    );
    if (!r.rows.length) return null;
    const x = r.rows[0];
    return { id, helper: Number(x.helper), connector: Number(x.connector), funny: Number(x.funny), trouble: Number(x.trouble), total: Number(x.total), updatedMs: Number(x.at) };
  }

  async saveBuzz(rows: BuzzRow[]): Promise<void> {
    if (!rows.length) return;
    await this.pool.query(
      `INSERT INTO buzz (player_id, helper, connector, funny, trouble, total, updated_at)
       SELECT i, h, c, f, tr, tt, to_timestamp(u / 1000.0)
         FROM unnest($1::text[], $2::float8[], $3::float8[], $4::float8[], $5::float8[], $6::float8[], $7::float8[]) AS t(i, h, c, f, tr, tt, u)
       ON CONFLICT (player_id) DO UPDATE SET helper = EXCLUDED.helper, connector = EXCLUDED.connector, funny = EXCLUDED.funny,
         trouble = EXCLUDED.trouble, total = EXCLUDED.total, updated_at = EXCLUDED.updated_at`,
      [rows.map((r) => r.id), rows.map((r) => r.helper), rows.map((r) => r.connector), rows.map((r) => r.funny), rows.map((r) => r.trouble), rows.map((r) => r.total), rows.map((r) => r.updatedMs)]
    );
  }
}

let pool: pg.Pool | null = null;

/**
 * Connects to Postgres and makes sure the schema exists. Returns null if it is not available:
 * the game keeps running (nothing persists), so a stopped container never blocks you from working.
 */
export async function initDb(): Promise<Store | null> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('[db] DATABASE_URL not set - running without a database');
    return null;
  }
  try {
    pool = new pg.Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 10000 });
    pool.on('error', (e) => console.error('[db] pool error:', e.message));
    await pool.query(`
      CREATE TABLE IF NOT EXISTS players (
        id         text PRIMARY KEY,
        name       text NOT NULL,
        avatar     jsonb NOT NULL,
        money      integer NOT NULL DEFAULT 100,
        last_x     real,
        last_y     real,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen  timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE players ADD COLUMN IF NOT EXISTS money integer NOT NULL DEFAULT 100;
      CREATE TABLE IF NOT EXISTS relationships (
        kind    text NOT NULL,
        a       text NOT NULL,
        b       text NOT NULL,
        count   integer NOT NULL DEFAULT 0,
        last_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (kind, a, b)
      );
      CREATE INDEX IF NOT EXISTS relationships_a ON relationships (a);
      CREATE INDEX IF NOT EXISTS relationships_b ON relationships (b);
      CREATE TABLE IF NOT EXISTS interactions (
        id   bigserial PRIMARY KEY,
        kind text NOT NULL,
        a    text NOT NULL,
        b    text,
        at   timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS buzz (
        player_id  text PRIMARY KEY,
        helper     real NOT NULL DEFAULT 0,
        connector  real NOT NULL DEFAULT 0,
        funny      real NOT NULL DEFAULT 0,
        trouble    real NOT NULL DEFAULT 0,
        total      real NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    console.log('[db] connected');
    return new PgStore(pool);
  } catch (e) {
    console.warn('[db] unavailable - running without a database:', (e as Error).message);
    await pool?.end().catch(() => {});
    pool = null;
    return null;
  }
}

export async function closeDb(): Promise<void> {
  await pool?.end().catch(() => {});
  pool = null;
}
