import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIN_CATEGORY_ITEMS } from '@kidzo/shared';
import { buildReport, formatReport } from '../scripts/content-tools/report-core';

describe('content report', () => {
  it('counts per category, age group and status and flags thin categories', () => {
    const item = (status: string, ageGroups: string[], skills = ['animals']) => ({ type: 'video', calm: false, skills, ageGroups, status });
    const rows = [
      ...Array.from({ length: MIN_CATEGORY_ITEMS }, () => item('published', ['little'])),
      item('review', ['little', 'young']),
      item('published', ['big'], ['math']),
    ];
    const report = buildReport(rows);
    expect(report.counts['morning-activities'].little.published).toBe(MIN_CATEGORY_ITEMS);
    expect(report.counts['morning-activities'].young.review).toBe(1);
    expect(report.counts['brain-games'].big.published).toBe(1);
    expect(report.thin).toContainEqual({ category: 'brain-games', group: 'big', published: 1 });
    expect(report.thin).not.toContainEqual(expect.objectContaining({ category: 'morning-activities', group: 'little' }));
    expect(formatReport(report)).toContain('below 12');
  });
});

describe('content:approve-dev', () => {
  it('refuses to run in production', () => {
    const script = path.resolve(__dirname, '../scripts/content-tools/approve-dev.ts');
    const tsx = path.resolve(__dirname, '../node_modules/.bin/tsx');
    const res = spawnSync(process.platform === 'win32' ? `"${tsx}.cmd"` : tsx, [script], {
      env: { ...process.env, NODE_ENV: 'production' },
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    expect(res.status).not.toBe(0);
    expect(`${res.stderr}${res.stdout}`).toContain('refuses to run');
  });
});
