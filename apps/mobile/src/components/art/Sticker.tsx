import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { artLabel, getArt } from '@kidzo/art';
import { alpha, palette, shadow, useTheme, type ColorName } from '../../theme/core';
import { Icon } from '../icon/Icon';
import { Art } from './Art';

interface Props {
  art: string;
  /** Sticker color from the data; falls back to the art's world color. */
  color?: string;
  size?: number;
  locked?: boolean;
  /** Plays the unlock shine (for freshly earned stickers). */
  shine?: boolean;
  label?: string;
}

/** Die-cut sticker: white border, soft tinted drop shadow, colored disc, art on top. */
export function Sticker({ art, color, size = 88, locked, shine, label }: Props) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const world = (getArt(art).world ?? 'star') as ColorName;
  const scale = palette[world] ?? palette.star;
  const disc = locked ? palette.navy[50] : (color ?? scale[200]);
  const sweep = useSharedValue(-1);

  useEffect(() => {
    if (!shine || locked || reduce) return;
    sweep.value = withDelay(300, withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }), withTiming(-1, { duration: 0 }), withTiming(-1, { duration: 1800 })), 3));
  }, [shine, locked, reduce, sweep]);
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sweep.value * size }, { rotate: '25deg' }] }));

  return (
    <View
      style={[styles.border, { width: size, height: size, borderRadius: size / 2, padding: size * 0.06 }, !locked && shadow(2, scale[700], theme)]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ?? (locked ? 'Locked sticker' : artLabel(art))}
    >
      <View style={[styles.disc, { backgroundColor: disc, borderRadius: size / 2 }]}>
        <Art art={art} size={size * 0.86} silhouette={locked} />
        {shine && !locked ? <Animated.View pointerEvents="none" style={[styles.shine, { height: size * 1.6, width: size * 0.22 }, sweepStyle]} /> : null}
      </View>
      {locked ? (
        <View style={[styles.lock, { width: size * 0.34, height: size * 0.34, borderRadius: size }]}>
          <Icon name="lock" size={size * 0.2} color={palette.paper[500]} accent={palette.navy[300]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  border: { backgroundColor: palette.paper[500], alignItems: 'center', justifyContent: 'center' },
  disc: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  shine: { position: 'absolute', backgroundColor: alpha(palette.paper[500], 0.55), top: '-30%' },
  lock: { position: 'absolute', right: 0, bottom: 0, backgroundColor: palette.navy[400], alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: palette.paper[500] },
});
