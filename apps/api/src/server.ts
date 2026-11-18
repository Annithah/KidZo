import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { buildApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db/client';

async function main(): Promise<void> {
  const config = loadConfig();
  mkdirSync(path.resolve(config.UPLOAD_DIR), { recursive: true });
  const database = await openDatabase({ databaseUrl: config.DATABASE_URL, pgliteDir: config.PGLITE_DIR });
  const app = await buildApp({ config, db: database.db });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    await database.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  if (!config.DATABASE_URL) app.log.warn(`Using embedded PGlite database at ${config.PGLITE_DIR} (development only)`);
  await app.listen({ host: config.HOST, port: config.PORT });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
