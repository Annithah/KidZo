import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { colors, radii, softShadow, spacing, usePalette } from '../theme';
import { Text } from './Typography';

const zoImage = require('../../assets/images/zo.png');

type Mood = 'happy' | 'sleepy' | 'cheer';

/** Zo, the curious star guide. Drawn from the logo star with a friendly face. */
export function Zo({ size = 96, mood = 'happy', bounce = true }: { size?: number; mood?: Mood; bounce?: boolean }) {
  const y = useSharedValue(0);
  // Respect the system "reduce motion" setting: Zo stays still instead of bouncing forever.
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (!bounce || reduceMotion) return;
    y.value = withRepeat(
      withSequence(withTiming(-size * 0.06, { duration: mood === 'sleepy' ? 1600 : 700 }), withTiming(0, { duration: mood === 'sleepy' ? 1600 : 700 })),
      -1,
      true,
    );
  }, [bounce, reduceMotion, mood, size, y]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  const eye = size * 0.075;
  return (
    <Animated.View style={[{ width: size, height: size }, animated]} accessibilityRole="image" accessibilityLabel="Zo the star">
      <Image source={zoImage} style={{ width: size, height: size }} contentFit="contain" />
      <View style={[styles.face, { top: size * 0.42, left: size * 0.29, width: size * 0.34 }]}>
        <View style={styles.eyes}>
          {[0, 1].map((i) =>
            mood === 'sleepy' ? (
              <View key={i} style={{ width: eye * 1.4, height: eye * 0.35, borderRadius: eye, backgroundColor: colors.navy }} />
            ) : (
              <View key={i} style={{ width: eye, height: eye * 1.25, borderRadius: eye, backgroundColor: colors.navy }} />
            ),
          )}
        </View>
        <View
          style={{
            marginTop: size * 0.03,
            width: size * (mood === 'cheer' ? 0.14 : 0.11),
            height: size * (mood === 'cheer' ? 0.07 : 0.05),
            borderBottomLeftRadius: size,
            borderBottomRightRadius: size,
            backgroundColor: mood === 'cheer' ? colors.coral : 'transparent',
            borderColor: colors.navy,
            borderWidth: mood === 'cheer' ? 0 : size * 0.018,
            borderTopWidth: 0,
          }}
        />
      </View>
    </Animated.View>
  );
}

/** Zo with a speech bubble. */
export function ZoSays({ message, mood, size = 72 }: { message: string; mood?: Mood; size?: number }) {
  const palette = usePalette();
  return (
    <View style={styles.saysRow}>
      <Zo size={size} mood={mood} />
      <View style={[styles.bubble, { backgroundColor: palette.surface }, !palette.isCalm && softShadow(2)]}>
        <Text variant="bodyBold">{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { position: 'absolute', alignItems: 'center' },
  eyes: { flexDirection: 'row', justifyContent: 'space-between', width: '70%' },
  saysRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bubble: { flex: 1, borderRadius: radii.md, padding: spacing.md },
});
