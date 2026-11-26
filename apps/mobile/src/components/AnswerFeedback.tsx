import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useT } from '../i18n';
import type { FeedbackSnapshot } from '../lib/answer-feedback';
import { palette, radius, spacing, useTheme } from '../theme/core';
import { Button } from './Button';
import { Confetti } from './Confetti';
import { Icon } from './icon/Icon';
import { Text } from './Typography';
import { Zo } from './Zo';

export type FeedbackTone = 'right' | 'gentle' | 'neutral';

interface Props {
  tone: FeedbackTone;
  /** What Zo says, shown as a caption of the narration. */
  message: string;
  snapshot: FeedbackSnapshot;
  onNext: () => void;
}

const RING = 56;
const STROKE = 6;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/** Ring that empties as the feedback countdown runs, with the seconds left in the middle. */
function CountdownRing({ snapshot }: { snapshot: FeedbackSnapshot }) {
  const theme = useTheme();
  const fraction = snapshot.durationMs > 0 ? snapshot.remainingMs / snapshot.durationMs : 0;
  const seconds = Math.ceil(snapshot.remainingMs / 1000);
  const { t } = useT();
  return (
    <View style={styles.ring} accessible accessibilityLabel={t('feedback.secondsLeft', { seconds })}>
      <Svg width={RING} height={RING}>
        <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={theme.isCalm ? theme.line : palette.star[100]} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={R}
          stroke={theme.isCalm ? palette.moon[500] : palette.coral[500]}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={CIRC * (1 - fraction)}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <Text variant="h3" style={styles.ringNumber}>
        {seconds}
      </Text>
    </View>
  );
}

/**
 * The panel shown after every answer: Zo, a caption of what Zo says, an emptying countdown
 * ring and a Next button that appears after 1.5 seconds. Icons back up color, and confetti
 * is skipped when the device asks for reduced motion.
 */
export function AnswerFeedback({ tone, message, snapshot, onNext }: Props) {
  const { t } = useT();
  const theme = useTheme();
  const reduce = useReducedMotion();
  const bg = tone === 'right' ? theme.successSurface : tone === 'gentle' ? palette.star[50] : theme.surface;
  const icon = tone === 'right' ? 'checkCircle' : tone === 'gentle' ? 'info' : 'star';
  return (
    <>
      {tone === 'right' && !theme.isCalm ? <Confetti /> : null}
      <Animated.View
        entering={reduce ? FadeIn : ZoomIn.springify()}
        accessibilityLiveRegion="polite"
        style={[styles.panel, { backgroundColor: bg, borderColor: tone === 'right' ? theme.success : palette.star[300] }]}
      >
        <Zo size={64} mood={tone === 'right' ? 'cheering' : tone === 'gentle' ? 'thinking' : 'happy'} bounce={!reduce && tone === 'right'} />
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <View style={styles.titleRow}>
            <Icon name={icon} size={20} color={tone === 'right' ? theme.successText : palette.navy[500]} />
            <Text variant="caption" muted>
              {snapshot.phase === 'locked' ? t('feedback.listen') : t('feedback.nextIn')}
            </Text>
          </View>
          <Text variant="bodyBold">{message}</Text>
        </View>
        <CountdownRing snapshot={snapshot} />
      </Animated.View>
      <View style={styles.nextSlot}>
        {snapshot.nextAvailable && snapshot.phase !== 'done' ? (
          <Animated.View entering={FadeIn}>
            <Button label={t('player.next')} iconRight="forward" size="kid" fullWidth variant={theme.isCalm ? 'moon' : 'primary'} onPress={onNext} />
          </Animated.View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  panel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, borderWidth: 2, padding: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ringNumber: { position: 'absolute' },
  // Keeps the layout steady when the Next button appears.
  nextSlot: { minHeight: 72, justifyContent: 'center' },
});
