import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { radius, shadow, spacing, useTheme } from '../theme/core';
import { Art } from './art/Art';
import { Text } from './Typography';

export type ZoMood = 'happy' | 'thinking' | 'cheering' | 'sleepy' | 'waving' | 'celebrating';
/** Older mood names used across screens. */
type LegacyMood = 'cheer';

const ART: Record<ZoMood, string> = {
  happy: 'zo.happy',
  thinking: 'zo.thinking',
  cheering: 'zo.cheering',
  sleepy: 'zo.sleepy',
  waving: 'zo.waving',
  celebrating: 'zo.celebrating',
};

const LABEL: Record<ZoMood, string> = {
  happy: 'Zo the star, smiling',
  thinking: 'Zo the star, thinking',
  cheering: 'Zo the star, cheering',
  sleepy: 'Zo the star, sleepy',
  waving: 'Zo the star, waving',
  celebrating: 'Zo the star, celebrating',
};

/** Zo, the star from the logo. Bobs gently; slower when sleepy; still with reduced motion. */
export function Zo({ size = 96, mood = 'happy', bounce = true }: { size?: number; mood?: ZoMood | LegacyMood; bounce?: boolean }) {
  const m: ZoMood = mood === 'cheer' ? 'cheering' : mood;
  const y = useSharedValue(0);
  const r = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!bounce || reduce) return;
    const slow = m === 'sleepy';
    const d = slow ? 1800 : 650;
    y.value = withRepeat(withSequence(withTiming(-size * 0.06, { duration: d, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: d, easing: Easing.inOut(Easing.quad) })), -1);
    if (m === 'waving' || m === 'celebrating' || m === 'cheering') {
      r.value = withRepeat(withSequence(withTiming(-6, { duration: 300 }), withTiming(6, { duration: 300 })), -1, true);
    }
  }, [bounce, reduce, m, size, y, r]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { rotate: `${r.value}deg` }] }));
  return (
    <Animated.View style={[{ width: size, height: size }, animated]} accessibilityRole="image" accessibilityLabel={LABEL[m]}>
      <Art art={ART[m]} size={size} />
    </Animated.View>
  );
}

/** Zo with a speech bubble. */
export function ZoSays({ message, mood, size = 72 }: { message: string; mood?: ZoMood | LegacyMood; size?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.saysRow}>
      <Zo size={size} mood={mood} />
      <View style={styles.bubbleWrap}>
        <View style={[styles.tail, { borderRightColor: theme.surface }]} />
        <View style={[styles.bubble, { backgroundColor: theme.surface }, shadow(1, undefined, theme)]} accessibilityLiveRegion="polite">
          <Text variant="bodyBold">{message}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  saysRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bubbleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  tail: { width: 0, height: 0, borderTopWidth: 10, borderBottomWidth: 10, borderRightWidth: 14, borderTopColor: 'transparent', borderBottomColor: 'transparent', marginRight: -2 },
  bubble: { flex: 1, borderRadius: radius.lg, padding: spacing.md },
});
