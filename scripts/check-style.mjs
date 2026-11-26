#!/usr/bin/env node
/**
 * Brand consistency check. Fails when source files contain emoji or hardcoded hex colors
 * outside packages/ui-tokens (and the art package, whose SVGs are built from token values).
 *
 * Usage:
 *   node scripts/check-style.mjs          fail on any violation
 *   node scripts/check-style.mjs --report print a per-file count table and exit 0
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['apps/mobile/src', 'apps/admin/src', 'packages/shared/src', 'packages/art/src', 'apps/api/src'];
const HEX_ALLOWED = [/^packages\/ui-tokens\//];
/** The legacy emoji to art key map, used only to migrate old data. */
const EMOJI_ALLOWED = [/^packages\/art\/src\/legacy\.ts$/];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.expo', '__snapshots__']);

const EMOJI = /\p{Extended_Pictographic}/u;
const HEX = /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b(?![0-9A-Za-z])/g;

const report = process.argv.includes('--report');
const results = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (/\.(tsx?|css)$/.test(name)) check(full);
  }
}

function check(file) {
  const rel = file.split(path.sep).join('/');
  const isTest = /(\.test\.|__tests__|\/test\/)/.test(rel);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const hits = { file: rel, emoji: [], hex: [] };
  lines.forEach((line, i) => {
    if (!isTest && EMOJI.test(line) && !EMOJI_ALLOWED.some((r) => r.test(rel))) hits.emoji.push(i + 1);
    const hex = line.match(HEX);
    if (hex && !isTest && !HEX_ALLOWED.some((r) => r.test(rel))) hits.hex.push(i + 1);
  });
  if (hits.emoji.length || hits.hex.length) results.push(hits);
}

ROOTS.forEach(walk);

if (report) {
  console.table(results.map((r) => ({ file: r.file, emojiLines: r.emoji.length, hexLines: r.hex.length })));
  const e = results.reduce((n, r) => n + r.emoji.length, 0);
  const h = results.reduce((n, r) => n + r.hex.length, 0);
  console.log(`Total: ${e} emoji lines, ${h} hex lines in ${results.length} files`);
  process.exit(0);
}

if (results.length) {
  for (const r of results) {
    if (r.emoji.length) console.error(`${r.file}: emoji on lines ${r.emoji.join(', ')}`);
    if (r.hex.length) console.error(`${r.file}: hardcoded hex color on lines ${r.hex.join(', ')} (use @kidzo/ui-tokens)`);
  }
  console.error(`\ncheck-style failed: ${results.length} file(s). Use the Icon wrapper or art keys, and token colors.`);
  process.exit(1);
}
console.log('check-style passed: no emoji or hardcoded hex colors in source.');
