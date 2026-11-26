import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/client';
import * as schema from '../src/db/schema';
import { upgradeLegacyArt } from '../src/db/upgrade-art';

const here = path.dirname(fileURLToPath(import.meta.url));
const drizzleDir = path.resolve(here, '../drizzle');
const tmp = mkdtempSync(path.join(tmpdir(), 'kidzo-mig-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** Copy of the migrations folder cut off before the art-key migration. */
function migrationsUpTo(tag: string): string {
  const dir = path.join(tmp, 'pre');
  cpSync(drizzleDir, dir, { recursive: true });
  const journalPath = path.join(dir, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] };
  const end = journal.entries.findIndex((e) => e.tag === tag);
  journal.entries = journal.entries.slice(0, end);
  writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

describe('migration 0003_art_keys', () => {
  it('converts stickers, covers and bodies saved with emoji', async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: migrationsUpTo('0003_art_keys') });

    // Rows exactly as the pre-art version wrote them.
    await db.execute(sql`INSERT INTO stickers (slug, name, emoji, color) VALUES
      ('ocean-pearl', '{"en":"Ocean Pearl"}', ${'\u{1F41A}'}, '#8C82C9'),
      ('custom-thing', '{"en":"Custom"}', ${'\u{1F98A}'}, '#FF7A5C')`);
    const body = {
      kind: 'branching',
      startNodeId: 'a',
      nodes: [
        { id: 'a', text: { en: 'Hi' }, scene: { emoji: '\u{1F319}', color: '#24264A', videoUrl: null }, familyTurn: false, choices: [{ id: 'c', label: { en: 'Go' }, emoji: '☀️', next: 'b' }], next: null, ending: false },
        { id: 'b', text: { en: 'End' }, scene: { emoji: '\u{1F34E}\u{1F34E}\u{1F34E}', color: '#FF7A5C', videoUrl: null }, familyTurn: false, choices: [], next: null, ending: true },
      ],
    };
    await db.execute(sql`INSERT INTO content (slug, type, title, summary, age_min, age_max, duration_minutes, skills, languages, cover_emoji, cover_color, body)
      VALUES ('old-story', 'adventure', '{"en":"Old"}', '{"en":"Old"}', 3, 8, 5, '["kindness"]', '["en"]', ${'\u{1F338}'}, '#5BC0F8', ${JSON.stringify(body)}::jsonb)`);

    await migrate(db, { migrationsFolder: drizzleDir });
    const changed = await upgradeLegacyArt(db as unknown as Db);
    expect(changed).toBe(1);

    const stickers = await db.select().from(schema.stickers).orderBy(schema.stickers.slug);
    expect(stickers.map((s) => [s.slug, s.art])).toEqual([
      ['custom-thing', 'object.fox'],
      ['ocean-pearl', 'sticker.ocean-pearl'],
    ]);
    const [item] = await db.select().from(schema.content);
    expect(item?.coverArt).toBe('object.flower');
    const nodes = (item?.body as { nodes: { scene: { art: string }; choices: { art: string }[] }[] }).nodes;
    expect(nodes[0]?.scene.art).toBe('object.moon');
    expect(nodes[0]?.choices[0]?.art).toBe('object.sun');
    expect(nodes[1]?.scene.art).toBe('object.apple*3');
    expect(JSON.stringify(item?.body)).not.toContain('emoji');

    // Running again changes nothing.
    expect(await upgradeLegacyArt(db as unknown as Db)).toBe(0);
    await client.close();
  });
});
