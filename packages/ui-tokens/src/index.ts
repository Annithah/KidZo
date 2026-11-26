/**
 * KIDZO "Storybook Playground" design tokens. The only place in the codebase where raw
 * color values live. Mobile (React Native) and admin (CSS variables) both build from here.
 */
import { alpha, contrast, mix, type Hex } from './color';

export { alpha, contrast, luminance, mix, type Hex } from './color';

// ---------------------------------------------------------------------------
// Base colors
// ---------------------------------------------------------------------------

export const base = {
  // Brand, anchored on the logo: coral swoosh, yellow star, navy wordmark.
  coral: '#FF6B4A',
  star: '#FFC83D',
  navy: '#17233F',
  cream: '#FFF8EC',
  paper: '#FFFFFF',
  // Secondary world colors, one per category.
  sky: '#4DB8FF',
  mint: '#34C99A',
  grape: '#8E6CFF',
  bubblegum: '#FF7EB6',
  tangerine: '#FF9F43',
  leaf: '#7BC74D',
  // Feedback.
  success: '#2FBF71',
  warning: '#FFB020',
  error: '#F04E4E',
  info: '#4DB8FF',
  // Bedtime.
  night: '#1E2147',
  dusk: '#2C2F63',
  moon: '#F6E7A1',
  lavender: '#A79BE8',
} as const satisfies Record<string, Hex>;

export type ColorName = keyof typeof base;
export const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export type ScaleStep = (typeof SCALE_STEPS)[number];
export type Scale = Record<ScaleStep, Hex>;

/** Deep ink used to build shades, so dark steps stay warm and on-brand instead of grey. */
const INK = '#0B1228';
const WHITE = '#FFFFFF';
const TINT: Record<ScaleStep, number> = { 50: 0.92, 100: 0.84, 200: 0.68, 300: 0.5, 400: 0.26, 500: 0, 600: 0.16, 700: 0.32, 800: 0.48, 900: 0.64 };

/** 50 to 400 mix toward white, 500 is the base, 600 to 900 mix toward deep ink. */
export function buildScale(hex: string): Scale {
  const out = {} as Scale;
  for (const step of SCALE_STEPS) {
    const t = TINT[step];
    out[step] = step < 500 ? mix(hex, WHITE, t) : step === 500 ? (hex.toUpperCase() as Hex) : mix(hex, INK, t);
  }
  return out;
}

export const palette = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, buildScale(v)])) as Record<ColorName, Scale>;

/** Lightest step (500 and darker) that reaches the target contrast on a background. */
export function readableShade(name: ColorName, background: string, target = 4.5): Hex {
  for (const step of [500, 600, 700, 800, 900] as const) {
    if (contrast(palette[name][step], background) >= target) return palette[name][step];
  }
  return palette[name][900];
}

/** Navy Ink or white, whichever reads better on a color. Used for art covers chosen by admins. */
export function onColor(background: string): Hex {
  return contrast(base.navy, background) >= contrast(WHITE, background) ? base.navy : WHITE;
}

// ---------------------------------------------------------------------------
// Worlds and categories
// ---------------------------------------------------------------------------

export const WORLD_COLORS = ['sky', 'mint', 'grape', 'bubblegum', 'tangerine', 'leaf', 'star', 'coral'] as const;
export type WorldColor = (typeof WORLD_COLORS)[number];

export const CATEGORIES = [
  { key: 'morning-activities', label: 'Morning Activities', world: 'tangerine', art: 'category.morning-activities' },
  { key: 'family-fun', label: 'Family Fun', world: 'bubblegum', art: 'category.family-fun' },
  { key: 'magical-adventures', label: 'Magical Adventures', world: 'grape', art: 'category.magical-adventures' },
  { key: 'learning', label: 'Learning', world: 'sky', art: 'category.learning' },
  { key: 'music-dance', label: 'Music & Dance', world: 'star', art: 'category.music-dance' },
  { key: 'brain-games', label: 'Brain Games', world: 'mint', art: 'category.brain-games' },
  { key: 'creative-world', label: 'Creative World', world: 'leaf', art: 'category.creative-world' },
  { key: 'bedtime', label: 'Bedtime', world: 'lavender', art: 'category.bedtime' },
] as const satisfies readonly { key: string; label: string; world: ColorName; art: string }[];
export type CategoryKey = (typeof CATEGORIES)[number]['key'];

/** Display category for an existing skill. The data model has skills, not categories. */
export const SKILL_CATEGORY: Record<string, CategoryKey> = {
  problem_solving: 'brain-games',
  kindness: 'family-fun',
  counting: 'learning',
  letters: 'learning',
  colors: 'creative-world',
  shapes: 'learning',
  music: 'music-dance',
  nature: 'morning-activities',
  feelings: 'family-fun',
  creativity: 'creative-world',
  sharing: 'family-fun',
  bravery: 'magical-adventures',
  calm: 'bedtime',
  animals: 'morning-activities',
  science: 'learning',
  math: 'brain-games',
  space: 'magical-adventures',
  geography: 'learning',
  habits: 'morning-activities',
  language: 'learning',
};

/** Display category for a content item: calm wins, then type, then its first skill. */
export function categoryFor(item: { type: string; calm: boolean; skills: readonly string[] }): (typeof CATEGORIES)[number] {
  const key: CategoryKey = item.calm
    ? 'bedtime'
    : item.type === 'game'
      ? 'brain-games'
      : item.type === 'song'
        ? 'music-dance'
        : item.type === 'adventure'
          ? 'magical-adventures'
          : (SKILL_CATEGORY[item.skills[0] ?? ''] ?? 'learning');
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[3];
}

export const CONTENT_TYPE_WORLD: Record<string, ColorName> = { adventure: 'grape', story: 'sky', song: 'star', game: 'mint' };

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

export interface Theme {
  name: 'light' | 'bedtime' | 'admin';
  isCalm: boolean;
  background: Hex;
  backgroundDeep: Hex;
  surface: Hex;
  surfaceRaised: Hex;
  surfaceSunken: Hex;
  text: Hex;
  textMuted: Hex;
  textSubtle: Hex;
  line: Hex;
  lineStrong: Hex;
  primary: Hex;
  primaryEdge: Hex;
  onPrimary: Hex;
  accent: Hex;
  accentText: Hex;
  focus: Hex;
  shadowTint: Hex;
  success: Hex;
  successText: Hex;
  successSurface: Hex;
  warningSurface: Hex;
  warningText: Hex;
  error: Hex;
  errorText: Hex;
  errorSurface: Hex;
  infoSurface: Hex;
  infoText: Hex;
}

const light: Theme = {
  name: 'light',
  isCalm: false,
  background: base.cream,
  backgroundDeep: mix(base.cream, base.star, 0.18),
  surface: base.paper,
  surfaceRaised: base.paper,
  surfaceSunken: mix(base.cream, base.coral, 0.06),
  text: base.navy,
  textMuted: mix(base.navy, base.cream, 0.3),
  textSubtle: mix(base.navy, base.cream, 0.45),
  line: mix(base.navy, base.cream, 0.86),
  lineStrong: mix(base.navy, base.cream, 0.72),
  primary: base.coral,
  primaryEdge: palette.coral[700],
  onPrimary: base.navy,
  accent: base.star,
  accentText: readableShade('coral', base.cream),
  focus: readableShade('sky', base.cream, 3.2),
  shadowTint: palette.coral[800],
  success: base.success,
  successText: readableShade('success', palette.success[50]),
  successSurface: palette.success[50],
  warningSurface: palette.warning[50],
  warningText: readableShade('warning', palette.warning[50]),
  error: base.error,
  errorText: readableShade('error', palette.error[50]),
  errorSurface: palette.error[50],
  infoSurface: palette.sky[50],
  infoText: base.navy,
};

const bedtime: Theme = {
  name: 'bedtime',
  isCalm: true,
  background: base.night,
  backgroundDeep: mix(base.night, INK, 0.4),
  surface: base.dusk,
  surfaceRaised: mix(base.dusk, base.lavender, 0.16),
  surfaceSunken: mix(base.night, INK, 0.25),
  text: mix(base.moon, WHITE, 0.6),
  textMuted: palette.lavender[200],
  textSubtle: palette.lavender[300],
  line: mix(base.dusk, base.lavender, 0.3),
  lineStrong: mix(base.dusk, base.lavender, 0.5),
  primary: base.moon,
  primaryEdge: palette.moon[700],
  onPrimary: base.night,
  accent: base.moon,
  accentText: base.moon,
  focus: base.moon,
  shadowTint: INK as Hex,
  success: palette.mint[300],
  successText: palette.mint[200],
  successSurface: mix(base.dusk, base.mint, 0.2),
  warningSurface: mix(base.dusk, base.moon, 0.2),
  warningText: base.moon,
  error: palette.error[300],
  errorText: palette.error[200],
  errorSurface: mix(base.dusk, base.error, 0.22),
  infoSurface: mix(base.dusk, base.sky, 0.2),
  infoText: mix(base.moon, WHITE, 0.6),
};

/** Same brand, calmer: more white, navy sidebar, smaller radius. */
const admin: Theme = {
  ...light,
  name: 'admin',
  background: mix(base.cream, WHITE, 0.55),
  backgroundDeep: base.cream,
  surfaceSunken: mix(base.cream, WHITE, 0.3),
  line: mix(base.navy, WHITE, 0.88),
  lineStrong: mix(base.navy, WHITE, 0.74),
  textMuted: mix(base.navy, WHITE, 0.32),
  textSubtle: mix(base.navy, WHITE, 0.45),
  accentText: readableShade('coral', WHITE),
  shadowTint: palette.navy[700],
};

export const themes = { light, bedtime, admin } as const;

/** Sidebar of the admin dashboard. */
export const adminChrome = {
  sidebar: base.navy,
  sidebarRaised: mix(base.navy, WHITE, 0.08),
  sidebarText: mix(base.cream, WHITE, 0.4),
  sidebarMuted: mix(base.navy, WHITE, 0.62),
  sidebarActive: mix(base.navy, WHITE, 0.14),
  sidebarAccent: base.coral,
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/** Native font family names registered with expo-font. */
export const nativeFonts = {
  displayMedium: 'Fredoka_500Medium',
  displaySemi: 'Fredoka_600SemiBold',
  displayBold: 'Fredoka_700Bold',
  body: 'Nunito_600SemiBold',
  bodyRegular: 'Nunito_400Regular',
  bodyBold: 'Nunito_700Bold',
  bodyExtraBold: 'Nunito_800ExtraBold',
} as const;

export const webFonts = {
  display: "'Fredoka', 'Nunito', system-ui, sans-serif",
  body: "'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "ui-monospace, 'Cascadia Code', Menlo, monospace",
} as const;

export const typeScale = {
  display: { fontSize: 36, lineHeight: 44, family: 'display', weight: 700 },
  h1: { fontSize: 28, lineHeight: 36, family: 'display', weight: 700 },
  h2: { fontSize: 22, lineHeight: 30, family: 'display', weight: 600 },
  h3: { fontSize: 18, lineHeight: 26, family: 'display', weight: 600 },
  body: { fontSize: 16, lineHeight: 24, family: 'body', weight: 600 },
  bodyBold: { fontSize: 16, lineHeight: 24, family: 'body', weight: 800 },
  small: { fontSize: 14, lineHeight: 20, family: 'body', weight: 600 },
  caption: { fontSize: 12, lineHeight: 16, family: 'body', weight: 700 },
  kicker: { fontSize: 12, lineHeight: 16, family: 'body', weight: 800, letterSpacing: 1.2, uppercase: true },
} as const;
export type TypeVariant = keyof typeof typeScale;

// ---------------------------------------------------------------------------
// Shape, space, depth, motion
// ---------------------------------------------------------------------------

export const radius = { xs: 8, sm: 12, md: 16, lg: 24, xl: 32, full: 999 } as const;

/** 4pt grid. */
export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 40, xxxl: 48, huge: 64 } as const;

/** Touch targets: 64 for ages 2 to 5, 48 everywhere else. */
export const touchTargets = { little: 64, standard: 48 } as const;

/** Three levels of soft, tinted shadow. Color comes from the theme tint or a world color. */
export const elevation = {
  1: { offsetY: 2, blur: 8, opacity: 0.1, androidElevation: 2 },
  2: { offsetY: 6, blur: 18, opacity: 0.13, androidElevation: 5 },
  3: { offsetY: 12, blur: 30, opacity: 0.17, androidElevation: 9 },
} as const;
export type ElevationLevel = keyof typeof elevation;

export function cssShadow(level: ElevationLevel, tint: string = light.shadowTint): string {
  const e = elevation[level];
  return `0 ${e.offsetY}px ${e.blur}px ${alpha(tint, e.opacity)}, 0 1px 2px ${alpha(tint, e.opacity * 0.6)}`;
}

/** Height of the darker bottom edge on chunky buttons, per size. */
export const buttonEdge = { little: 6, md: 5, sm: 3 } as const;

export const motion = {
  duration: { fast: 120, base: 220, slow: 420, bedtime: 1400 },
  spring: { pop: { damping: 12, stiffness: 260, mass: 0.8 }, soft: { damping: 18, stiffness: 140, mass: 1 } },
} as const;

// ---------------------------------------------------------------------------
// Admin CSS variables
// ---------------------------------------------------------------------------

/** CSS custom properties for the admin dashboard, generated from the tokens. */
export function cssVariables(theme: Theme = admin): string {
  const lines: string[] = [];
  for (const [name, scale] of Object.entries(palette)) {
    for (const step of SCALE_STEPS) lines.push(`--${name}-${step}: ${scale[step]};`);
  }
  for (const [key, value] of Object.entries(theme)) {
    if (typeof value === 'string' && value.startsWith('#')) lines.push(`--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${value};`);
  }
  for (const [key, value] of Object.entries(adminChrome)) lines.push(`--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${value};`);
  for (const [key, value] of Object.entries(radius)) lines.push(`--radius-${key}: ${value}px;`);
  for (const [key, value] of Object.entries(spacing)) lines.push(`--space-${key}: ${value}px;`);
  for (const level of [1, 2, 3] as const) {
    lines.push(`--shadow-${level}: ${cssShadow(level, theme.shadowTint)};`);
    lines.push(`--shadow-coral-${level}: ${cssShadow(level, palette.coral[700])};`);
  }
  lines.push(`--focus-ring: 0 0 0 3px ${alpha(theme.focus, 0.45)};`);
  lines.push(`--font-display: ${webFonts.display};`);
  lines.push(`--font-body: ${webFonts.body};`);
  lines.push(`--font-mono: ${webFonts.mono};`);
  for (const [key, t] of Object.entries(typeScale)) {
    lines.push(`--text-${key}: ${t.fontSize}px;`);
    lines.push(`--leading-${key}: ${t.lineHeight}px;`);
  }
  lines.push(`--duration-fast: ${motion.duration.fast}ms;`);
  lines.push(`--duration-base: ${motion.duration.base}ms;`);
  return `:root {\n  ${lines.join('\n  ')}\n}`;
}
