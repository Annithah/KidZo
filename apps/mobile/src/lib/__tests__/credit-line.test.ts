import { describe, expect, it } from 'vitest';
import { creditLine } from '../credit-line';

describe('creditLine', () => {
  it('does not repeat an author or license the attribution already names', () => {
    expect(
      creditLine({ author: 'Daniel Baumgartner', attribution: 'Daniel Baumgartner, CC BY 3.0, via Wikimedia Commons', license: 'CC BY 3.0' }),
    ).toBe('Daniel Baumgartner, CC BY 3.0, via Wikimedia Commons');
  });

  it('adds the author and license when the attribution leaves them out', () => {
    expect(creditLine({ author: 'NASA/JPL', attribution: 'Courtesy of NASA', license: 'Public Domain' })).toBe('NASA/JPL · Courtesy of NASA · Public Domain');
    expect(creditLine({ author: null, attribution: '', license: 'Pexels License' })).toBe('Pexels License');
  });
});
