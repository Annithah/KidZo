import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';
import * as schema from './schema';
import { upgradeLegacyArt } from './upgrade-art';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface Database {
  db: Db;
  close: () => Promise<void>;
}

// Works from src/db (tsx, tests) and from dist (bundled build).
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder =
  [path.resolve(here, '../../drizzle'), path.resolve(here, '../drizzle')].find((p) =>
    existsSync(path.join(p, 'meta', '_journal.json')),
  ) ?? path.resolve(here, '../../drizzle');

export interface DatabaseOptions {
  databaseUrl?: string | undefined;
  /** Directory for PGlite, or "memory" for an in-memory database (tests). */
  pgliteDir?: string;
}

/** Opens the database and applies pending migrations. */
export async function openDatabase(options: DatabaseOptions): Promise<Database> {
  if (options.databaseUrl) {
    const pool = new pg.Pool({ connectionString: options.databaseUrl, max: 10 });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder });
    await upgradeLegacyArt(db as unknown as Db);
    return { db: db as unknown as Db, close: () => pool.end() };
  }
  const dir = options.pgliteDir ?? 'memory';
  if (dir !== 'memory') mkdirSync(dir, { recursive: true });
  const client = dir === 'memory' ? new PGlite() : new PGlite(dir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  await upgradeLegacyArt(db as unknown as Db);
  return { db: db as unknown as Db, close: () => client.close() };
}
