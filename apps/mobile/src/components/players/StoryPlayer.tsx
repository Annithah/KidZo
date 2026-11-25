import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  localize,
  type BranchingBody,
  type Locale,
  type StoryChoice,
  type VideoQuestion,
} from '@kidzo/shared';
import { useT } from '../../i18n';
import { speak, stopSpeaking } from '../../lib/narration';
import { colors, radii, spacing, usePalette } from '../../theme';
import { Button, type ButtonVariant } from '../Button';
import { Text } from '../Typography';
import { KindnessScene } from './KindnessScene';
import { defaultVideoChoice, VIDEO_ANSWER_TIMEOUT_MS, videoQuestionSecondsRemaining } from '../../lib/video-question';

const CHOICE_VARIANTS: ButtonVariant[] = ['sky', 'mint', 'lavender', 'yellow'];

interface Props {
  body: BranchingBody;
  locale: Locale;
  familyMode: boolean;
  narration: boolean;
  sceneTheme?: 'kindness';
  sceneVideos?: Partial<Record<string, VideoSource>>;
  advanceAfterSceneVideo?: boolean;
  onFinish: (path: string[], selectedChoices: Record<string, string>) => void;
}

/** Plays a branching adventure or a linear story, one scene at a time. */
export function StoryPlayer({
  body,
  locale,
  familyMode,
  narration,
  sceneTheme,
  sceneVideos,
  advanceAfterSceneVideo = false,
  onFinish,
}: Props) {
  const { t } = useT();
  const palette = usePalette();
  const nodes = useMemo(() => new Map(body.nodes.map((n) => [n.id, n])), [body.nodes]);
  const [path, setPath] = useState<string[]>([body.startNodeId]);
  const [speaking, setSpeaking] = useState(false);
  const [failedVideoVisitKey, setFailedVideoVisitKey] = useState<string | null>(null);
  const [finishedVideoVisitKey, setFinishedVideoVisitKey] = useState<string | null>(null);
  const [questionVisitKey, setQuestionVisitKey] = useState<string | null>(null);
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({});
  const node = nodes.get(path[path.length - 1] ?? body.startNodeId);
  const visitKey = node ? `${node.id}:${path.length}` : '';
  const text = node ? localize(node.text, locale) : '';
  const parentsTurn = !!node?.familyTurn && familyMode;
  const videoUrl = node?.scene.videoUrl ?? null;
  const sceneVideo = node ? sceneVideos?.[node.id] ?? null : null;
  const videoSource = sceneVideo ?? videoUrl;
  const waitForVideoEnd = advanceAfterSceneVideo && sceneVideo !== null && !node?.videoQuestion;
  const onVideoFailure = useCallback((playbackKey: string, failed: boolean) => {
    setFailedVideoVisitKey(failed ? playbackKey : null);
  }, []);
  const onVideoFinished = useCallback((playbackKey: string) => {
    setFinishedVideoVisitKey(playbackKey);
  }, []);
  const onQuestionReveal = useCallback((playbackKey: string) => {
    setQuestionVisitKey(playbackKey);
  }, []);
  const videoFailed = !!node && failedVideoVisitKey === visitKey;
  const videoFinished = !!node && finishedVideoVisitKey === visitKey;
  const questionIsVisible = !!node && questionVisitKey === visitKey;

  const calm = palette.isCalm;
  const read = (value: string) => {
    void speak(value, locale, { calm, onStart: () => setSpeaking(true), onDone: () => setSpeaking(false) });
  };

  // Read each new scene aloud once when narration is on.
  useEffect(() => {
    if (narration && text && (!node?.videoQuestion || questionIsVisible)) {
      void speak(text, locale, { calm, onStart: () => setSpeaking(true), onDone: () => setSpeaking(false) });
    }
    return () => stopSpeaking();
  }, [narration, text, locale, calm, node?.videoQuestion, questionIsVisible]);

  if (!node) return null;
  const go = (next: string) => {
    stopSpeaking();
    setPath((p) => [...p, next]);
  };
  const choose = useCallback((choice: StoryChoice) => {
    if (!node) return;
    stopSpeaking();
    setSelectedChoices((previous) => ({ ...previous, [node.id]: choice.id }));
    setPath((previous) => [...previous, choice.next]);
  }, [node]);

  return (
    <View style={styles.wrap}>
      <Animated.View key={visitKey} entering={FadeIn.duration(350)} style={[styles.scene, { backgroundColor: node.scene.color }]}>
        <StoryScene
          key={visitKey}
          playbackKey={visitKey}
          sceneId={node.id}
          source={videoSource}
          loop={!waitForVideoEnd && !node.videoQuestion}
          sceneTheme={sceneTheme}
          emoji={node.scene.emoji}
          question={node.videoQuestion}
          questionText={text}
          choices={node.choices}
          locale={locale}
          onChoice={choose}
          onQuestionReveal={onQuestionReveal}
          onFailure={onVideoFailure}
          onFinished={onVideoFinished}
        />
      </Animated.View>

      {parentsTurn ? (
        <View style={styles.familyBanner} accessibilityRole="header">
          <Text variant="kicker" color={colors.white}>
            {t('player.familyMode')}
          </Text>
          <Text variant="h2" color={colors.white}>
            👋 {t('player.parentsTurn')}
          </Text>
        </View>
      ) : null}

      {!node.videoQuestion ? (
        <Animated.View key={`${node.id}-text`} entering={FadeInDown.duration(400)} style={[styles.textCard, { backgroundColor: palette.surface }]}>
          <Text variant="h3" style={styles.storyText}>
            {text}
          </Text>
          <Button
            label={speaking ? `⏹  ${t('player.stop')}` : `🔊  ${t('player.readAloud')}`}
            size="sm"
            variant="ghost"
            textColor={palette.text}
            onPress={() => (speaking ? (stopSpeaking(), setSpeaking(false)) : read(text))}
          />
        </Animated.View>
      ) : null}

      <View style={styles.choices}>
        {node.choices.length > 0 && (!node.videoQuestion || questionIsVisible) ? (
          node.choices.map((choice, i) => (
            <Button
              key={choice.id}
              label={`${choice.emoji}  ${localize(choice.label, locale)}`}
              size="kid"
              fullWidth
              variant={palette.isCalm ? 'moon' : (CHOICE_VARIANTS[i % CHOICE_VARIANTS.length] ?? 'sky')}
              onPress={() => choose(choice)}
            />
          ))
        ) : node.videoQuestion && !questionIsVisible ? (
          <Text variant="caption" muted align="center">
            {t('player.watchForQuestion')}
          </Text>
        ) : node.next ? (
          waitForVideoEnd && !videoFinished && !videoFailed ? (
            <Text variant="caption" muted align="center">
              Watch this short clip to unlock the next step.
            </Text>
          ) : (
            <Button label={`${t('player.next')}  ›`} size="kid" fullWidth variant={palette.isCalm ? 'moon' : 'primary'} onPress={() => go(node.next as string)} />
          )
        ) : (
          <Button
            label={`🌟  ${t('common.done')}`}
            size="kid"
            fullWidth
            variant={palette.isCalm ? 'moon' : 'yellow'}
            onPress={() => {
              stopSpeaking();
              onFinish(path, selectedChoices);
            }}
          />
        )}
      </View>
    </View>
  );
}

function StoryScene({
  playbackKey,
  sceneId,
  source,
  loop,
  sceneTheme,
  emoji,
  question,
  questionText,
  choices,
  locale,
  onChoice,
  onQuestionReveal,
  onFailure,
  onFinished,
}: {
  playbackKey: string;
  sceneId: string;
  source: VideoSource | null;
  loop: boolean;
  sceneTheme?: 'kindness';
  emoji: string;
  question?: VideoQuestion;
  questionText: string;
  choices: StoryChoice[];
  locale: Locale;
  onChoice: (choice: StoryChoice) => void;
  onQuestionReveal: (playbackKey: string) => void;
  onFailure: (playbackKey: string, failed: boolean) => void;
  onFinished: (playbackKey: string) => void;
}) {
  const { t } = useT();
  const [failed, setFailed] = useState(false);
  const [questionVisible, setQuestionVisible] = useState(!question);
  const [secondsRemaining, setSecondsRemaining] = useState(VIDEO_ANSWER_TIMEOUT_MS / 1000);
  const questionOpened = useRef(false);
  const answered = useRef(false);
  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.loop = loop;
  });
  const revealQuestion = useCallback(() => {
    if (!question || questionOpened.current) return;
    questionOpened.current = true;
    player.pause();
    setQuestionVisible(true);
    onQuestionReveal(playbackKey);
  }, [onQuestionReveal, playbackKey, player, question]);
  const choose = useCallback((choice: StoryChoice) => {
    if (answered.current) return;
    answered.current = true;
    onChoice(choice);
  }, [onChoice]);

  useEffect(() => {
    const statusSubscription = player.addListener('statusChange', ({ status }) => {
      const hasFailed = status === 'error';
      setFailed(hasFailed);
      onFailure(playbackKey, hasFailed);
      if (hasFailed) revealQuestion();
    });
    player.timeUpdateEventInterval = 0.1;
    const timeSubscription = player.addListener('timeUpdate', ({ currentTime }) => {
      if (question && currentTime >= question.timestampSeconds) revealQuestion();
    });
    const endSubscription = player.addListener('playToEnd', () => {
      if (question) revealQuestion();
      else onFinished(playbackKey);
    });
    if (source) player.play();
    else {
      player.pause();
      revealQuestion();
    }
    return () => {
      statusSubscription.remove();
      timeSubscription.remove();
      endSubscription.remove();
      player.pause();
    };
  }, [onFailure, onFinished, playbackKey, player, question, revealQuestion, source]);

  useEffect(() => {
    if (!question || !questionVisible) return;
    const defaultChoice = defaultVideoChoice(choices, question);
    if (!defaultChoice) return;
    const timeoutMs = VIDEO_ANSWER_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;
    setSecondsRemaining(timeoutMs / 1000);
    const interval = setInterval(() => {
      setSecondsRemaining(videoQuestionSecondsRemaining(deadline, Date.now()));
    }, 100);
    const timeout = setTimeout(() => choose(defaultChoice), timeoutMs);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [choices, choose, question, questionVisible]);

  if (source && !failed) {
    return (
      <>
        <VideoView player={player} style={styles.sceneVideo} nativeControls={!question} contentFit="contain" />
        {question && questionVisible ? (
          <View style={styles.questionOverlay} accessibilityLiveRegion="polite">
            <Text variant="h3" color={colors.white} align="center">{questionText}</Text>
            <Text variant="caption" color={colors.white} align="center">
              {t('player.autoChoiceCountdown', { seconds: secondsRemaining })}
            </Text>
          </View>
        ) : null}
      </>
    );
  }
  if (sceneTheme === 'kindness') {
    return (
      <>
        <KindnessScene sceneId={sceneId} clue={emoji} />
        {question && questionVisible ? (
          <View style={styles.questionOverlay} accessibilityLiveRegion="polite">
            <Text variant="h3" color={colors.white} align="center">{questionText}</Text>
            <Text variant="caption" color={colors.white} align="center">
              {t('player.autoChoiceCountdown', { seconds: secondsRemaining })}
            </Text>
          </View>
        ) : null}
      </>
    );
  }
  return (
    <>
      <Text style={styles.sceneEmoji} accessibilityElementsHidden>{emoji}</Text>
      {question && questionVisible ? (
        <View style={styles.questionOverlay} accessibilityLiveRegion="polite">
          <Text variant="h3" color={colors.white} align="center">{questionText}</Text>
          <Text variant="caption" color={colors.white} align="center">
            {t('player.autoChoiceCountdown', { seconds: secondsRemaining })}
          </Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md },
  scene: { width: '100%', maxWidth: 720, aspectRatio: 16 / 9, alignSelf: 'center', borderRadius: radii.xl, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  sceneVideo: { width: '100%', height: '100%' },
  sceneEmoji: { fontSize: 120, lineHeight: 140 },
  questionOverlay: { position: 'absolute', left: spacing.sm, right: spacing.sm, bottom: spacing.sm, gap: spacing.xs, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: 'rgba(24, 38, 64, 0.9)' },
  familyBanner: { backgroundColor: colors.lavender, borderRadius: radii.lg, padding: spacing.md, gap: 2 },
  textCard: { borderRadius: radii.lg, padding: spacing.md, gap: spacing.xs },
  storyText: { lineHeight: 30 },
  choices: { gap: spacing.sm, marginTop: 'auto' },
});
