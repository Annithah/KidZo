/**
 * pnpm content:generate [--dry-run] [--limit N] [--topics counting,colors] [--ids count-to-3]
 *
 * Builds KIDZO's own learning videos from content/generate/*.json: art rendered to frames,
 * narration from the TTS engine (KIDZO_TTS), FFmpeg for the video. Every video comes with its
 * quiz and lands in "review"; nothing is published.
 */
import { openScriptEnv, parseArgs } from '../lib/script-env';
import { pickTts } from '../lib/tts';
import { loadTopics } from './data';
import { runGenerate } from './generator';
import { renderVideo } from './render';

async function main() {
  const { flags, values } = parseArgs(process.argv.slice(2));
  const dryRun = flags.has('dry-run');
  const topics = await loadTopics();
  const total = topics.reduce((n, t) => n + t.videos.length, 0);
  const tts = await pickTts();
  const { database, storage } = await openScriptEnv();
  console.log(`${dryRun ? 'Dry run' : 'Generate'}: ${total} videos in ${topics.length} topics, voice: ${tts.id}`);
  if (tts.id === 'none') console.log('No text to speech found: videos get captions and silence. Set KIDZO_TTS or install espeak-ng or piper.');
  try {
    const summary = await runGenerate(topics, { db: database.db, storage, tts, render: renderVideo, log: (l) => console.log(l) }, {
      dryRun,
      limit: values.limit ? Number(values.limit) : undefined,
      topics: values.topics?.split(',').filter(Boolean),
      ids: values.ids?.split(',').filter(Boolean),
    });
    console.log('\nSummary');
    console.log(`  planned:   ${summary.planned}`);
    console.log(`  ${dryRun ? 'would make' : 'generated'}: ${dryRun ? summary.wouldGenerate : summary.generated}`);
    console.log(`  existing:  ${summary.existing} (made before, skipped)`);
    console.log(`  failed:    ${summary.failed}`);
    for (const f of summary.failures.slice(0, 20)) console.log(`    - ${f.id}: ${f.message}`);
  } finally {
    await database.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
