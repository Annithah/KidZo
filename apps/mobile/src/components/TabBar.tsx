import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT, type TranslationKey } from '../i18n';
import { motion, palette, radius, shadow, spacing, touchTargets, useTheme } from '../theme/core';
import { Icon, type IconName } from './icon/Icon';
import { Text } from './Typography';

const TABS: { href: '/kid/home' | '/kid/stickers' | '/'; icon: IconName; label: TranslationKey }[] = [
  { href: '/kid/home', icon: 'home', label: 'tabs.home' },
  { href: '/kid/stickers', icon: 'sticker', label: 'tabs.stickers' },
  { href: '/', icon: 'families', label: 'tabs.players' },
];

/** Floating rounded tab bar for the kid area with an animated active bubble. */
export function TabBar() {
  const { t } = useT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const active = Math.max(0, TABS.findIndex((tab) => (tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href))));
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const slot = width / TABS.length;

  useEffect(() => {
    x.value = reduce ? active * slot : withSpring(active * slot, motion.spring.pop);
  }, [active, slot, reduce, x]);
  const bubble = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - spacing.xs * 2);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View
        onLayout={onLayout}
        accessibilityRole="tablist"
        style={[styles.bar, { backgroundColor: theme.isCalm ? theme.surface : palette.paper[500], borderColor: theme.isCalm ? theme.line : palette.coral[50] }, shadow(3, undefined, theme)]}
      >
        {width > 0 ? <Animated.View style={[styles.bubble, { width: slot, backgroundColor: theme.isCalm ? theme.surfaceRaised : palette.star[200] }, bubble]} /> : null}
        {TABS.map((tab, i) => {
          const selected = i === active;
          return (
            <Pressable
              key={tab.href}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={t(tab.label)}
              onPress={() => {
                if (!selected) router.replace(tab.href);
              }}
              style={styles.tab}
            >
              <Icon name={tab.icon} size={28} color={selected ? theme.text : theme.textMuted} accent={selected ? palette.coral[400] : undefined} />
              <Text variant="caption" color={selected ? theme.text : theme.textMuted}>
                {t(tab.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  bar: { flexDirection: 'row', borderRadius: radius.xl, padding: spacing.xs, borderWidth: 1.5, width: '100%', maxWidth: 440 },
  bubble: { position: 'absolute', top: spacing.xs, bottom: spacing.xs, left: spacing.xs, borderRadius: radius.lg },
  tab: { flex: 1, minHeight: touchTargets.little, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
