import path from 'node:path';
import { loadConfig, type Config } from '../../src/config';
import { openDatabase, type Database } from '../../src/db/client';
import { LocalDiskStorage, type MediaStorage } from '../../src/lib/storage';

/** Database and media storage with the same settings as the API server (apps/api/.env). */
export async function openScriptEnv(): Promise<{ config: Config; database: Database; storage: MediaStorage }> {
  const config = loadConfig();
  if (!config.DATABASE_URL) await refuseIfApiRunning(config.PORT);
  const database = await openDatabase({ databaseUrl: config.DATABASE_URL, pgliteDir: config.PGLITE_DIR });
  const storage = new LocalDiskStorage(path.resolve(config.UPLOAD_DIR), config.PUBLIC_BASE_URL);
  return { config, database, storage };
}

/**
 * The embedded PGlite database must only be opened by one process. Opening it while the dev
 * API is running corrupted the local database before, so scripts stop instead.
 */
async function refuseIfApiRunning(port: number): Promise<void> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      throw new Error(`The API is running on port ${port} with the embedded database. Stop "pnpm dev:api" first (the local database allows one process at a time), then run this again.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('The API is running')) throw error;
    // Not reachable: nothing else holds the database.
  }
}

/** Tiny flag parser: --dry-run, --limit 10, --only a,b. */
export function parseArgs(argv: string[]): { flags: Set<string>; values: Record<string, string> } {
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (!arg.startsWith('--')) continue;
    const [name, inline] = arg.slice(2).split('=');
    if (!name) continue;
    const next = argv[i + 1];
    if (inline !== undefined) values[name] = inline;
    else if (next !== undefined && !next.startsWith('--')) {
      values[name] = next;
      i += 1;
    } else flags.add(name);
  }
  return { flags, values };
}
