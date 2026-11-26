/**
 * pnpm content:approve-dev - DEVELOPMENT ONLY. Publishes every imported or generated item that
 * is waiting in review, so the full app can be tried locally without reviewing hundreds of
 * clips. Refuses to run in production, where review stays mandatory.
 */
import { and, eq, isNotNull } from 'drizzle-orm';
import { content } from '../../src/db/schema';
import { openScriptEnv } from '../lib/script-env';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('content:approve-dev refuses to run with NODE_ENV=production. Review content in the admin dashboard.');
  }
  const { config, database } = await openScriptEnv();
  if (config.NODE_ENV === 'production') throw new Error('content:approve-dev refuses to run in production.');
  try {
    const rows = await database.db
      .update(content)
      .set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(content.status, 'review'), isNotNull(content.sourceKey)))
      .returning({ id: content.id });
    console.log(`Published ${rows.length} imported or generated items (development only).`);
  } finally {
    await database.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
