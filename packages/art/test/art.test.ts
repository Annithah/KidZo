import { describe, expect, it } from 'vitest';
import { palette } from '@kidzo/ui-tokens';
import {
  ART,
  ART_KEYS,
  ICON_NAMES,
  LEGACY_EMOJI_TO_ART,
  STICKERS,
  artKeysIn,
  artLabel,
  emojiToArt,
  getArt,
  hasLegacyFields,
  parseArtKey,
  resolvePaint,
  upgradeLegacyBody,
  upgradeLegacyContent,
  upgradeLegacySticker,
  type Shape,
} from '../src';

const paintsOf = (s: Shape): string[] => {
  const out: string[] = [];
  if ('f' in s && s.f) out.push(s.f);
  if ('s' in s && s.s) out.push(s.s);
  return out;
};

describe('art library', () => {
  it('has unique keys in every group the brief asks for', () => {
    expect(new Set(ART_KEYS).size).toBe(ART_KEYS.length);
    expect(artKeysIn('sticker').length).toBeGreaterThanOrEqual(8);
    expect(artKeysIn('category')).toHaveLength(8);
    expect(artKeysIn('avatar')).toHaveLength(8);
    expect(artKeysIn('zo')).toEqual(['zo.happy', 'zo.thinking', 'zo.cheering', 'zo.sleepy', 'zo.waving', 'zo.celebrating']);
    for (const s of ['scene.empty', 'scene.error', 'scene.offline', 'scene.time-up', 'scene.bedtime']) expect(ART.has(s)).toBe(true);
    expect(artKeysIn('wardrobe').length).toBeGreaterThanOrEqual(3);
  });

  it('only references art that exists and colors that are tokens', () => {
    for (const art of ART.values()) {
      expect(art.shapes.length).toBeGreaterThan(0);
      for (const shape of art.shapes) {
        if ('u' in shape) expect(ART.has(shape.u), `${art.key} uses ${shape.u}`).toBe(true);
        for (const paint of paintsOf(shape)) {
          const [name, step] = paint.split('.');
          expect(palette[name as keyof typeof palette], `${art.key} paint ${paint}`).toBeDefined();
          if (step) expect([50, 100, 200, 300, 400, 500, 600, 700, 800, 900]).toContain(Number(step));
          expect(resolvePaint(paint)).toMatch(/^#[0-9A-F]{6}$/);
        }
      }
    }
  });

  it('covers every seed sticker slug', () => {
    for (const slug of ['moonbeam-butterfly', 'rainbow-brush', 'sleepy-cloud', 'brave-shell', 'counting-star', 'animal-pal', 'shape-shifter', 'ocean-pearl']) {
      expect(ART.has(`sticker.${slug}`)).toBe(true);
    }
    expect(STICKERS.every((s) => ART.has(`object.${s.object}`))).toBe(true);
  });

  it('parses counts and labels', () => {
    expect(parseArtKey('object.apple*3')).toEqual({ key: 'object.apple', count: 3 });
    expect(artLabel('object.apple*3')).toBe('3 apple');
    expect(getArt('object.nope').key).toBe('object.sparkles');
  });

  it('has a distinct icon name list', () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
  });
});

describe('legacy emoji migration', () => {
  it('maps every legacy emoji to art that exists', () => {
    for (const [emoji, key] of Object.entries(LEGACY_EMOJI_TO_ART)) expect(ART.has(key), `${emoji} -> ${key}`).toBe(true);
  });

  it('converts repeated emoji into counts and passes keys through', () => {
    expect(emojiToArt('\u{1F34E}\u{1F34E}\u{1F34E}')).toBe('object.apple*3');
    expect(emojiToArt('⭐⭐⭐⭐⭐')).toBe('object.star*5');
    expect(emojiToArt('object.moon')).toBe('object.moon');
    expect(emojiToArt('\u{1F9FF}')).toBe('object.sparkles');
  });

  it('upgrades bodies, content and stickers', () => {
    const body = upgradeLegacyBody({
      kind: 'branching',
      startNodeId: 'a',
      nodes: [{ id: 'a', scene: { emoji: '\u{1F319}', color: '#24264A', videoUrl: null }, choices: [{ id: 'c', emoji: '☀️', next: 'b' }] }],
    });
    expect(body.nodes[0]).toMatchObject({ scene: { art: 'object.moon' }, choices: [{ art: 'object.sun' }] });
    expect(hasLegacyFields(body)).toBe(false);

    const quiz = upgradeLegacyBody({ kind: 'quiz', questions: [{ id: 'q', emoji: '❓', options: [{ id: 'a', emoji: '\u{1F98A}' }] }] });
    expect(quiz.questions[0]).toMatchObject({ art: 'object.question', options: [{ art: 'object.fox' }] });

    const item = upgradeLegacyContent({ coverEmoji: '\u{1F338}', body: { kind: 'song', lines: [{ emoji: '\u{1F3B5}' }] } });
    expect(item).toMatchObject({ coverArt: 'object.flower', body: { lines: [{ art: 'object.music-note' }] } });

    const sticker = upgradeLegacySticker({ slug: 'ocean-pearl', emoji: '\u{1F41A}' }, new Set(ART_KEYS));
    expect(sticker).toEqual({ slug: 'ocean-pearl', art: 'sticker.ocean-pearl' });
  });
});
