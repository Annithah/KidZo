/** Stickers, category badges, avatars, wardrobe, Zo, scenes and brand motifs. */
import { C, E, HL, L, P, R, U, cloud, face, roundStar, sparkle, type Mood } from '../draw';
import type { ArtDef, Shape } from '../types';
import { ANIMAL_HEADS } from './objects';

// ---------------------------------------------------------------------------
// Stickers: die-cut look is added by the renderer; each sticker names its object and world.
// ---------------------------------------------------------------------------

export const STICKERS: { slug: string; label: string; object: string; world: string }[] = [
  { slug: 'moonbeam-butterfly', label: 'Moonbeam Butterfly', object: 'butterfly', world: 'grape' },
  { slug: 'rainbow-brush', label: 'Rainbow Brush', object: 'brush', world: 'bubblegum' },
  { slug: 'sleepy-cloud', label: 'Sleepy Cloud', object: 'cloud', world: 'sky' },
  { slug: 'brave-shell', label: 'Brave Shell', object: 'turtle', world: 'mint' },
  { slug: 'counting-star', label: 'Counting Star', object: 'star', world: 'star' },
  { slug: 'animal-pal', label: 'Animal Pal', object: 'fox', world: 'tangerine' },
  { slug: 'shape-shifter', label: 'Shape Shifter', object: 'diamond', world: 'sky' },
  { slug: 'ocean-pearl', label: 'Ocean Pearl', object: 'shell', world: 'lavender' },
  { slug: 'busy-bee', label: 'Busy Bee', object: 'bee', world: 'star' },
  { slug: 'kind-heart', label: 'Kind Heart', object: 'heart', world: 'bubblegum' },
  { slug: 'tiny-rocket', label: 'Tiny Rocket', object: 'rocket', world: 'grape' },
  { slug: 'sunny-day', label: 'Sunny Day', object: 'sun', world: 'tangerine' },
];

const stickers: ArtDef[] = STICKERS.map((s) => ({
  key: `sticker.${s.slug}`,
  label: s.label,
  group: 'sticker',
  world: s.world,
  shapes: [U(`object.${s.object}`, 14, 14, 0.72)],
}));

// ---------------------------------------------------------------------------
// Category badges: blob in the world color with an emblem.
// ---------------------------------------------------------------------------

const blob = (f: string, deep: string): Shape[] => [
  P('M50 4 Q80 4 92 26 Q100 46 92 70 Q80 96 50 96 Q18 96 8 70 Q0 46 10 24 Q22 4 50 4 Z', deep, { k: 'sh' }),
  P('M50 4 Q80 4 92 26 Q100 44 92 66 Q80 90 50 90 Q18 90 8 66 Q0 44 10 24 Q22 4 50 4 Z', f),
  HL(30, 18, 12, 4),
];

const categories: ArtDef[] = [
  {
    key: 'category.morning-activities',
    label: 'Morning Activities',
    group: 'category',
    shapes: [...blob('tangerine.300', 'tangerine.500'), U('object.sun', 24, 8, 0.52), P('M6 70 Q30 52 54 66 Q74 52 96 66 L92 70 Q80 90 50 90 Q18 90 8 70 Z', 'leaf.400', { k: 'sh' })],
  },
  { key: 'category.family-fun', label: 'Family Fun', group: 'category', shapes: [...blob('bubblegum.300', 'bubblegum.500'), U('object.house', 22, 16, 0.56)] },
  {
    key: 'category.magical-adventures',
    label: 'Magical Adventures',
    group: 'category',
    shapes: [...blob('grape.300', 'grape.500'), U('object.wand', 18, 14, 0.62), sparkle(78, 24, 6, 'paper'), sparkle(24, 70, 5, 'paper')],
  },
  { key: 'category.learning', label: 'Learning', group: 'category', shapes: [...blob('sky.300', 'sky.500'), U('object.book', 18, 18, 0.64)] },
  { key: 'category.music-dance', label: 'Music & Dance', group: 'category', shapes: [...blob('star.300', 'star.500'), U('object.music-note', 20, 14, 0.6)] },
  { key: 'category.brain-games', label: 'Brain Games', group: 'category', shapes: [...blob('mint.300', 'mint.500'), U('object.puzzle', 20, 16, 0.6)] },
  { key: 'category.creative-world', label: 'Creative World', group: 'category', shapes: [...blob('leaf.300', 'leaf.500'), U('object.palette', 20, 16, 0.6)] },
  {
    key: 'category.bedtime',
    label: 'Bedtime',
    group: 'category',
    shapes: [...blob('dusk.500', 'night.500'), U('object.moon', 22, 14, 0.58), sparkle(76, 26, 6, 'moon.500'), sparkle(70, 64, 4, 'moon.400'), sparkle(28, 72, 4, 'moon.400')],
  },
];

// ---------------------------------------------------------------------------
// Avatars: portrait on a soft disc. Wardrobe layers stack on the same 100 x 100 canvas.
// ---------------------------------------------------------------------------

const AVATAR_WORLD: Record<string, string> = { fox: 'tangerine', panda: 'mint', owl: 'grape', bunny: 'bubblegum', lion: 'star', turtle: 'leaf', whale: 'sky', unicorn: 'lavender' };

const avatars: ArtDef[] = ANIMAL_HEADS.map((a) => ({
  key: `avatar.${a}`,
  label: a[0]!.toUpperCase() + a.slice(1),
  group: 'avatar',
  world: AVATAR_WORLD[a],
  shapes: [C(50, 50, 48, `${AVATAR_WORLD[a]}.100`, { k: 'sh' }), U(`object.${a}`, 10, 12, 0.8)],
}));

const wardrobe: ArtDef[] = [
  {
    key: 'wardrobe.cape',
    label: 'Hero cape',
    group: 'wardrobe',
    layer: 'back',
    shapes: [P('M22 58 Q10 86 16 98 L84 98 Q90 86 78 58 Z', 'coral.500'), P('M22 58 Q30 70 50 70 Q70 70 78 58 L74 62 Q50 80 26 62 Z', 'coral.700', { k: 'sh' })],
  },
  {
    key: 'wardrobe.glasses',
    label: 'Round glasses',
    group: 'wardrobe',
    layer: 'face',
    shapes: [C(38, 52, 9, 'sky.100', { o: 0.55, k: 'sh' }), C(62, 52, 9, 'sky.100', { o: 0.55, k: 'sh' }), L('M29 52 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M53 52 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M47 51 q3 -3 6 0', 'navy', 3)],
  },
  {
    key: 'wardrobe.party-hat',
    label: 'Party hat',
    group: 'wardrobe',
    layer: 'top',
    shapes: [P('M34 26 L52 -2 L66 24 Z', 'grape.500'), L('M40 18 L58 12 M46 8 L56 4', 'star.400', 3), C(52, -2, 5, 'star.500'), E(50, 25, 17, 4, 'grape.700', { k: 'sh' })],
  },
  {
    key: 'wardrobe.crown',
    label: 'Star crown',
    group: 'wardrobe',
    layer: 'top',
    shapes: [P('M28 26 L32 6 L42 18 L50 2 L58 18 L68 6 L72 26 Z', 'star.500', { s: 'star.500', sw: 3 }), R(28, 22, 44, 8, 3, 'star.600'), C(50, 26, 3, 'coral.500', { k: 'sh' }), C(38, 26, 2.4, 'sky.500', { k: 'sh' }), C(62, 26, 2.4, 'mint.500', { k: 'sh' })],
  },
];

// ---------------------------------------------------------------------------
// Zo, the star from the logo, in 6 expressions.
// ---------------------------------------------------------------------------

const zoBody = (mood: Mood, tilt = 0): Shape[] => {
  const body = roundStar(50, 54, 42, 21, 'star.500', 'star.600', 5, 9).map((s) => ({ ...s, rot: [tilt, 50, 54] as [number, number, number] }));
  return [...body, E(50, 68, 16, 7, 'star.600', { k: 'sh', o: 0.4 }), HL(38, 34, 7, 3), ...face(50, 54, 1, mood, 10)];
};


const zo: ArtDef[] = [
  { key: 'zo.happy', label: 'Zo happy', group: 'zo', shapes: zoBody('happy') },
  {
    key: 'zo.thinking',
    label: 'Zo thinking',
    group: 'zo',
    shapes: [...zoBody('think', -6), C(80, 18, 6, 'paper', { k: 'body' }), C(90, 8, 3.5, 'paper', { k: 'body' }), C(72, 28, 3, 'paper', { k: 'body' })],
  },
  {
    key: 'zo.cheering',
    label: 'Zo cheering',
    group: 'zo',
    shapes: [...zoBody('cheer'), sparkle(12, 18, 7, 'coral.400'), sparkle(88, 16, 6, 'sky.400'), sparkle(90, 86, 5, 'grape.400')],
  },
  {
    key: 'zo.sleepy',
    label: 'Zo sleepy',
    group: 'zo',
    shapes: [
      ...zoBody('sleepy', 8),
      P('M30 26 Q40 0 70 8 L64 26 Z', 'grape.400'),
      C(72, 6, 5, 'paper'),
      L('M78 34 h8 l-8 8 h8 M88 20 h6 l-6 6 h6', 'lavender.500', 2.6),
    ],
  },
  {
    key: 'zo.waving',
    label: 'Zo waving',
    group: 'zo',
    shapes: [...zoBody('happy', -10), L('M84 12 q8 6 6 16 M92 6 q10 10 6 24', 'coral.400', 3)],
  },
  {
    key: 'zo.celebrating',
    label: 'Zo celebrating',
    group: 'zo',
    shapes: [
      ...zoBody('cheer', 6),
      P('M38 18 L52 -6 L62 16 Z', 'coral.500'),
      C(52, -6, 4, 'star.300'),
      ...[[12, 30, 'sky.400'], [88, 34, 'mint.400'], [16, 80, 'bubblegum.400'], [86, 82, 'grape.400'], [26, 8, 'tangerine.400']].map(([x, y, f]) => R(Number(x), Number(y), 6, 10, 2, String(f), { rot: [Number(x) * 3, Number(x) + 3, Number(y) + 5] })),
    ],
  },
];

// ---------------------------------------------------------------------------
// Scenes for empty, error, offline, time up and bedtime states.
// ---------------------------------------------------------------------------

const ground = (f: string): Shape => P('M0 84 Q30 74 56 82 Q80 88 100 80 L100 100 L0 100 Z', f, { k: 'sh' });

const scenes: ArtDef[] = [
  {
    key: 'scene.empty',
    label: 'Nothing here yet',
    group: 'scene',
    shapes: [ground('star.100'), R(46, 52, 42, 32, 6, 'tangerine.300'), P('M46 52 L56 40 L98 40 L88 52 Z', 'tangerine.200'), U('zo.thinking', 2, 26, 0.6)],
  },
  {
    key: 'scene.error',
    label: 'Something went wrong',
    group: 'scene',
    shapes: [ground('star.100'), L('M60 30 q14 -10 20 4 q6 14 -10 14 q-14 0 -6 -14 q10 -16 26 -4', 'coral.400', 3), U('zo.thinking', 6, 24, 0.62)],
  },
  {
    key: 'scene.offline',
    label: 'No connection',
    group: 'scene',
    shapes: [ground('star.100'), ...cloud(70, 30, 0.6, 'sky.100', 'sky.200'), L('M56 16 L86 46', 'coral.500', 4), U('zo.happy', 4, 30, 0.58)],
  },
  {
    key: 'scene.time-up',
    label: 'Screen time is up',
    group: 'scene',
    shapes: [ground('sky.200'), U('object.hourglass', 62, 34, 0.42), U('zo.sleepy', 4, 22, 0.64)],
  },
  {
    key: 'scene.bedtime',
    label: 'Bedtime',
    group: 'scene',
    shapes: [
      U('object.moon', 66, 2, 0.32),
      ...([[12, 14], [40, 8], [56, 26], [88, 46]] as const).map(([x, y]) => sparkle(x, y, 3.5, 'moon.400')),
      ...cloud(46, 76, 0.9, 'lavender.200', 'lavender.300'),
      U('zo.sleepy', 20, 30, 0.54),
    ],
  },
  {
    key: 'scene.celebrate',
    label: 'Well done',
    group: 'scene',
    shapes: [P('M10 96 Q50 60 90 96 Z', 'star.200', { k: 'sh' }), U('zo.celebrating', 14, 10, 0.72)],
  },
];

// ---------------------------------------------------------------------------
// Brand motifs from the logo.
// ---------------------------------------------------------------------------

const motifs: ArtDef[] = [
  { key: 'motif.swoosh', label: 'Swoosh', group: 'motif', shapes: [L('M6 70 Q40 96 94 40', 'coral.500', 9), L('M20 74 Q46 90 80 60', 'coral.300', 4, { o: 0.6 })] },
  { key: 'motif.star', label: 'Logo star', group: 'motif', shapes: [...roundStar(50, 50, 40, 19, 'star.500', 'star.600', 5, 8), HL(40, 36, 7, 3)] },
  {
    key: 'motif.hills',
    label: 'Rolling hills',
    group: 'motif',
    shapes: [P('M0 70 Q25 50 50 66 Q75 50 100 64 L100 100 L0 100 Z', 'leaf.300', { k: 'sh' }), P('M0 82 Q30 68 60 80 Q82 70 100 78 L100 100 L0 100 Z', 'leaf.400', { k: 'sh' })],
  },
  {
    key: 'motif.night-sky',
    label: 'Night sky',
    group: 'motif',
    shapes: ([[10, 12, 3], [26, 40, 2], [44, 18, 4], [62, 34, 2.5], [80, 10, 3], [90, 44, 2], [70, 62, 3]] as const).map(([x, y, s]) => sparkle(x, y, s, 'moon.400')),
  },
];

export const characterArt: ArtDef[] = [...stickers, ...categories, ...avatars, ...wardrobe, ...zo, ...scenes, ...motifs];
export { AVATAR_WORLD };
