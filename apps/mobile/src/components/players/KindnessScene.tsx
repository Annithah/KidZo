import { useEffect } from 'react';
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
import { Text } from '../Typography';

interface Props {
  sceneId: string;
  clue: string;
  height?: number;
}

export function KindnessScene({ sceneId, clue, height = 220 }: Props) {
  const helperVisible = ['ask-helper', 'reflection', 'safe-choice', 'helper', 'ending'].includes(sceneId);
  const puppyEmoji = sceneId === 'ending' ? '🐶💖' : '🐶';

  return (
    <View style={[styles.stage, { height }]}>
      <View style={styles.sky} />
      <View style={styles.sun} />
      <Drifter style={styles.cloudOne}>☁️</Drifter>
      <Drifter style={styles.cloudTwo}>☁️</Drifter>
      <Text style={styles.treeOne} accessibilityElementsHidden>🌳</Text>
      <Text style={styles.treeTwo} accessibilityElementsHidden>🌲</Text>
      <View style={styles.backHill} />
      <View style={styles.frontHill} />
      <View style={styles.path} />
      <AnimatedPerson name="Tom" shirt="#FFC94F" hair="#573421" style={styles.tom} />
      <AnimatedPerson name="Mia" shirt="#F47EAA" hair="#4A2D24" style={styles.mia} />
      {helperVisible ? <AnimatedPerson name="Helper" shirt="#5EA9E8" hair="#49372D" style={styles.helper} /> : null}
      <Drifter style={styles.puppy}>{puppyEmoji}</Drifter>
      <Text style={styles.clue} accessibilityElementsHidden>{clue}</Text>
    </View>
  );
}

function Drifter({ children, style }: { children: string; style: object }) {
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
      <Text>{children}</Text>
    </Animated.View>
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
      <View style={[styles.head, { backgroundColor: '#B87552' }]}>
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
  stage: { width: '100%', borderRadius: 22, overflow: 'hidden', backgroundColor: '#95DFFF' },
  sky: { ...StyleSheet.absoluteFill, backgroundColor: '#A8E5FF' },
  sun: { position: 'absolute', top: '8%', right: '10%', width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFE879' },
  cloudOne: { position: 'absolute', top: '12%', left: '12%', fontSize: 28 },
  cloudTwo: { position: 'absolute', top: '24%', left: '58%', fontSize: 22 },
  treeOne: { position: 'absolute', left: '2%', bottom: '25%', fontSize: 48 },
  treeTwo: { position: 'absolute', right: '4%', bottom: '27%', fontSize: 38 },
  backHill: { position: 'absolute', left: '-18%', bottom: '-20%', width: '85%', height: '55%', borderRadius: 150, backgroundColor: '#83D891' },
  frontHill: { position: 'absolute', right: '-20%', bottom: '-28%', width: '85%', height: '58%', borderRadius: 160, backgroundColor: '#65C982' },
  path: { position: 'absolute', left: '39%', bottom: '-30%', width: '23%', height: '58%', borderRadius: 60, backgroundColor: '#F3D69A', transform: [{ rotate: '12deg' }] },
  person: { position: 'absolute', bottom: '16%', width: 56, alignItems: 'center' },
  tom: { left: '27%' },
  mia: { left: '46%' },
  helper: { left: '68%' },
  head: { width: 38, height: 38, borderRadius: 20, borderWidth: 2, borderColor: '#71452F', overflow: 'hidden', zIndex: 2 },
  hair: { position: 'absolute', top: -3, left: 3, right: 3, height: 15, borderRadius: 14 },
  eyes: { position: 'absolute', top: 18, left: 9, right: 9, flexDirection: 'row', justifyContent: 'space-between' },
  smile: { position: 'absolute', left: 14, top: 26, width: 10, height: 5, borderBottomWidth: 2, borderColor: '#743A37', borderRadius: 5 },
  torso: { width: 44, height: 46, marginTop: -2, borderRadius: 16, borderWidth: 2, borderColor: '#A76A37', alignItems: 'center', justifyContent: 'center' },
  armLeft: { position: 'absolute', left: -7, top: 9, width: 12, height: 25, borderRadius: 8, backgroundColor: '#B87552', transform: [{ rotate: '18deg' }] },
  armRight: { position: 'absolute', right: -7, top: 9, width: 12, height: 25, borderRadius: 8, backgroundColor: '#B87552', transform: [{ rotate: '-18deg' }] },
  legs: { flexDirection: 'row', gap: 8, marginTop: -1 },
  name: { color: '#18324B', marginTop: 1, textShadowColor: '#FFFFFF', textShadowRadius: 3 },
  puppy: { position: 'absolute', left: '41%', bottom: '18%', fontSize: 38 },
  clue: { position: 'absolute', right: '28%', bottom: '26%', fontSize: 27 },
});
