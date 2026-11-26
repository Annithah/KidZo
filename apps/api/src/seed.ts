/**
 * Seeds the database: stickers, the starter catalog (published), an admin account and,
 * outside production, a demo family. Safe to run repeatedly (upserts by slug and email).
 *
 * Usage: pnpm db:seed
 */
import { eq } from 'drizzle-orm';
import {
  DEFAULT_CHILD_SETTINGS,
  contentInputSchema,
  estimatePackageBytes,
  publishProblems,
  stickerInputSchema, gateFields } from '@kidzo/shared';
import { loadConfig } from './config';
import { openDatabase, type Db } from './db/client';
import { children, content, stickers, users } from './db/schema';
import { hashSecret } from './lib/auth';
import { seedContent, seedStickers } from './seed-data';

const DEV_ADMIN = { email: 'admin@kidzo.local', password: 'KidzoAdmin2026' };
const DEMO_PARENT = { email: 'parent@kidzo.local', password: 'KidzoParent2026', pin: '1234' };

export async function seed(db: Db, options: { adminEmail: string; adminPassword: string; demo: boolean }): Promise<void> {
  const stickerIds = new Map<string, string>();
  for (const raw of seedStickers) {
    const input = stickerInputSchema.parse(raw);
    const [row] = await db
      .insert(stickers)
      .values(input)
      .onConflictDoUpdate({ target: stickers.slug, set: { name: input.name, art: input.art, color: input.color } })
      .returning({ id: stickers.id });
    if (row) stickerIds.set(input.slug, row.id);
  }

  for (const { rewardSticker, ...raw } of seedContent) {
    const input = contentInputSchema.parse({
      ...raw,
      rewardStickerId: rewardSticker ? (stickerIds.get(rewardSticker) ?? null) : null,
    });
    const problems = publishProblems(input);
    if (problems.length > 0) throw new Error(`Seed content "${input.slug}" is invalid: ${problems.join('; ')}`);
    const values = {
      ...input,
      ...gateFields(input),
      status: 'published' as const,
      sizeBytes: estimatePackageBytes(input.body),
      publishedAt: new Date(),
    };
    await db
      .insert(content)
      .values(values)
      .onConflictDoUpdate({ target: content.slug, set: { ...values, updatedAt: new Date() } });
  }

  const [existingAdmin] = await db.select({ id: users.id }).from(users).where(eq(users.email, options.adminEmail));
  if (!existingAdmin) {
    await db.insert(users).values({
      email: options.adminEmail,
      passwordHash: await hashSecret(options.adminPassword),
      displayName: 'KIDZO Admin',
      role: 'admin',
      consentAt: new Date(),
    });
  }

  if (options.demo) {
    let [parent] = await db.select().from(users).where(eq(users.email, DEMO_PARENT.email));
    if (!parent) {
      [parent] = await db
        .insert(users)
        .values({
          email: DEMO_PARENT.email,
          passwordHash: await hashSecret(DEMO_PARENT.password),
          pinHash: await hashSecret(DEMO_PARENT.pin),
          displayName: 'Amara',
          timezone: 'Africa/Kigali',
          consentAt: new Date(),
        })
        .returning();
      if (parent) {
        await db.insert(children).values([
          { parentId: parent.id, name: 'Mia', age: 5, avatar: 'fox', settings: DEFAULT_CHILD_SETTINGS },
          { parentId: parent.id, name: 'Kayla', age: 8, avatar: 'owl', settings: { ...DEFAULT_CHILD_SETTINGS, dailyLimitMinutes: 90 } },
        ]);
      }
    }
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const isProd = config.NODE_ENV === 'production';
  const adminEmail = config.ADMIN_EMAIL ?? (isProd ? undefined : DEV_ADMIN.email);
  const adminPassword = config.ADMIN_PASSWORD ?? (isProd ? undefined : DEV_ADMIN.password);
  if (!adminEmail || !adminPassword) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD to seed in production');

  const database = await openDatabase({ databaseUrl: config.DATABASE_URL, pgliteDir: config.PGLITE_DIR });
  try {
    await seed(database.db, { adminEmail, adminPassword, demo: !isProd && process.env.SEED_DEMO !== 'false' });
    console.warn(`Seeded ${seedStickers.length} stickers and ${seedContent.length} content items.`);
    if (!config.ADMIN_EMAIL && !isProd) console.warn(`Dev admin: ${DEV_ADMIN.email} / ${DEV_ADMIN.password}`);
    if (!isProd) console.warn(`Demo parent: ${DEMO_PARENT.email} / ${DEMO_PARENT.password} (PIN ${DEMO_PARENT.pin})`);
  } finally {
    await database.close();
  }
}

const invokedDirectly = process.argv[1]?.replace(/\\/g, '/').match(/seed\.(ts|js)$/);
if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
