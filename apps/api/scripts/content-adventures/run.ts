/**
 * pnpm content:adventures [--dry-run]
 *
 * Builds the branching adventures in content/adventures/*.json from clips in the library.
 * Run it again after importing or generating videos to link the clips. Adventures land in
 * "review"; scenes are marked as placeholders until custom Zo animation exists.
 */
import { openScriptEnv, parseArgs } from '../lib/script-env';
import { buildAdventures, loadAdventures } from './build';

async function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  const adventures = await loadAdventures();
  const { database } = await openScriptEnv();
  try {
    const s = await buildAdventures(database.db, adventures, { dryRun: flags.has('dry-run') });
    console.log(`Adventures: ${s.created} created, ${s.updated} updated, ${s.skipped} left alone (already published).`);
    if (s.missingClips.length) {
      console.log(`${s.missingClips.length} scenes have no clip yet and show their picture until the clip exists:`);
      for (const m of s.missingClips) console.log(`  - ${m}`);
    }
  } finally {
    await database.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
