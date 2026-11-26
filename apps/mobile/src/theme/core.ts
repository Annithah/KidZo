import { createContext, useContext } from 'react';
import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import {
  alpha,
  base,
  buttonEdge,
  elevation,
  motion,
  nativeFonts,
  onColor,
  palette,
  radius,
  readableShade,
  spacing,
  themes,
  touchTargets,
  typeScale,
  type ColorName,
  type ElevationLevel,
  type Theme,
  type TypeVariant,
} from '@kidzo/ui-tokens';

export { alpha, base, buttonEdge, motion, onColor, palette, radius, readableShade, spacing, themes, touchTargets, type ColorName, type Theme };

/** Day (light) and bedtime themes. Every screen reads colors from the active theme. */
export const lightTheme = themes.light;
export const bedtimeTheme = themes.bedtime;

export const ThemeContext = createContext<Theme>(lightTheme);
export const useTheme = () => useContext(ThemeContext);

/** Tinted, never grey, shadow. Pass a world color to tint a card by its category. */
export function shadow(level: ElevationLevel = 2, tint?: string, theme: Theme = lightTheme): ViewStyle {
  if (theme.isCalm) return {};
  const e = elevation[level];
  const color = tint ?? theme.shadowTint;
  return Platform.select<ViewStyle>({
    ios: { shadowColor: color, shadowOpacity: e.opacity + 0.04, shadowRadius: e.blur / 2, shadowOffset: { width: 0, height: e.offsetY } },
    android: { elevation: e.androidElevation, shadowColor: color },
    default: { boxShadow: `0 ${e.offsetY}px ${e.blur}px ${alpha(color, e.opacity)}, 0 1px 2px ${alpha(color, e.opacity * 0.6)}` } as ViewStyle,
  }) as ViewStyle;
}

const familyFor = (variant: TypeVariant): string => {
  const t = typeScale[variant];
  if (t.family === 'display') return t.weight >= 700 ? nativeFonts.displayBold : nativeFonts.displaySemi;
  if (t.weight >= 800) return nativeFonts.bodyExtraBold;
  if (t.weight >= 700) return nativeFonts.bodyBold;
  return nativeFonts.body;
};

const style = (variant: TypeVariant): TextStyle => {
  const t = typeScale[variant];
  return {
    fontFamily: familyFor(variant),
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    ...('letterSpacing' in t ? { letterSpacing: t.letterSpacing } : {}),
    ...('uppercase' in t ? { textTransform: 'uppercase' as const } : {}),
  };
};

export const text: Record<TypeVariant, TextStyle> = {
  display: style('display'),
  h1: style('h1'),
  h2: style('h2'),
  h3: style('h3'),
  body: style('body'),
  bodyBold: style('bodyBold'),
  small: style('small'),
  caption: style('caption'),
  kicker: style('kicker'),
};

export const fonts = nativeFonts;

/** Scale tone helpers: tint for backgrounds, mid for fills, deep for edges and readable text. */
export const tone = (name: ColorName) => ({
  tint: palette[name][50],
  soft: palette[name][100],
  light: palette[name][200],
  base: palette[name][500],
  edge: palette[name][700],
  deep: palette[name][800],
});

/** Age-adaptive layout: 2 to 5 get huge tiles, 6 to 8 carousels, 9 to 12 denser grids. */
export type AgeBand = 'little' | 'middle' | 'big';
export const ageBand = (age: number): AgeBand => (age <= 5 ? 'little' : age <= 8 ? 'middle' : 'big');
export const targetFor = (band: AgeBand) => (band === 'little' ? touchTargets.little : touchTargets.standard);

/**
 * Props that hide decorative art from screen readers. React Native Web wants aria-hidden;
 * iOS and Android use the native accessibility props.
 */
export const decorative =
  Platform.OS === 'web'
    ? ({ 'aria-hidden': true } as const)
    : ({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const);
