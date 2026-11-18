import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/en';
import { fr } from '../../i18n/fr';
import { rw } from '../../i18n/rw';
import { sw } from '../../i18n/sw';

const placeholders = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe.each([
  ['fr', fr],
  ['rw', rw],
  ['sw', sw],
])('%s translations', (_name, dict) => {
  it('has every key and no extras', () => {
    expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort());
  });

  it('keeps the same placeholders', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(placeholders(dict[key as keyof typeof en]), key).toEqual(placeholders(value));
    }
  });

  it('has no empty strings or em dashes', () => {
    for (const value of Object.values(dict)) {
      expect(value.trim().length).toBeGreaterThan(0);
      expect(value).not.toContain('—');
    }
  });
});

it('English has no em dashes', () => {
  for (const value of Object.values(en)) expect(value).not.toContain('—');
});
