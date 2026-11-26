/**
 * Legacy emoji values from before the art library, mapped to art keys. Used by the database
 * migration, by devices upgrading downloaded content, and nowhere else. This is the only
 * source file allowed to contain emoji (see scripts/check-style.mjs).
 */

export const LEGACY_EMOJI_TO_ART: Record<string, string> = {
  '🦋': 'object.butterfly',
  '🖌️': 'object.brush',
  '🖌': 'object.brush',
  '☁️': 'object.cloud',
  '☁': 'object.cloud',
  '🐢': 'object.turtle',
  '⭐': 'object.star',
  '🌟': 'object.sparkle-star',
  '✨': 'object.sparkles',
  '🦊': 'object.fox',
  '🔷': 'object.diamond',
  '🐚': 'object.shell',
  '🌸': 'object.flower',
  '🌙': 'object.moon',
  '🌕': 'object.full-moon',
  '👋': 'object.wave-hand',
  '🎵': 'object.music-note',
  '🎶': 'object.music-note',
  '🐝': 'object.bee',
  '☀️': 'object.sun',
  '☀': 'object.sun',
  '🪞': 'object.mirror',
  '🌈': 'object.rainbow',
  '🍎': 'object.apple',
  '🌊': 'object.ocean-wave',
  '🍌': 'object.banana',
  '🐤': 'object.chick',
  '🐥': 'object.chick',
  '🏖️': 'object.beach',
  '🏖': 'object.beach',
  '🌬️': 'object.wind',
  '🌬': 'object.wind',
  '🤝': 'object.friends',
  '🐙': 'object.octopus',
  '👣': 'object.footprints',
  '⏳': 'object.hourglass',
  '🐠': 'object.fish',
  '🐟': 'object.fish',
  '🐳': 'object.whale',
  '😴': 'zo.sleepy',
  '🐼': 'object.panda',
  '🦒': 'object.giraffe',
  '🦛': 'object.hippo',
  '🦁': 'object.lion',
  '🐞': 'object.ladybug',
  '🍕': 'object.pizza',
  '⚪': 'object.circle',
  '🔺': 'object.triangle',
  '🟦': 'object.square',
  '🎁': 'object.gift',
  '❤️': 'object.heart',
  '❤': 'object.heart',
  '🔢': 'object.numbers',
  '❓': 'object.question',
  '🅰️': 'object.letter-a',
  '🅱️': 'object.letter-b',
  '🚀': 'object.rocket',
  '🐱': 'object.cat',
  '🦉': 'object.owl',
  '🐰': 'object.bunny',
  '🦄': 'object.unicorn',
};

const FALLBACK = 'object.sparkles';
const ART_KEY = /^[a-z]+(\.[a-z0-9-]+)+(\*[1-9])?$/;

const graphemes = (s: string): string[] => {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return [...new Seg(undefined, { granularity: 'grapheme' }).segment(s)].map((x) => x.segment);
  return [...s];
};

/** Converts one legacy emoji value ("🍎🍎🍎") to an art key ("object.apple*3"). Keys pass through. */
export function emojiToArt(value: string | null | undefined): string {
  if (!value) return FALLBACK;
  if (ART_KEY.test(value)) return value;
  const parts = graphemes(value.trim()).filter((g) => g.trim() !== '');
  const first = parts[0] ?? '';
  const key = LEGACY_EMOJI_TO_ART[first] ?? LEGACY_EMOJI_TO_ART[first.replace(/️/g, '')] ?? FALLBACK;
  const same = parts.length > 1 && parts.every((p) => p === first);
  return same ? `${key}*${Math.min(9, parts.length)}` : key;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Moves `emoji` to `art` on one object, converting the value. */
function upgradeNode<T>(node: T): T {
  if (!isObj(node) || !('emoji' in node)) return node;
  const { emoji, ...rest } = node;
  return { ...rest, art: typeof rest.art === 'string' ? rest.art : emojiToArt(emoji as string) } as T;
}

/** Upgrades a content body (branching, quiz or song) in place of legacy emoji fields. */
export function upgradeLegacyBody<T>(body: T): T {
  if (!isObj(body)) return body;
  if (Array.isArray(body.nodes)) {
    return {
      ...body,
      nodes: body.nodes.map((n: unknown) => {
        if (!isObj(n)) return n;
        const scene = upgradeNode(n.scene);
        const choices = Array.isArray(n.choices) ? n.choices.map(upgradeNode) : n.choices;
        return { ...n, scene, choices };
      }),
    } as T;
  }
  if (Array.isArray(body.questions)) {
    return {
      ...body,
      questions: body.questions.map((q: unknown) => {
        const up = upgradeNode(q) as Json;
        return isObj(up) && Array.isArray(up.options) ? { ...up, options: up.options.map(upgradeNode) } : up;
      }),
    } as T;
  }
  if (Array.isArray(body.lines)) return { ...body, lines: body.lines.map(upgradeNode) } as T;
  return body;
}

/** Upgrades a content summary or detail: coverEmoji to coverArt plus the body. */
export function upgradeLegacyContent<T>(item: T): T {
  if (!isObj(item)) return item;
  let out: Json = item;
  if ('coverEmoji' in out) {
    const { coverEmoji, ...rest } = out;
    out = { ...rest, coverArt: typeof rest.coverArt === 'string' ? rest.coverArt : emojiToArt(coverEmoji as string) };
  }
  if ('body' in out) out = { ...out, body: upgradeLegacyBody(out.body) };
  return out as T;
}

/** Upgrades a sticker: emoji to art, keyed by slug when a matching sticker art exists. */
export function upgradeLegacySticker<T>(sticker: T, knownKeys?: ReadonlySet<string>): T {
  if (!isObj(sticker) || !('emoji' in sticker)) return sticker;
  const { emoji, ...rest } = sticker;
  const bySlug = typeof rest.slug === 'string' ? `sticker.${rest.slug}` : '';
  const art = typeof rest.art === 'string' ? rest.art : knownKeys?.has(bySlug) ? bySlug : emojiToArt(emoji as string);
  return { ...rest, art } as T;
}

/** True when a JSON value still carries legacy emoji fields. */
export const hasLegacyFields = (value: unknown): boolean => /"(emoji|coverEmoji)"\s*:/.test(JSON.stringify(value ?? null));
