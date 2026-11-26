import { describe, expect, it } from 'vitest';
import { ART_KEYS, artToSvg } from '../src';

describe('artToSvg', () => {
  it('renders every art key as standalone SVG with token colors', () => {
    for (const key of ART_KEYS) {
      const svg = artToSvg(key, 256);
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="256"')).toBe(true);
      expect(svg).toMatch(/(fill|stroke)="#[0-9A-Fa-f]{6}"/);
      expect(svg).not.toContain('undefined');
    }
  });

  it('repeats the drawing for counted keys like object.apple*3', () => {
    const one = artToSvg('object.apple');
    const three = artToSvg('object.apple*3');
    expect(three.length).toBeGreaterThan(one.length * 2);
  });
});
