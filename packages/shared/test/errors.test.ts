import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { contentInputSchema, createChildSchema, errorsUnder, friendlyFieldErrors, friendlyMessage, loginSchema, stickerInputSchema } from '../src';

const errorsFor = (schema: z.ZodType, data: unknown) => {
  const r = schema.safeParse(data);
  return r.success ? {} : friendlyFieldErrors(r.error.issues);
};

describe('friendly validation messages', () => {
  it('turns the raw "name.en: Too small" message into plain words', () => {
    const errors = errorsFor(stickerInputSchema, { slug: 'Ocean Pearl', name: { en: '' }, art: 'sticker.ocean-pearl', color: '#FFC83D' });
    expect(errors['name.en']).toBe('Please enter an English name');
    expect(errors.slug).toBe('Use lowercase words with hyphens, like ocean-pearl');
  });

  it('explains numbers, lists and emails', () => {
    expect(errorsFor(createChildSchema, { name: '', age: 1, avatar: 'fox' })).toMatchObject({ name: 'Please enter a name', age: 'Age must be at least 2' });
    expect(errorsFor(loginSchema, { email: 'nope', password: '' }).email).toBe('Enter an email address like name@example.com');
  });

  it('keeps hand written refine messages', () => {
    const errors = errorsFor(contentInputSchema, {
      slug: 'ok', type: 'story', title: { en: 'T' }, summary: { en: 'S' }, ageMin: 9, ageMax: 4, durationMinutes: 5,
      skills: ['kindness'], languages: ['en'], coverArt: 'object.moon', coverColor: '#4DB8FF', calm: false, rewardStars: 5,
      body: { kind: 'branching', startNodeId: 'a', nodes: [{ id: 'a', text: { en: '' }, scene: { art: 'object.moon', color: '#4DB8FF' }, ending: true }] },
    });
    expect(errors.ageMax).toBe('Minimum age must not exceed maximum age');
    expect(errors['body.nodes.0.text.en']).toBe('Please enter English story text');
    expect(errorsUnder(errors, 'body.nodes.0')).toEqual(['Please enter English story text']);
  });

  it('maps server details that only carry a path and message', () => {
    expect(friendlyMessage({ path: 'title.fr', code: 'too_small', origin: 'string', minimum: 1, message: 'Too small: expected string to have >=1 characters' })).toBe('Please enter a French title');
  });
});
