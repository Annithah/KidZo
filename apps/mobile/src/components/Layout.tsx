import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedScrollHandler, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { motion, palette, radius, shadow, spacing, useTheme, type ColorName } from '../theme/core';
import { Icon, type IconName } from './icon/Icon';
import { IconButton } from './IconButton';
import { Text } from './Typography';
import { WorldBackground } from './World';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /** Illustrated child-area backdrop with parallax. */
  world?: boolean;
  background?: string;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
  /** Floating element over the content, for example the kid tab bar. */
  overlay?: ReactNode;
}

export function Screen({ children, scroll = true, padded = true, world, background, contentStyle, footer, overlay }: ScreenProps) {
  const theme = useTheme();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const inner = [padded && styles.padded, contentStyle];
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: world ? 'transparent' : (background ?? theme.background) }]} edges={['top', 'left', 'right', 'bottom']}>
      {world ? <WorldBackground scrollY={scrollY} /> : null}
      {scroll ? (
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.scrollContent, overlay ? styles.withOverlay : null, inner]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </Animated.ScrollView>
      ) : (
        <View style={[styles.flex, inner]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
      {overlay}
    </SafeAreaView>
  );
}

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  right?: ReactNode;
  backLabel?: string;
  backIcon?: IconName;
}

export function Header({ title, onBack, right, backLabel = 'Back', backIcon = 'back' }: HeaderProps) {
  return (
    <View style={styles.header}>
      <IconButton icon={backIcon} label={backLabel} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} />
      <Text variant="h3" style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
        {title ?? ''}
      </Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

/**
 * Paper card. `world` tints the shadow and adds the layered "second sheet" peeking out
 * underneath, the Storybook Playground signature.
 */
export function Card({
  children,
  style,
  color,
  world,
  layered,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  color?: string;
  world?: ColorName;
  layered?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const tint = world ? palette[world][700] : undefined;
  const body = (
    <View style={layered && !theme.isCalm ? styles.layerWrap : undefined}>
      {layered && !theme.isCalm ? <View style={[styles.sheet, { backgroundColor: world ? palette[world][100] : palette.coral[50] }]} /> : null}
      <View style={[styles.card, { backgroundColor: color ?? theme.surface }, shadow(2, tint, theme), theme.isCalm && { borderWidth: 1, borderColor: theme.line }, style]}>{children}</View>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onPressIn={() => {
        scale.value = reduce ? 0.98 : withSpring(0.97, motion.spring.pop);
      }}
      onPressOut={() => {
        scale.value = reduce ? 1 : withSpring(1, motion.spring.pop);
      }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{body}</Animated.View>
    </Pressable>
  );
}

export function Row({ children, gap = spacing.sm, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

/** Small pill label with an optional icon. */
export function Chip({ label, world = 'sky', icon, solid }: { label: string; world?: ColorName; icon?: IconName; solid?: boolean }) {
  const theme = useTheme();
  const bg = theme.isCalm ? theme.surfaceRaised : solid ? palette[world][500] : palette[world][50];
  const fg = theme.isCalm ? theme.text : solid ? palette.navy[500] : palette.navy[500];
  return (
    <View style={[styles.chip, { backgroundColor: bg, borderColor: theme.isCalm ? theme.line : palette[world][100] }]}>
      {icon ? <Icon name={icon} size={14} color={fg} accent={palette[world][400]} /> : null}
      <Text variant="caption" color={fg}>
        {label}
      </Text>
    </View>
  );
}

export function SectionTitle({ title, action, icon }: { title: string; action?: ReactNode; icon?: IconName }) {
  return (
    <Row style={styles.section}>
      {icon ? <Icon name={icon} size={24} /> : null}
      <Text variant="h2" style={styles.flex} accessibilityRole="header">
        {title}
      </Text>
      {action}
    </Row>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  scrollContent: { paddingBottom: spacing.xxl, gap: spacing.md },
  withOverlay: { paddingBottom: 120 },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52 },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerRight: { minWidth: 48, alignItems: 'flex-end' },
  layerWrap: { paddingBottom: 6 },
  sheet: { position: 'absolute', left: 10, right: 10, bottom: 0, top: 10, borderRadius: radius.lg, transform: [{ rotate: '-1.2deg' }] },
  card: { borderRadius: radius.lg, padding: spacing.md },
  chip: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1 },
  section: { marginTop: spacing.sm },
});
