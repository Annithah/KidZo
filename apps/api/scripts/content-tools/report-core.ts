import { AGE_GROUPS, CATEGORY_KEYS, CONTENT_STATUSES, MIN_CATEGORY_ITEMS, categoryOf, type AgeGroup, type CategoryKey, type ContentStatus } from '@kidzo/shared';

export interface ReportRow {
  type: string;
  calm: boolean;
  skills: readonly string[];
  ageGroups: readonly string[];
  status: string;
}

export interface ContentReport {
  /** counts[category][group][status] */
  counts: Record<CategoryKey, Record<AgeGroup, Record<ContentStatus, number>>>;
  /** Categories with fewer than MIN_CATEGORY_ITEMS published items for a group (hidden in the app). */
  thin: { category: CategoryKey; group: AgeGroup; published: number }[];
  totals: Record<AgeGroup, Record<ContentStatus, number>>;
}

const zeroStatuses = () => Object.fromEntries(CONTENT_STATUSES.map((s) => [s, 0])) as Record<ContentStatus, number>;

export function buildReport(rows: readonly ReportRow[]): ContentReport {
  const counts = Object.fromEntries(
    CATEGORY_KEYS.map((c) => [c, Object.fromEntries(AGE_GROUPS.map((g) => [g, zeroStatuses()]))]),
  ) as ContentReport['counts'];
  const totals = Object.fromEntries(AGE_GROUPS.map((g) => [g, zeroStatuses()])) as ContentReport['totals'];
  for (const row of rows) {
    const category = categoryOf(row);
    const status = row.status as ContentStatus;
    for (const g of row.ageGroups as AgeGroup[]) {
      if (!counts[category]?.[g] || counts[category][g][status] === undefined) continue;
      counts[category][g][status] += 1;
      totals[g][status] += 1;
    }
  }
  const thin = CATEGORY_KEYS.flatMap((category) =>
    AGE_GROUPS.filter((g) => counts[category][g].published < MIN_CATEGORY_ITEMS).map((g) => ({ category, group: g, published: counts[category][g].published })),
  );
  return { counts, thin, totals };
}

export function formatReport(r: ContentReport): string {
  const cell = (n: Record<ContentStatus, number>) => `${n.published}/${n.review}/${n.draft}`.padStart(10);
  const lines = [
    `Published / in review / draft, per category and age group. Categories need ${MIN_CATEGORY_ITEMS} published items per group to show.`,
    '',
    `${'category'.padEnd(20)}${AGE_GROUPS.map((g) => g.padStart(10)).join('')}`,
  ];
  for (const c of CATEGORY_KEYS) {
    const flags = AGE_GROUPS.map((g) => (r.counts[c][g].published < MIN_CATEGORY_ITEMS ? '!' : ' ')).join('');
    lines.push(`${c.padEnd(20)}${AGE_GROUPS.map((g) => cell(r.counts[c][g])).join('')}  ${flags.trim() ? `below ${MIN_CATEGORY_ITEMS}: ${AGE_GROUPS.filter((g) => r.counts[c][g].published < MIN_CATEGORY_ITEMS).join(', ')}` : ''}`);
  }
  lines.push(`${'total'.padEnd(20)}${AGE_GROUPS.map((g) => cell(r.totals[g])).join('')}`);
  lines.push('', r.thin.length ? `${r.thin.length} category and age group pairs are below ${MIN_CATEGORY_ITEMS} published items and stay hidden.` : 'Every category has enough published items for every age group.');
  return lines.join('\n');
}
