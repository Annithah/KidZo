import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, softShadow, spacing, usePalette } from '../theme';
import { Text } from './Typography';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  background?: string;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
}

export function Screen({ children, scroll = true, padded = true, background, contentStyle, footer }: ScreenProps) {
  const palette = usePalette();
  const bg = background ?? palette.background;
  const inner = [padded && styles.padded, contentStyle];
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: bg }]} edges={['top', 'left', 'right', 'bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.scrollContent, inner]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  right?: ReactNode;
  backLabel?: string;
}

export function Header({ title, onBack, right, backLabel = 'Back' }: HeaderProps) {
  const palette = usePalette();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        hitSlop={10}
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        style={[styles.backButton, { backgroundColor: palette.surface }, softShadow(2)]}
      >
        <Text variant="h2" color={palette.text}>
          ‹
        </Text>
      </Pressable>
      <Text variant="h3" style={styles.headerTitle} numberOfLines={1}>
        {title ?? ''}
      </Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

export function Card({
  children,
  style,
  color,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  color?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const palette = usePalette();
  const content = (
    <View style={[styles.card, { backgroundColor: color ?? palette.surface }, !palette.isCalm && softShadow(3), style]}>
      {children}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      {content}
    </Pressable>
  );
}

export function Row({ children, gap = spacing.sm, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Chip({ label, color = colors.skyTint, textColor = colors.navy, icon }: { label: string; color?: string; textColor?: string; icon?: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: color }]}>
      <Text variant="caption" color={textColor}>
        {icon ? `${icon} ` : ''}
        {label}
      </Text>
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Row style={styles.section}>
      <Text variant="h2" style={styles.flex}>
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
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  backButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerRight: { minWidth: 48, alignItems: 'flex-end' },
  card: { borderRadius: radii.lg, padding: spacing.md },
  chip: { borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  section: { marginTop: spacing.sm },
});
