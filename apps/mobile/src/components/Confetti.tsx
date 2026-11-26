import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { decorative, palette } from '../theme/core';

const COLORS = [palette.coral[500], palette.star[500], palette.sky[500], palette.mint[500], palette.grape[400], palette.bubblegum[400]];

function Piece({ index, width, height }: { index: number; width: number; height: number }) {
  const p = useSharedValue(0);
  const seed = useMemo(() => {
    const r = (n: number) => ((Math.sin(index * 97.13 + n * 13.7) + 1) / 2);
    return { x: r(1) * width, drift: (r(2) - 0.5) * 120, spin: (r(3) - 0.5) * 720, delay: r(4) * 500, size: 8 + r(5) * 8, round: r(6) > 0.6 };
  }, [index, width]);
  useEffect(() => {
    p.value = withDelay(seed.delay, withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }));
  }, [p, seed.delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - p.value * 0.9,
    transform: [{ translateX: seed.x + seed.drift * p.value }, { translateY: -40 + p.value * height * 0.85 }, { rotate: `${seed.spin * p.value}deg` }],
  }));
  return <Animated.View style={[styles.piece, { width: seed.size, height: seed.round ? seed.size : seed.size * 1.6, borderRadius: seed.round ? seed.size : 2, backgroundColor: COLORS[index % COLORS.length] }, style]} />;
}

/** Brand-colored confetti burst. Skipped entirely when reduced motion is on. */
export function Confetti({ count = 36 }: { count?: number }) {
  const reduce = useReducedMotion();
  const { width, height } = useWindowDimensions();
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} {...decorative}>
      {Array.from({ length: count }, (_, i) => (
        <Piece key={i} index={i} width={width} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ piece: { position: 'absolute', top: 0, left: 0 } });
