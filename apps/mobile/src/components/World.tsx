import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { decorative, motion, palette, useTheme } from '../theme/core';
import { Art } from './art/Art';

/** One parallax layer: moves at `rate` of the scroll and optionally drifts sideways. */
function Layer({ children, scrollY, rate, drift = 0, style }: { children: ReactNode; scrollY?: SharedValue<number>; rate: number; drift?: number; style: ViewStyle }) {
  const reduce = useReducedMotion();
  const x = useSharedValue(0);
  useEffect(() => {
    if (!drift || reduce) return;
    x.value = withRepeat(withSequence(withTiming(drift, { duration: 9000, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 9000, easing: Easing.inOut(Easing.sin) })), -1);
  }, [drift, reduce, x]);
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: scrollY ? -scrollY.value * rate : 0 }, { translateX: x.value }],
  }));
  return <Animated.View style={[{ position: 'absolute' }, style, animated]}>{children}</Animated.View>;
}

function Twinkle({ delay, size, left, top }: { delay: number; size: number; left: number; top: number }) {
  const reduce = useReducedMotion();
  const o = useSharedValue(0.8);
  useEffect(() => {
    if (reduce) return;
    o.value = withDelay(delay, withRepeat(withSequence(withTiming(0.25, { duration: motion.duration.bedtime }), withTiming(0.9, { duration: motion.duration.bedtime })), -1));
  }, [delay, o, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[{ position: 'absolute', left, top }, style]}>
      <Art art="object.sparkles" size={size} />
    </Animated.View>
  );
}

/** Rolling hills drawn edge to edge. */
function Hills({ width }: { width: number }) {
  return (
    <Svg width={width} height={140} viewBox="0 0 400 140" preserveAspectRatio="none">
      <Path d="M0 70 Q60 30 130 60 Q200 90 270 50 Q330 20 400 52 L400 140 L0 140 Z" fill={palette.leaf[100]} />
      <Path d="M0 100 Q80 70 170 94 Q250 116 320 86 Q360 72 400 82 L400 140 L0 140 Z" fill={palette.leaf[200]} />
    </Svg>
  );
}

/** The logo swoosh as a soft trail across the page. */
function SwooshTrail({ width }: { width: number }) {
  return (
    <Svg width={width} height={160} viewBox="0 0 400 160" preserveAspectRatio="none">
      <Path d="M-10 130 Q140 170 410 30" stroke={palette.coral[200]} strokeWidth={10} strokeLinecap="round" fill="none" opacity={0.55} />
      <Path d="M20 140 Q170 160 380 70" stroke={palette.star[200]} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.6} />
    </Svg>
  );
}

/**
 * Illustrated backdrop for child screens: clouds, hills and a swoosh trail by day, moon and
 * twinkling stars at bedtime. Decorative only; layers move with the scroll for depth.
 */
export function WorldBackground({ scrollY, variant }: { scrollY?: SharedValue<number>; variant?: 'day' | 'bedtime' }) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const night = (variant ?? (theme.isCalm ? 'bedtime' : 'day')) === 'bedtime';

  if (night) {
    const stars = [
      [0.08, 0.06, 26, 0],
      [0.32, 0.12, 18, 600],
      [0.62, 0.04, 22, 1200],
      [0.86, 0.18, 16, 300],
      [0.18, 0.32, 14, 900],
      [0.74, 0.36, 20, 1500],
      [0.44, 0.48, 12, 400],
    ] as const;
    return (
      <View pointerEvents="none" style={[styles.abs, { backgroundColor: theme.background }]} {...decorative}>
        {stars.map(([x, y, s, d], i) => (
          <Twinkle key={i} left={x * width} top={y * height} size={s} delay={d} />
        ))}
        <Layer scrollY={scrollY} rate={0.3} style={{ top: 24, right: -20 }}>
          <Art art="object.moon" size={140} />
        </Layer>
        <Layer scrollY={scrollY} rate={0.1} drift={10} style={{ bottom: -40, left: -40 }}>
          <Art art="object.cloud" size={Math.min(300, width * 0.7)} />
        </Layer>
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={[styles.abs, { backgroundColor: theme.background }]} {...decorative}>
      <View style={[styles.blob, { backgroundColor: palette.sky[50], width: width * 1.2, height: width * 1.2, top: -width * 0.85, left: -width * 0.1 }]} />
      <Layer scrollY={scrollY} rate={0.2} drift={14} style={{ top: 10, left: -20, opacity: 0.9 }}>
        <Art art="object.cloud" size={120} />
      </Layer>
      <Layer scrollY={scrollY} rate={0.35} drift={-10} style={{ top: 70, right: -24, opacity: 0.75 }}>
        <Art art="object.cloud" size={92} />
      </Layer>
      <Layer scrollY={scrollY} rate={0.25} style={{ top: height * 0.38, left: 0 }}>
        <SwooshTrail width={width} />
      </Layer>
      <View style={{ position: 'absolute', bottom: 0, left: 0 }}>
        <Hills width={width} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 9999 },
});
