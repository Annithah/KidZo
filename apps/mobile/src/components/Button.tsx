import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { pressedShade } from '@kidzo/shared';
import { bedtimeColors, colors, fontFamilies, radii, touchTargets } from '../theme';
import { Text } from './Typography';

export type ButtonVariant = 'primary' | 'secondary' | 'sky' | 'mint' | 'lavender' | 'yellow' | 'navy' | 'moon' | 'ghost' | 'danger';
type Size = 'kid' | 'md' | 'sm';

const VARIANTS: Record<ButtonVariant, { bg: string; fg: string; edge: string; border?: string }> = {
  primary: { bg: colors.coral, fg: colors.white, edge: pressedShade[colors.coral] ?? colors.coral },
  secondary: { bg: colors.white, fg: colors.navy, edge: colors.line, border: colors.line },
  sky: { bg: colors.skyBlue, fg: colors.white, edge: pressedShade[colors.skyBlue] ?? colors.skyBlue },
  mint: { bg: colors.mint, fg: colors.navy, edge: pressedShade[colors.mint] ?? colors.mint },
  lavender: { bg: colors.lavender, fg: colors.white, edge: pressedShade[colors.lavender] ?? colors.lavender },
  yellow: { bg: colors.starYellow, fg: colors.navy, edge: pressedShade[colors.starYellow] ?? colors.starYellow },
  navy: { bg: colors.navy, fg: colors.white, edge: pressedShade[colors.navy] ?? colors.navy },
  moon: { bg: bedtimeColors.moonYellow, fg: bedtimeColors.deepIndigo, edge: pressedShade[bedtimeColors.moonYellow] ?? '#000' },
  ghost: { bg: 'transparent', fg: colors.navy, edge: 'transparent' },
  danger: { bg: colors.white, fg: colors.error, edge: colors.line, border: colors.error },
};

const SIZES: Record<Size, { height: number; font: number; pad: number; edge: number }> = {
  kid: { height: touchTargets.kid, font: 22, pad: 28, edge: 6 },
  md: { height: 52, font: 18, pad: 22, edge: 4 },
  sm: { height: touchTargets.compact, font: 15, pad: 16, edge: 3 },
};

interface Props {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: Size;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
}

/** Chunky pressable button with a 3D bottom edge that squashes when pressed. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  loading,
  fullWidth,
  accessibilityHint,
  style,
  textColor,
}: Props) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const inactive = disabled || loading;
  const edge = variant === 'ghost' ? 0 : s.edge;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      hitSlop={6}
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={[fullWidth && styles.full, style]}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.edge,
            {
              backgroundColor: inactive ? colors.line : v.edge,
              borderRadius: radii.pill,
              paddingBottom: pressed ? Math.max(1, edge - 4) : edge,
              marginTop: pressed ? Math.min(4, edge - 1) : 0,
            },
          ]}
        >
          <View
            style={[
              styles.face,
              {
                minHeight: s.height,
                paddingHorizontal: s.pad,
                backgroundColor: inactive ? colors.surfaceMuted : v.bg,
                borderColor: inactive ? colors.line : (v.border ?? 'transparent'),
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={v.fg} />
            ) : (
              <>
                {icon}
                <Text
                  style={{ fontFamily: fontFamilies.displayBold, fontSize: s.font, lineHeight: s.font * 1.3 }}
                  color={inactive ? colors.inkSubtle : (textColor ?? v.fg)}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </>
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  full: { alignSelf: 'stretch' },
  edge: {},
  face: {
    borderRadius: radii.pill,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});
