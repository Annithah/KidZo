import { eq } from 'drizzle-orm';
import { hasLegacyFields, upgradeLegacyBody } from '@kidzo/art';
import type { ContentBody } from '@kidzo/shared';
import type { Db } from './client';
import { content } from './schema';

/**
 * Data half of migration 0003_art_keys: converts legacy `emoji` fields inside story, quiz
 * and song bodies (jsonb) to art keys. Runs after SQL migrations on every start; rows that
 * are already upgraded are skipped, so it is safe to run repeatedly.
 */
export async function upgradeLegacyArt(db: Db): Promise<number> {
  const rows = await db.select({ id: content.id, body: content.body }).from(content);
  let changed = 0;
  for (const row of rows) {
    if (!hasLegacyFields(row.body)) continue;
    await db.update(content).set({ body: upgradeLegacyBody(row.body) as ContentBody }).where(eq(content.id, row.id));
    changed += 1;
  }
  return changed;
}
