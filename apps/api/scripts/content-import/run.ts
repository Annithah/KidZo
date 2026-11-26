/**
 * pnpm content:import [--dry-run] [--limit N] [--only entry-a,entry-b] [--plan path] [--max-mb 400]
 *
 * Imports child-safe videos from Pexels, Pixabay, NASA and Wikimedia Commons following
 * content/import-plan.json. Every imported item lands in "review"; nothing is published.
 */
import path from 'node:path';
import { CONTENT_DIR, readJsonFile } from '../lib/plan-common';
import { probe, thumbnail, transcode } from '../lib/media-tools';
import { openScriptEnv, parseArgs } from '../lib/script-env';
import { importPlanSchema, runImport } from './importer';
import { ADAPTERS } from './sources';

async function main() {
  const { flags, values } = parseArgs(process.argv.slice(2));
  const dryRun = flags.has('dry-run');
  const limit = values.limit ? Number(values.limit) : undefined;
  const only = values.only?.split(',').filter(Boolean);
  const maxDownloadBytes = values['max-mb'] ? Number(values['max-mb']) * 1024 * 1024 : undefined;
  const planFile = path.resolve(values.plan ?? path.join(CONTENT_DIR, 'import-plan.json'));
  const plan = await readJsonFile(planFile, importPlanSchema);
  const { database, storage } = await openScriptEnv();
  console.log(`${dryRun ? 'Dry run' : 'Import'} from ${path.basename(planFile)}: ${plan.entries.length} entries${limit ? `, limit ${limit}` : ''}`);
  try {
    const summary = await runImport(
      plan,
      { db: database.db, storage, media: { probe, transcode, thumbnail }, adapters: Object.values(ADAPTERS), log: (l) => console.log(l) },
      { dryRun, limit, only, maxDownloadBytes },
    );
    console.log('\nSummary');
    console.log(`  found:        ${summary.found}`);
    console.log(`  ${dryRun ? 'would import' : 'imported'}: ${dryRun ? summary.wouldImport : summary.imported}`);
    console.log(`  duplicates:   ${summary.duplicates} (imported before)`);
    console.log(`  filtered out: ${Object.entries(summary.filtered).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    console.log(`  failed:       ${summary.failed}`);
    for (const f of summary.failures.slice(0, 20)) console.log(`    - ${f.id}: ${f.message}`);
    for (const [id, why] of Object.entries(summary.skippedSources)) console.log(`  skipped source ${id}: ${why}`);
    if (!dryRun && summary.imported > 0) console.log('\nImported items are in "review". Approve them in the admin dashboard (or pnpm content:approve-dev locally).');
  } finally {
    await database.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
