import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { palette } from '../../theme/core';
import { Art } from '../art/Art';
import { Text } from '../Typography';

interface Props {
  sceneId: string;
  /** Art key shown as the scene's clue, for example "object.heart". */
  clue: string;
  height?: number;
}

const SKIN = palette.tangerine[700];

/** Animated park stage for the built-in kindness adventure: Tom, Mia, a helper and a puppy. */
export function KindnessScene({ sceneId, clue, height = 220 }: Props) {
  const helperVisible = ['ask-helper', 'reflection', 'safe-choice', 'helper', 'ending'].includes(sceneId);

  return (
    <View style={[styles.stage, { height }]}>
      <View style={styles.sky} />
      <View style={styles.sun} />
      <Drifter style={styles.cloudOne}>
        <Art art="object.cloud" size={40} />
      </Drifter>
      <Drifter style={styles.cloudTwo}>
        <Art art="object.cloud" size={32} />
      </Drifter>
      <Tree style={styles.treeOne} size={48} />
      <Tree style={styles.treeTwo} size={38} />
      <View style={styles.backHill} />
      <View style={styles.frontHill} />
      <View style={styles.path} />
      <AnimatedPerson name="Tom" shirt={palette.star[400]} hair={palette.tangerine[900]} style={styles.tom} />
      <AnimatedPerson name="Mia" shirt={palette.bubblegum[400]} hair={palette.navy[700]} style={styles.mia} />
      {helperVisible ? <AnimatedPerson name="Helper" shirt={palette.sky[400]} hair={palette.tangerine[900]} style={styles.helper} /> : null}
      <Drifter style={styles.puppy}>
        <Puppy happy={sceneId === 'ending'} />
      </Drifter>
      <View style={styles.clue} pointerEvents="none">
        <Art art={clue} size={34} />
      </View>
    </View>
  );
}

function Drifter({ children, style }: { children: ReactNode; style: object }) {
  const offset = useSharedValue(0);
  useEffect(() => {
    offset.value = withRepeat(
      withSequence(withTiming(-6, { duration: 850 }), withTiming(0, { duration: 850 })),
      -1,
    );
    return () => cancelAnimation(offset);
  }, [offset]);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  return (
    <Animated.View style={[style, motion]} pointerEvents="none">
      {children}
    </Animated.View>
  );
}

function Tree({ style, size }: { style: object; size: number }) {
  return (
    <View style={[style, { alignItems: 'center' }]} pointerEvents="none">
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: palette.leaf[600] }} />
      <View style={{ width: size / 5, height: size / 2.4, marginTop: -size / 10, borderRadius: 4, backgroundColor: palette.tangerine[800] }} />
    </View>
  );
}

function Puppy({ happy }: { happy: boolean }) {
  return (
    <View style={styles.puppyBody}>
      <View style={styles.puppyEarLeft} />
      <View style={styles.puppyEarRight} />
      <View style={styles.puppyHead}>
        <View style={styles.puppyNose} />
      </View>
      {happy ? (
        <View style={styles.puppyHeart}>
          <Art art="object.heart" size={18} />
        </View>
      ) : null}
    </View>
  );
}

function AnimatedPerson({
  name,
  shirt,
  hair,
  style,
}: {
  name: string;
  shirt: string;
  hair: string;
  style: object;
}) {
  const bounce = useSharedValue(0);
  useEffect(() => {
    bounce.value = withRepeat(
      withSequence(withTiming(-5, { duration: 750 }), withTiming(0, { duration: 750 })),
      -1,
    );
    return () => cancelAnimation(bounce);
  }, [bounce]);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: bounce.value }] }));

  return (
    <Animated.View entering={FadeIn.duration(450)} style={[styles.person, style, motion]} pointerEvents="none">
      <View style={[styles.head, { backgroundColor: SKIN }]}>
        <View style={[styles.hair, { backgroundColor: hair }]} />
        <View style={styles.eyes}><View /><View /></View>
        <View style={styles.smile} />
      </View>
      <View style={[styles.torso, { backgroundColor: shirt }]}>
        <View style={styles.armLeft} />
        <View style={styles.armRight} />
      </View>
      <View style={styles.legs}><View /><View /></View>
      <Text variant="caption" style={styles.name}>{name}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { width: '100%', borderRadius: 22, overflow: 'hidden', backgroundColor: palette.sky[200] },
  sky: { ...StyleSheet.absoluteFill, backgroundColor: palette.sky[100] },
  sun: { position: 'absolute', top: '8%', right: '10%', width: 52, height: 52, borderRadius: 26, backgroundColor: palette.star[200] },
  cloudOne: { position: 'absolute', top: '10%', left: '12%' },
  cloudTwo: { position: 'absolute', top: '22%', left: '58%' },
  treeOne: { position: 'absolute', left: '2%', bottom: '25%' },
  treeTwo: { position: 'absolute', right: '4%', bottom: '27%' },
  backHill: { position: 'absolute', left: '-18%', bottom: '-20%', width: '85%', height: '55%', borderRadius: 150, backgroundColor: palette.leaf[300] },
  frontHill: { position: 'absolute', right: '-20%', bottom: '-28%', width: '85%', height: '58%', borderRadius: 160, backgroundColor: palette.leaf[400] },
  path: { position: 'absolute', left: '39%', bottom: '-30%', width: '23%', height: '58%', borderRadius: 60, backgroundColor: palette.tangerine[100], transform: [{ rotate: '12deg' }] },
  person: { position: 'absolute', bottom: '16%', width: 56, alignItems: 'center' },
  tom: { left: '27%' },
  mia: { left: '46%' },
  helper: { left: '68%' },
  head: { width: 38, height: 38, borderRadius: 20, borderWidth: 2, borderColor: palette.tangerine[900], overflow: 'hidden', zIndex: 2 },
  hair: { position: 'absolute', top: -3, left: 3, right: 3, height: 15, borderRadius: 14 },
  eyes: { position: 'absolute', top: 18, left: 9, right: 9, flexDirection: 'row', justifyContent: 'space-between' },
  smile: { position: 'absolute', left: 14, top: 26, width: 10, height: 5, borderBottomWidth: 2, borderColor: palette.coral[900], borderRadius: 5 },
  torso: { width: 44, height: 46, marginTop: -2, borderRadius: 16, borderWidth: 2, borderColor: palette.tangerine[800], alignItems: 'center', justifyContent: 'center' },
  armLeft: { position: 'absolute', left: -7, top: 9, width: 12, height: 25, borderRadius: 8, backgroundColor: SKIN, transform: [{ rotate: '18deg' }] },
  armRight: { position: 'absolute', right: -7, top: 9, width: 12, height: 25, borderRadius: 8, backgroundColor: SKIN, transform: [{ rotate: '-18deg' }] },
  legs: { flexDirection: 'row', gap: 8, marginTop: -1 },
  name: { color: palette.navy[500], marginTop: 1, textShadowColor: palette.paper[500], textShadowRadius: 3 },
  puppy: { position: 'absolute', left: '41%', bottom: '18%' },
  puppyBody: { width: 40, height: 22, marginTop: 14, borderRadius: 12, backgroundColor: palette.tangerine[300] },
  puppyHead: { position: 'absolute', left: -10, top: -14, width: 24, height: 22, borderRadius: 12, backgroundColor: palette.tangerine[300] },
  puppyNose: { position: 'absolute', left: 3, top: 9, width: 6, height: 5, borderRadius: 3, backgroundColor: palette.navy[500] },
  puppyEarLeft: { position: 'absolute', left: -12, top: -12, width: 9, height: 14, borderRadius: 5, backgroundColor: palette.tangerine[700], zIndex: 2 },
  puppyEarRight: { position: 'absolute', left: 6, top: -12, width: 9, height: 14, borderRadius: 5, backgroundColor: palette.tangerine[700], zIndex: 2 },
  puppyHeart: { position: 'absolute', right: -6, top: -16 },
  clue: { position: 'absolute', right: '28%', bottom: '26%' },
});
