/**
 * Creates an admin account or promotes an existing account to admin.
 * Usage: pnpm create-admin <email> <password> [display name]
 */
import { eq } from 'drizzle-orm';
import { emailSchema, passwordSchema } from '@kidzo/shared';
import { loadConfig } from './config';
import { openDatabase } from './db/client';
import { users } from './db/schema';
import { hashSecret } from './lib/auth';

async function main(): Promise<void> {
  const [, , rawEmail, rawPassword, ...nameParts] = process.argv;
  const email = emailSchema.parse(rawEmail);
  const password = passwordSchema.parse(rawPassword);
  const displayName = nameParts.join(' ').trim() || 'KIDZO Admin';

  const config = loadConfig();
  const database = await openDatabase({ databaseUrl: config.DATABASE_URL, pgliteDir: config.PGLITE_DIR });
  try {
    const [existing] = await database.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) {
      await database.db
        .update(users)
        .set({ role: 'admin', passwordHash: await hashSecret(password), updatedAt: new Date() })
        .where(eq(users.id, existing.id));
      console.warn(`Promoted ${email} to admin.`);
    } else {
      await database.db.insert(users).values({
        email,
        displayName,
        role: 'admin',
        passwordHash: await hashSecret(password),
        consentAt: new Date(),
      });
      console.warn(`Created admin ${email}.`);
    }
  } finally {
    await database.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
