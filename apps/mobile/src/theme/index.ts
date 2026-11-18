import { createContext, useContext } from 'react';
import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { bedtimeColors, colors, fontFamilies, radii, spacing, touchTargets, typeScale } from '@kidzo/shared';

export { bedtimeColors, colors, fontFamilies, radii, spacing, touchTargets, typeScale };

export interface Palette {
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  line: string;
  accent: string;
  isCalm: boolean;
}

export const dayPalette: Palette = {
  background: colors.cream,
  surface: colors.white,
  surfaceRaised: colors.white,
  text: colors.navy,
  textMuted: colors.inkMuted,
  line: colors.line,
  accent: colors.coral,
  isCalm: false,
};

/** Low stimulation evening palette from the prototype's Calm / Bedtime swatches. */
export const calmPalette: Palette = {
  background: bedtimeColors.deepIndigo,
  surface: bedtimeColors.indigoRaised,
  surfaceRaised: bedtimeColors.indigoSoft,
  text: bedtimeColors.textOnIndigo,
  textMuted: bedtimeColors.textOnIndigoMuted,
  line: bedtimeColors.indigoSoft,
  accent: bedtimeColors.moonYellow,
  isCalm: true,
};

export const PaletteContext = createContext<Palette>(dayPalette);
export const usePalette = () => useContext(PaletteContext);

export function softShadow(elevation = 3): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: colors.navy,
      shadowOpacity: 0.08 + elevation * 0.01,
      shadowRadius: 6 + elevation * 2,
      shadowOffset: { width: 0, height: 2 + elevation },
    },
    android: { elevation },
    default: { boxShadow: `0 ${2 + elevation}px ${8 + elevation * 3}px rgba(27,42,78,0.10)` } as ViewStyle,
  }) as ViewStyle;
}

export const text = {
  display: { fontFamily: fontFamilies.display, ...typeScale.display } satisfies TextStyle,
  h1: { fontFamily: fontFamilies.display, ...typeScale.h1 } satisfies TextStyle,
  h2: { fontFamily: fontFamilies.displayBold, ...typeScale.h2 } satisfies TextStyle,
  h3: { fontFamily: fontFamilies.displayBold, ...typeScale.h3 } satisfies TextStyle,
  body: { fontFamily: fontFamilies.body, ...typeScale.body } satisfies TextStyle,
  bodyBold: { fontFamily: fontFamilies.bodyBold, ...typeScale.body } satisfies TextStyle,
  small: { fontFamily: fontFamilies.body, ...typeScale.small } satisfies TextStyle,
  caption: { fontFamily: fontFamilies.bodyBold, ...typeScale.caption } satisfies TextStyle,
  kicker: {
    fontFamily: fontFamilies.bodyExtraBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  } satisfies TextStyle,
};
