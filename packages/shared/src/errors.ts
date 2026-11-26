/**
 * Friendly validation messages. Turns Zod issues (client side) and API VALIDATION_ERROR details
 * (server side) into short sentences for people, keyed by field path, so forms can show each
 * message under its own field instead of raw "title.en: Too small" text.
 */

export interface IssueLike {
  path: readonly PropertyKey[] | string;
  message: string;
  code?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  origin?: string;
  format?: string;
  expected?: string;
  input?: unknown;
}

export type FieldErrors = Record<string, string>;

const LANGUAGES: Record<string, string> = { en: 'English', fr: 'French', rw: 'Kinyarwanda', sw: 'Kiswahili' };

const FIELD_LABELS: Record<string, string> = {
  name: 'name',
  displayName: 'name',
  title: 'title',
  summary: 'summary',
  slug: 'slug',
  email: 'email address',
  password: 'password',
  newPassword: 'new password',
  currentPassword: 'current password',
  pin: 'PIN',
  token: 'reset code',
  age: 'age',
  ageMin: 'minimum age',
  ageMax: 'maximum age',
  durationMinutes: 'length in minutes',
  rewardStars: 'reward stars',
  skills: 'skill',
  languages: 'language',
  coverArt: 'cover picture',
  coverColor: 'cover color',
  art: 'picture',
  color: 'color',
  text: 'story text',
  label: 'label',
  prompt: 'question',
  options: 'answer',
  questions: 'question',
  lines: 'line',
  nodes: 'scene',
  choices: 'choice',
  videoUrl: 'video link',
  audioUrl: 'audio link',
  startNodeId: 'start scene',
  next: 'next scene',
  correctOptionId: 'correct answer',
  avatar: 'avatar',
  locale: 'language',
};

const isDefaultZodMessage = (m: string) => /^(Too small|Too big|Invalid|Expected|Required|Unrecognized)/i.test(m);

const MASS_NOUNS = /(text|info)$/;
const a = (word: string, noun = word) => (MASS_NOUNS.test(noun) ? word : /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const pathKey = (path: IssueLike['path']): string => (typeof path === 'string' ? path : path.map(String).join('.')) || '_form';

/** Label of the field a path points at, for example "body.nodes.2.text.en" is "story text". */
function fieldOf(segments: string[]): { label: string; language: string | null } {
  const last = segments[segments.length - 1] ?? '';
  const language = LANGUAGES[last] ? last : null;
  const named = [...segments].reverse().find((s) => Number.isNaN(Number(s)) && !LANGUAGES[s]) ?? '';
  return { label: FIELD_LABELS[named] ?? named.replace(/([A-Z])/g, ' $1').toLowerCase().trim() ?? 'field', language };
}

/** One friendly sentence for one validation issue. */
export function friendlyMessage(issue: IssueLike): string {
  if (!isDefaultZodMessage(issue.message)) return issue.message;
  const segments = (typeof issue.path === 'string' ? issue.path.split('.') : issue.path.map(String)).filter(Boolean);
  const { label, language } = fieldOf(segments);
  const lang = language ? LANGUAGES[language] : null;
  const min = issue.minimum !== undefined ? Number(issue.minimum) : undefined;
  const max = issue.maximum !== undefined ? Number(issue.maximum) : undefined;
  const last = segments[segments.length - 1];

  if (last === 'slug' || issue.format === 'regex' && last === 'slug') return 'Use lowercase words with hyphens, like ocean-pearl';
  if (last === 'email' || issue.format === 'email') return 'Enter an email address like name@example.com';
  if (last === 'pin') return 'Use exactly 4 numbers';

  switch (issue.code) {
    case 'too_small':
      if (issue.origin === 'array') return min && min > 1 ? `Pick at least ${min} ${label}s` : `Pick at least one ${label}`;
      if (issue.origin === 'number') return `${cap(label)} must be at least ${min}`;
      if (!min || min <= 1) return lang ? `Please enter ${a(lang, label)} ${label}` : `Please enter ${a(label)}`;
      return `${cap(label)} needs at least ${min} characters`;
    case 'too_big':
      if (issue.origin === 'array') return `Pick up to ${max} ${label}s`;
      if (issue.origin === 'number') return `${cap(label)} can be at most ${max}`;
      return `${cap(label)} can be up to ${max} characters`;
    case 'invalid_type':
      if (issue.input === undefined || issue.input === null || issue.input === '') return lang ? `Please enter ${a(lang, label)} ${label}` : `Please fill in the ${label}`;
      return `Please check the ${label}`;
    case 'invalid_value':
      return `Please choose ${a(label)}`;
    case 'invalid_format':
      if (issue.format === 'url') return 'Enter a full link starting with https://';
      return `Please check the ${label}`;
    default:
      return `Please check the ${label}`;
  }
}

/** Groups issues by field path, keeping the first message for each field. */
export function friendlyFieldErrors(issues: readonly IssueLike[]): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) out[pathKey(issue.path)] ??= friendlyMessage(issue);
  return out;
}

/** Errors for one field or any of its children, for example everything under "body.nodes.2". */
export const errorsUnder = (errors: FieldErrors, prefix: string): string[] =>
  Object.entries(errors)
    .filter(([k]) => k === prefix || k.startsWith(`${prefix}.`))
    .map(([, v]) => v);
