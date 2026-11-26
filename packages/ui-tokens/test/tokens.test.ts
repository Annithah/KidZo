import { describe, expect, it } from 'vitest';
import { SCALE_STEPS, base, buildScale, categoryFor, contrast, cssVariables, luminance, onColor, palette, themes } from '../src';

const AA = 4.5;
const AA_LARGE = 3;

describe('scales', () => {
  it('builds 50 to 900 for every color with 500 as the base', () => {
    for (const [name, hex] of Object.entries(base)) {
      const scale = palette[name as keyof typeof base];
      expect(Object.keys(scale).map(Number)).toEqual([...SCALE_STEPS]);
      expect(scale[500]).toBe(hex.toUpperCase());
    }
  });

  it('gets darker from 50 to 900', () => {
    const s = buildScale(base.coral);
    const l = SCALE_STEPS.map((step) => luminance(s[step]));
    for (let i = 1; i < l.length; i += 1) expect(l[i]!).toBeLessThan(l[i - 1]!);
  });
});

describe('contrast (WCAG AA)', () => {
  for (const theme of Object.values(themes)) {
    describe(theme.name, () => {
      it('body text on background, surface and sunken surface', () => {
        for (const bg of [theme.background, theme.surface, theme.surfaceSunken]) {
          expect(contrast(theme.text, bg)).toBeGreaterThanOrEqual(AA);
          expect(contrast(theme.textMuted, bg)).toBeGreaterThanOrEqual(AA);
        }
      });
      it('label on the primary button', () => {
        expect(contrast(theme.onPrimary, theme.primary)).toBeGreaterThanOrEqual(AA);
      });
      it('accent, error, success and warning text on their surfaces', () => {
        expect(contrast(theme.accentText, theme.background)).toBeGreaterThanOrEqual(AA);
        expect(contrast(theme.errorText, theme.errorSurface)).toBeGreaterThanOrEqual(AA);
        expect(contrast(theme.successText, theme.successSurface)).toBeGreaterThanOrEqual(AA);
        expect(contrast(theme.warningText, theme.warningSurface)).toBeGreaterThanOrEqual(AA);
        expect(contrast(theme.infoText, theme.infoSurface)).toBeGreaterThanOrEqual(AA);
      });
      it('subtle text and focus ring stay visible (3:1 for non-text)', () => {
        expect(contrast(theme.textSubtle, theme.surface)).toBeGreaterThanOrEqual(AA_LARGE);
        expect(contrast(theme.focus, theme.background)).toBeGreaterThanOrEqual(AA_LARGE);
      });
    });
  }

  it('white on brand coral fails, which is why buttons use Navy Ink labels', () => {
    expect(contrast('#FFFFFF', base.coral)).toBeLessThan(AA_LARGE);
    expect(contrast(base.navy, base.coral)).toBeGreaterThanOrEqual(AA);
  });

  it('onColor picks a readable label for every world color', () => {
    for (const name of ['sky', 'mint', 'grape', 'bubblegum', 'tangerine', 'leaf', 'star', 'coral', 'lavender'] as const) {
      expect(contrast(onColor(base[name]), base[name])).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });
});

describe('categories', () => {
  it('maps content to the brief categories', () => {
    expect(categoryFor({ type: 'story', calm: true, skills: ['kindness'] }).key).toBe('bedtime');
    expect(categoryFor({ type: 'game', calm: false, skills: ['counting'] }).key).toBe('brain-games');
    expect(categoryFor({ type: 'song', calm: false, skills: ['music'] }).key).toBe('music-dance');
    expect(categoryFor({ type: 'story', calm: false, skills: ['creativity'] }).key).toBe('creative-world');
  });
});

describe('css variables', () => {
  it('emits scales, theme roles and shadows', () => {
    const css = cssVariables();
    expect(css).toContain('--coral-500: #FF6B4A;');
    expect(css).toContain('--on-primary: #17233F;');
    expect(css).toContain('--shadow-2:');
  });
});
