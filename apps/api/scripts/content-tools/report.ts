/** pnpm content:report - counts per category x age group x status, flags thin categories. */
import { content } from '../../src/db/schema';
import { openScriptEnv } from '../lib/script-env';
import { buildReport, formatReport } from './report-core';

async function main() {
  const { database } = await openScriptEnv();
  try {
    const rows = await database.db
      .select({ type: content.type, calm: content.calm, skills: content.skills, ageGroups: content.ageGroups, status: content.status })
      .from(content);
    console.log(formatReport(buildReport(rows)));
  } finally {
    await database.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
