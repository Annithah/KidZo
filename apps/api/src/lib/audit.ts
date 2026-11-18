import type { Db } from '../db/client';
import { auditLogs } from '../db/schema';

export async function audit(
  db: Db,
  entry: { actorId: string | null; action: string; entity: string; entityId?: string | null; meta?: Record<string, unknown> },
): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    meta: entry.meta ?? null,
  });
}
