import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { buttonEdge, fonts, motion, onColor, palette, radius, touchTargets, useTheme, type ColorName } from '../theme/core';
import { Icon, type IconName } from './icon/Icon';
import { Text } from './Typography';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'navy'
  | 'moon'
  | 'ghost'
  | 'danger'
  // World colors
  | 'sky'
  | 'mint'
  | 'grape'
  | 'bubblegum'
  | 'tangerine'
  | 'leaf'
  | 'star'
  // Older names kept for readability in screens
  | 'lavender'
  | 'yellow';
type Size = 'kid' | 'md' | 'sm';

const WORLD: Partial<Record<ButtonVariant, ColorName>> = {
  sky: 'sky',
  mint: 'mint',
  grape: 'grape',
  lavender: 'grape',
  bubblegum: 'bubblegum',
  tangerine: 'tangerine',
  leaf: 'leaf',
  star: 'star',
  yellow: 'star',
};

const SIZES: Record<Size, { height: number; font: number; pad: number; edge: number; icon: number }> = {
  kid: { height: touchTargets.little, font: 22, pad: 28, edge: buttonEdge.little, icon: 28 },
  md: { height: 54, font: 18, pad: 22, edge: buttonEdge.md, icon: 22 },
  sm: { height: touchTargets.standard, font: 16, pad: 18, edge: buttonEdge.sm, icon: 18 },
};

interface Props {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
}

/** Chunky pressable button: darker bottom edge that squashes with a springy press. */
export function Button({ label, onPress, variant = 'primary', size = 'md', icon, iconRight, disabled, loading, fullWidth, accessibilityHint, style, textColor }: Props) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const press = useSharedValue(0);
  const s = SIZES[size];
  const inactive = !!(disabled || loading);

  const world = WORLD[variant];
  const look = (() => {
    if (world) return { bg: palette[world][500], fg: onColor(palette[world][500]), edge: palette[world][700], border: 'transparent' };
    switch (variant) {
      case 'secondary':
        return { bg: theme.surface, fg: theme.text, edge: theme.lineStrong, border: theme.line };
      case 'navy':
        return { bg: palette.navy[500], fg: palette.paper[500], edge: palette.navy[800], border: 'transparent' };
      case 'moon':
        return { bg: palette.moon[500], fg: palette.night[500], edge: palette.moon[700], border: 'transparent' };
      case 'ghost':
        return { bg: 'transparent', fg: theme.text, edge: 'transparent', border: 'transparent' };
      case 'danger':
        return { bg: theme.surface, fg: theme.errorText, edge: palette.error[200], border: palette.error[300] };
      default:
        return { bg: theme.primary, fg: theme.onPrimary, edge: theme.primaryEdge, border: 'transparent' };
    }
  })();
  const edge = variant === 'ghost' ? 0 : s.edge;
  const fg = inactive ? theme.textSubtle : (textColor ?? look.fg);

  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * edge }] }));

  const animate = (to: number) => {
    press.value = reduce ? to : to === 1 ? withTiming(1, { duration: motion.duration.fast }) : withSpring(0, motion.spring.pop);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: !!loading }}
      disabled={inactive}
      hitSlop={4}
      onPressIn={() => animate(1)}
      onPressOut={() => animate(0)}
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={[fullWidth && styles.full, style]}
    >
      <View style={[styles.edge, { backgroundColor: inactive ? theme.line : look.edge, paddingBottom: edge, minHeight: s.height + edge }]}>
        <Animated.View
          style={[
            styles.face,
            faceStyle,
            {
              minHeight: s.height,
              paddingHorizontal: s.pad,
              backgroundColor: inactive ? theme.surfaceSunken : look.bg,
              borderColor: inactive ? theme.line : look.border,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={look.fg} />
          ) : (
            <>
              {icon ? <Icon name={icon} size={s.icon} color={fg} accent={look.edge === 'transparent' ? undefined : look.edge} /> : null}
              <Text style={{ fontFamily: fonts.displaySemi, fontSize: s.font, lineHeight: s.font * 1.3 }} color={fg} numberOfLines={1}>
                {label}
              </Text>
              {iconRight ? <Icon name={iconRight} size={s.icon} color={fg} /> : null}
            </>
          )}
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  full: { alignSelf: 'stretch' },
  edge: { borderRadius: radius.full },
  face: { borderRadius: radius.full, borderWidth: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
});
