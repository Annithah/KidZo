import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { localize, type Locale, type QuizBody } from '@kidzo/shared';
import { useT } from '../../i18n';
import { speak, stopSpeaking } from '../../lib/narration';
import { colors, radii, softShadow, spacing } from '../../theme';
import { ProgressBar } from '../Controls';
import { Text } from '../Typography';

interface Props {
  body: QuizBody;
  locale: Locale;
  narration: boolean;
  onFinish: (path: string[], answers: Record<string, string>) => void;
}

/**
 * Quiz game. The first answer to each question is what counts for stars; kids can keep
 * trying until they find the right one, with friendly feedback either way.
 */
export function QuizPlayer({ body, locale, narration, onFinish }: Props) {
  const { t } = useT();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ optionId: string; correct: boolean } | null>(null);
  const shake = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const question = body.questions[index];

  useEffect(() => {
    if (narration && question) void speak(localize(question.prompt, locale), locale);
    return () => stopSpeaking();
  }, [index, narration, question, locale]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  if (!question) return null;

  const choose = (optionId: string) => {
    if (feedback?.correct) return;
    const correct = optionId === question.correctOptionId;
    const nextAnswers = answers[question.id] ? answers : { ...answers, [question.id]: optionId };
    setAnswers(nextAnswers);
    setFeedback({ optionId, correct });
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    }
    if (!correct) {
      shake.set(withSequence(withTiming(-10, { duration: 60 }), withTiming(10, { duration: 60 }), withTiming(-6, { duration: 60 }), withTiming(0, { duration: 60 })));
      return;
    }
    timer.current = setTimeout(() => {
      setFeedback(null);
      if (index + 1 < body.questions.length) setIndex(index + 1);
      else onFinish(body.questions.map((q) => q.id), nextAnswers);
    }, 1200);
  };

  return (
    <View style={styles.wrap}>
      <Text variant="caption" muted>
        {t('player.question', { current: index + 1, total: body.questions.length })}
      </Text>
      <ProgressBar value={(index + (feedback?.correct ? 1 : 0)) / body.questions.length} color={colors.starYellow} />
      <Animated.View key={question.id} entering={FadeIn} style={styles.prompt}>
        <Text style={styles.promptEmoji}>{question.emoji}</Text>
        <Text variant="h2" align="center">
          {localize(question.prompt, locale)}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.options, shakeStyle]}>
        {question.options.map((option) => {
          const chosen = feedback?.optionId === option.id;
          const border = chosen ? (feedback?.correct ? colors.success : colors.error) : colors.line;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={localize(option.label, locale)}
              onPress={() => choose(option.id)}
              style={({ pressed }) => [
                styles.option,
                softShadow(2),
                { borderColor: border, transform: [{ scale: pressed ? 0.96 : 1 }] },
                chosen && feedback?.correct && { backgroundColor: '#E3F9EF' },
              ]}
            >
              <Text style={styles.optionEmoji}>{option.emoji}</Text>
              <Text variant="bodyBold" align="center">
                {localize(option.label, locale)}
              </Text>
            </Pressable>
          );
        })}
      </Animated.View>

      {feedback ? (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.feedback, { backgroundColor: feedback.correct ? colors.success : colors.coral }]}
        >
          <Text variant="h3" color={colors.white} align="center">
            {feedback.correct ? `🎉 ${t('player.correct')}` : `💪 ${t('player.tryAgain')}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md },
  prompt: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  promptEmoji: { fontSize: 72, lineHeight: 88 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  option: {
    width: '45%',
    minHeight: 132,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    gap: 6,
  },
  optionEmoji: { fontSize: 48, lineHeight: 58 },
  feedback: { borderRadius: radii.lg, padding: spacing.md, marginTop: 'auto' },
});
