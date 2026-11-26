import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { localize, type Locale, type QuizBody } from '@kidzo/shared';
import { useT } from '../../i18n';
import { DEFAULT_FEEDBACK_SECONDS } from '../../lib/answer-feedback';
import { speak, speakAndWait, stopSpeaking } from '../../lib/narration';
import { useAnswerFeedback } from '../../lib/use-answer-feedback';
import { palette, radius, shadow, spacing, useTheme } from '../../theme/core';
import { AnswerFeedback, type FeedbackTone } from '../AnswerFeedback';
import { Art } from '../art/Art';
import { SwooshProgress } from '../Controls';
import { Icon } from '../icon/Icon';
import { Text } from '../Typography';

interface Props {
  body: QuizBody;
  locale: Locale;
  narration: boolean;
  /** Seconds the answer feedback stays up (parent setting: 3, 5 or 8). */
  feedbackSeconds?: number;
  onFinish: (path: string[], answers: Record<string, string>) => void;
}

/**
 * Quiz game. One answer per question: the options lock on the first tap, Zo shows and says
 * whether it was right (or kindly gives the right answer), and the quiz moves on after the
 * feedback countdown or when the child taps Next.
 */
export function QuizPlayer({ body, locale, narration, feedbackSeconds = DEFAULT_FEEDBACK_SECONDS, onFinish }: Props) {
  const { t } = useT();
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ optionId: string; correct: boolean; message: string } | null>(null);
  const question = body.questions[index];

  const advance = () => {
    stopSpeaking();
    setResult(null);
    if (index + 1 < body.questions.length) {
      setIndex(index + 1);
      feedback.reset();
    } else onFinish(body.questions.map((q) => q.id), answers);
  };
  const feedback = useAnswerFeedback({ durationMs: feedbackSeconds * 1000, onDone: advance });

  useEffect(() => {
    if (narration && question) void speak(localize(question.prompt, locale), locale);
    return () => stopSpeaking();
  }, [index, narration, question, locale]);

  if (!question) return null;

  const choose = (optionId: string) => {
    if (feedback.locked) return;
    const correct = optionId === question.correctOptionId;
    const right = question.options.find((o) => o.id === question.correctOptionId);
    const explanation = question.explanation ? localize(question.explanation, locale) : '';
    const message = correct
      ? t('feedback.great')
      : [t('feedback.goodTry', { answer: right ? localize(right.label, locale) : '' }), explanation].filter(Boolean).join(' ');
    setAnswers((prev) => ({ ...prev, [question.id]: optionId }));
    setResult({ optionId, correct, message });
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    }
    feedback.answer(narration ? speakAndWait(message, locale, { calm: theme.isCalm }) : undefined);
  };

  const tone: FeedbackTone = result?.correct ? 'right' : 'gentle';

  return (
    <View style={styles.wrap}>
      <SwooshProgress done={index + (result ? 1 : 0)} total={body.questions.length} label={t('player.question', { current: index + 1, total: body.questions.length })} />
      <Text variant="caption" muted align="center">
        {t('player.question', { current: index + 1, total: body.questions.length })}
      </Text>
      <Animated.View key={question.id} entering={FadeIn} style={[styles.prompt, { backgroundColor: theme.surface }, shadow(2, palette.grape[700], theme)]}>
        <Art art={question.art} size={140} />
        <Text variant="h2" align="center">
          {localize(question.prompt, locale)}
        </Text>
      </Animated.View>

      <View style={styles.options}>
        {question.options.map((option) => {
          const chosen = result?.optionId === option.id;
          const isAnswer = !!result && option.id === question.correctOptionId;
          const gentleMiss = chosen && !result?.correct;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={localize(option.label, locale)}
              accessibilityState={{ selected: chosen, disabled: feedback.locked }}
              disabled={feedback.locked}
              onPress={() => choose(option.id)}
              style={({ pressed }) => [
                styles.option,
                shadow(1, undefined, theme),
                {
                  backgroundColor: isAnswer ? theme.successSurface : gentleMiss ? palette.star[50] : theme.surface,
                  borderColor: isAnswer ? theme.success : gentleMiss ? palette.star[400] : theme.line,
                  opacity: result && !isAnswer && !chosen ? 0.55 : 1,
                  transform: [{ scale: pressed && !feedback.locked ? 0.96 : 1 }],
                },
              ]}
            >
              <Art art={option.art} size={72} />
              <Text variant="bodyBold" align="center">
                {localize(option.label, locale)}
              </Text>
              {isAnswer || gentleMiss ? (
                <View style={[styles.mark, { backgroundColor: isAnswer ? theme.success : palette.star[500] }]}>
                  <Icon name={isAnswer ? 'check' : 'info'} size={16} color={isAnswer ? palette.paper[500] : palette.navy[500]} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {result ? (
        <View style={styles.feedback}>
          <AnswerFeedback tone={tone} message={result.message} snapshot={feedback.snapshot} onNext={feedback.next} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md },
  prompt: { alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.xl },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  option: { width: '45%', minHeight: 150, borderRadius: radius.lg, borderWidth: 3, alignItems: 'center', justifyContent: 'center', padding: spacing.sm, gap: 6 },
  mark: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  feedback: { marginTop: 'auto', gap: spacing.sm },
});
