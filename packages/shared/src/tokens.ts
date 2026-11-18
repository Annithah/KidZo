/**
 * KIDZO design tokens. Source: published Figma Make prototype (KIDZO Design System 1.0).
 * Shared by the mobile app and the admin dashboard so brand values live in one place.
 */
export const colors = {
  coral: '#FF7A5C',
  starYellow: '#FFD23F',
  navy: '#1B2A4E',
  cream: '#FFF6E8',
  skyBlue: '#5BC0F8',
  mint: '#4ED6A5',
  lavender: '#A98BFF',
  softPink: '#FF9EC7',
  error: '#FF5A5F',
  success: '#3DCB8A',
  white: '#FFFFFF',
  // Neutrals from the prototype stylesheet
  ink: '#1B2A4E',
  inkMuted: '#5B6478',
  inkSubtle: '#8B91A0',
  line: '#DFE2E8',
  surfaceMuted: '#F7F7F8',
  coralTint: '#FFE9E4',
  skyTint: '#E8F7FF',
  creamDeep: '#FFF0D6',
} as const;

export const bedtimeColors = {
  deepIndigo: '#24264A',
  moonYellow: '#F6E7A1',
  mutedLavender: '#8C82C9',
  indigoSoft: '#555980',
  indigoRaised: '#2F3260',
  textOnIndigo: '#F3F1FF',
  textOnIndigoMuted: '#BFC1D6',
} as const;

/** Darker shade used for the "3D" bottom edge of chunky buttons. */
export const pressedShade: Record<string, string> = {
  [colors.coral]: '#E05A3D',
  [colors.starYellow]: '#E0B21C',
  [colors.navy]: '#0F1A35',
  [colors.skyBlue]: '#3A9FD8',
  [colors.mint]: '#2FB585',
  [colors.lavender]: '#8B6BE6',
  [colors.softPink]: '#E87BA8',
  [colors.white]: '#DFE2E8',
  [bedtimeColors.mutedLavender]: '#6F65AE',
  [bedtimeColors.moonYellow]: '#D9C77C',
};

export const radii = {
  sm: 12,
  md: 20,
  lg: 24,
  xl: 28,
  pill: 999,
} as const;

/** 8pt grid. */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
} as const;

/** Age-aware touch targets from the design system. */
export const touchTargets = {
  kid: 64,
  standard: 48,
  compact: 40,
} as const;

export const fontFamilies = {
  display: 'Baloo2_800ExtraBold',
  displayBold: 'Baloo2_700Bold',
  displaySemi: 'Baloo2_600SemiBold',
  body: 'Nunito_600SemiBold',
  bodyRegular: 'Nunito_400Regular',
  bodyBold: 'Nunito_700Bold',
  bodyExtraBold: 'Nunito_800ExtraBold',
} as const;

/** Type scale (size / line height) from the prototype: Display 32/40, Body 16/24. */
export const typeScale = {
  display: { fontSize: 32, lineHeight: 40 },
  h1: { fontSize: 28, lineHeight: 36 },
  h2: { fontSize: 22, lineHeight: 30 },
  h3: { fontSize: 18, lineHeight: 26 },
  body: { fontSize: 16, lineHeight: 24 },
  small: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
} as const;

/** Accent palette rotated across content cards and child avatars. */
export const accentColors = [
  colors.coral,
  colors.skyBlue,
  colors.mint,
  colors.lavender,
  colors.softPink,
  colors.starYellow,
] as const;

export type AccentColor = (typeof accentColors)[number];
