import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { localize, type BranchingBody, type Locale, type StoryChoice, type VideoQuestion } from '@kidzo/shared';
import { useT } from '../../i18n';
import { API_URL } from '../../lib/config';
import { resolveMediaUrl } from '../../lib/media-url';
import { speak, speakAndWait, stopSpeaking } from '../../lib/narration';
import { DEFAULT_FEEDBACK_SECONDS } from '../../lib/answer-feedback';
import { useAnswerFeedback } from '../../lib/use-answer-feedback';
import { AnswerFeedback } from '../AnswerFeedback';
import { defaultVideoChoice, VIDEO_ANSWER_TIMEOUT_MS, videoQuestionSecondsRemaining } from '../../lib/video-question';
import { alpha, palette, radius, shadow, spacing, touchTargets, useTheme, type ColorName } from '../../theme/core';
import { Art } from '../art/Art';
import { Button } from '../Button';
import { SwooshProgress } from '../Controls';
import { Icon } from '../icon/Icon';
import { Text } from '../Typography';
import { Zo } from '../Zo';
import { KindnessScene } from './KindnessScene';

const CHOICE_WORLDS: ColorName[] = ['sky', 'mint', 'grape', 'tangerine'];

interface Props {
  body: BranchingBody;
  locale: Locale;
  familyMode: boolean;
  narration: boolean;
  /** Built-in animated stage used when a scene has no video. */
  sceneTheme?: 'kindness';
  /** Bundled clips by node id; they take priority over the scene's videoUrl. */
  sceneVideos?: Partial<Record<string, VideoSource>>;
  /** When true, a scene with a bundled clip unlocks "Next" only after the clip ends. */
  advanceAfterSceneVideo?: boolean;
  /** Child's age. Little Explorers (2 to 5) get no timer before answering. */
  childAge?: number;
  /** Seconds the choice feedback stays up (parent setting: 3, 5 or 8). */
  feedbackSeconds?: number;
  onFinish: (path: string[], selectedChoices: Record<string, string>) => void;
}

/** Big illustrated choice bubble: art on a world-colored disc beside the label. */
function ChoiceBubble({ label, art, world, onPress, disabled = false, chosen = false }: { label: string; art: string; world: ColorName; onPress: () => void; disabled?: boolean; chosen?: boolean }) {
  const theme = useTheme();
  const bg = theme.isCalm ? theme.surface : palette[world][50];
  const edge = theme.isCalm ? theme.line : palette[world][300];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: chosen }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, { backgroundColor: bg, borderColor: chosen ? palette.star[500] : edge, borderWidth: chosen ? 4 : 2, opacity: disabled && !chosen ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }, { translateY: pressed ? 3 : 0 }] }, shadow(1, palette[world][700], theme)]}
    >
      <View style={[styles.choiceArt, { backgroundColor: theme.isCalm ? theme.surfaceRaised : palette[world][200] }]}>
        <Art art={art} size={56} />
      </View>
      <Text variant="h3" style={{ flex: 1 }}>
        {label}
      </Text>
      <Icon name="forward" size={22} color={theme.textMuted} />
    </Pressable>
  );
}

/** Plays a branching adventure or a linear story, one scene at a time. */
export function StoryPlayer({ body, locale, familyMode, narration, sceneTheme, sceneVideos, advanceAfterSceneVideo = false, childAge, feedbackSeconds = DEFAULT_FEEDBACK_SECONDS, onFinish }: Props) {
  const { t } = useT();
  const theme = useTheme();
  const nodes = useMemo(() => new Map(body.nodes.map((n) => [n.id, n])), [body.nodes]);
  const [path, setPath] = useState<string[]>([body.startNodeId]);
  const [speaking, setSpeaking] = useState(false);
  const [failedVideoVisitKey, setFailedVideoVisitKey] = useState<string | null>(null);
  const [finishedVideoVisitKey, setFinishedVideoVisitKey] = useState<string | null>(null);
  const [questionVisitKey, setQuestionVisitKey] = useState<string | null>(null);
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({});
  const node = nodes.get(path[path.length - 1] ?? body.startNodeId);
  // A scene can be visited more than once, so playback state is keyed by visit, not node id.
  const visitKey = node ? `${node.id}:${path.length}` : '';
  const text = node ? localize(node.text, locale) : '';
  const parentsTurn = !!node?.familyTurn && familyMode;
  const sceneVideo = node ? (sceneVideos?.[node.id] ?? null) : null;
  const videoSource = sceneVideo ?? resolveMediaUrl(node?.scene.videoUrl, API_URL);
  const question = node?.videoQuestion;
  const waitForVideoEnd = advanceAfterSceneVideo && sceneVideo !== null && !question;
  const videoFailed = !!node && failedVideoVisitKey === visitKey;
  const videoFinished = !!node && finishedVideoVisitKey === visitKey;
  const questionIsVisible = !!node && questionVisitKey === visitKey;

  const onVideoFailure = useCallback((key: string, failed: boolean) => setFailedVideoVisitKey(failed ? key : null), []);
  const onVideoFinished = useCallback((key: string) => setFinishedVideoVisitKey(key), []);
  const onQuestionReveal = useCallback((key: string) => setQuestionVisitKey(key), []);
  // A choice is shown back to the child for the feedback time before the story moves on.
  const [pending, setPending] = useState<{ nodeId: string; choice: StoryChoice; message: string } | null>(null);
  const commit = () => {
    if (!pending) return;
    stopSpeaking();
    setSelectedChoices((previous) => ({ ...previous, [pending.nodeId]: pending.choice.id }));
    setPath((previous) => [...previous, pending.choice.next]);
    setPending(null);
    feedback.reset();
  };
  const feedback = useAnswerFeedback({ durationMs: feedbackSeconds * 1000, onDone: commit });
  const choose = useCallback(
    (choice: StoryChoice) => {
      if (!node || feedback.locked) return;
      stopSpeaking();
      const message = t('feedback.youChose', { choice: localize(choice.label, locale) });
      setPending({ nodeId: node.id, choice, message });
      feedback.answer(narration ? speakAndWait(message, locale, { calm: theme.isCalm }) : undefined);
    },
    [node, feedback, t, locale, narration, theme.isCalm],
  );
  const littleExplorer = childAge !== undefined && childAge <= 5;

  const calm = theme.isCalm;
  const read = (value: string) => {
    void speak(value, locale, { calm, onStart: () => setSpeaking(true), onDone: () => setSpeaking(false) });
  };

  // Read each new scene aloud once when narration is on. Timed questions are read when they appear.
  useEffect(() => {
    if (narration && text && (!question || questionIsVisible)) {
      void speak(text, locale, { calm, onStart: () => setSpeaking(true), onDone: () => setSpeaking(false) });
    }
    return () => stopSpeaking();
  }, [narration, text, locale, calm, question, questionIsVisible]);

  if (!node) return null;
  const go = (next: string) => {
    stopSpeaking();
    setPath((p) => [...p, next]);
  };
  const sceneBg = calm ? theme.surface : node.scene.color;
  const showChoices = node.choices.length > 0 && (!question || questionIsVisible);

  return (
    <View style={styles.wrap}>
      <SwooshProgress done={path.length - (node.ending ? 0 : 1)} total={Math.max(path.length + (node.ending ? 0 : 1), 3)} label={t('player.progress')} />
      <Animated.View key={visitKey} entering={FadeIn.duration(350)} style={[styles.scene, { backgroundColor: sceneBg }, shadow(2, undefined, theme)]}>
        <StoryScene
          key={visitKey}
          playbackKey={visitKey}
          sceneId={node.id}
          source={videoSource}
          loop={!waitForVideoEnd && !question}
          sceneTheme={sceneTheme}
          art={node.scene.art}
          question={question}
          questionText={text}
          choices={node.choices}
          onChoice={choose}
          autoAnswer={!littleExplorer}
          onQuestionReveal={onQuestionReveal}
          onFailure={onVideoFailure}
          onFinished={onVideoFinished}
        />
      </Animated.View>

      {parentsTurn ? (
        <View style={[styles.familyBanner, { backgroundColor: palette.grape[500] }]} accessibilityRole="header">
          <Icon name="familyMode" size={32} color={palette.paper[500]} accent={palette.grape[200]} />
          <View style={{ flex: 1 }}>
            <Text variant="kicker" color={palette.paper[500]}>
              {t('player.familyMode')}
            </Text>
            <Text variant="h2" color={palette.paper[500]}>
              {t('player.parentsTurn')}
            </Text>
          </View>
        </View>
      ) : null}

      {!question ? (
        <Animated.View key={`${visitKey}-text`} entering={FadeInDown.duration(400)} style={styles.speech}>
          <Zo size={64} mood={calm ? 'sleepy' : node.ending ? 'celebrating' : 'happy'} bounce={!calm} />
          <View style={[styles.bubble, { backgroundColor: theme.surface }, shadow(1, undefined, theme)]}>
            <Text variant="h3" style={styles.storyText}>
              {text}
            </Text>
            <Button
              label={speaking ? t('player.stop') : t('player.readAloud')}
              icon={speaking ? 'stop' : 'readAloud'}
              size="sm"
              variant="ghost"
              onPress={() => (speaking ? (stopSpeaking(), setSpeaking(false)) : read(text))}
            />
          </View>
        </Animated.View>
      ) : null}

      <View style={styles.choices}>
        {pending ? (
          <AnswerFeedback tone="neutral" message={pending.message} snapshot={feedback.snapshot} onNext={feedback.next} />
        ) : null}
        {showChoices ? (
          node.choices.map((choice, i) => (
            <ChoiceBubble
              key={choice.id}
              label={localize(choice.label, locale)}
              art={choice.art}
              world={CHOICE_WORLDS[i % CHOICE_WORLDS.length] ?? 'sky'}
              disabled={!!pending}
              chosen={pending?.choice.id === choice.id}
              onPress={() => choose(choice)}
            />
          ))
        ) : question && !questionIsVisible ? (
          <Text variant="caption" muted align="center">
            {t('player.watchForQuestion')}
          </Text>
        ) : node.next ? (
          waitForVideoEnd && !videoFinished && !videoFailed ? (
            <Text variant="caption" muted align="center">
              {t('player.watchToUnlock')}
            </Text>
          ) : (
            <Button label={t('player.next')} iconRight="forward" size="kid" fullWidth variant={calm ? 'moon' : 'primary'} onPress={() => go(node.next as string)} />
          )
        ) : (
          <Button
            label={t('common.done')}
            icon="star"
            size="kid"
            fullWidth
            variant={calm ? 'moon' : 'star'}
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

interface SceneProps {
  playbackKey: string;
  sceneId: string;
  source: VideoSource | null;
  loop: boolean;
  sceneTheme?: 'kindness';
  art: string;
  question?: VideoQuestion;
  questionText: string;
  choices: StoryChoice[];
  onChoice: (choice: StoryChoice) => void;
  /** When false (Little Explorers), the timed question waits for the child instead of picking the default. */
  autoAnswer: boolean;
  onQuestionReveal: (playbackKey: string) => void;
  onFailure: (playbackKey: string, failed: boolean) => void;
  onFinished: (playbackKey: string) => void;
}

/**
 * One scene's picture: its video, the kindness stage, or its art. With a timed question the video
 * pauses at the timestamp, the question appears, and the default answer is picked after the timeout.
 */
function StoryScene({ playbackKey, sceneId, source, loop, sceneTheme, art, question, questionText, choices, onChoice, autoAnswer, onQuestionReveal, onFailure, onFinished }: SceneProps) {
  const { t } = useT();
  const [failed, setFailed] = useState(false);
  const [questionVisible, setQuestionVisible] = useState(!question);
  const [secondsRemaining, setSecondsRemaining] = useState(VIDEO_ANSWER_TIMEOUT_MS / 1000);
  const questionOpened = useRef(false);
  const answered = useRef(false);
  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.loop = loop;
    videoPlayer.timeUpdateEventInterval = 0.1;
  });
  const revealQuestion = useCallback(() => {
    if (!question || questionOpened.current) return;
    questionOpened.current = true;
    player.pause();
    setQuestionVisible(true);
    onQuestionReveal(playbackKey);
  }, [onQuestionReveal, playbackKey, player, question]);
  const choose = useCallback(
    (choice: StoryChoice) => {
      if (answered.current) return;
      answered.current = true;
      onChoice(choice);
    },
    [onChoice],
  );

  useEffect(() => {
    const statusSubscription = player.addListener('statusChange', ({ status }) => {
      const hasFailed = status === 'error';
      setFailed(hasFailed);
      onFailure(playbackKey, hasFailed);
      if (hasFailed) revealQuestion();
    });
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

  // Count down and pick the default answer when the child does not choose in time.
  useEffect(() => {
    if (!question || !questionVisible || !autoAnswer) return;
    const defaultChoice = defaultVideoChoice(choices, question);
    if (!defaultChoice) return;
    const deadline = Date.now() + VIDEO_ANSWER_TIMEOUT_MS;
    // The scene remounts on every visit, so the countdown state already starts full here.
    const interval = setInterval(() => setSecondsRemaining(videoQuestionSecondsRemaining(deadline, Date.now())), 100);
    const timeout = setTimeout(() => choose(defaultChoice), VIDEO_ANSWER_TIMEOUT_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [choices, choose, question, questionVisible, autoAnswer]);

  const overlay =
    question && questionVisible ? (
      <View style={styles.questionOverlay} accessibilityLiveRegion="polite">
        <Text variant="h3" color={palette.paper[500]} align="center">
          {questionText}
        </Text>
        {autoAnswer ? (
          <Text variant="caption" color={palette.paper[500]} align="center">
            {t('player.autoChoiceCountdown', { seconds: secondsRemaining })}
          </Text>
        ) : null}
      </View>
    ) : null;

  let picture;
  if (source && !failed) {
    picture = <VideoView player={player} style={styles.sceneVideo} nativeControls={!question} contentFit="contain" />;
  } else if (sceneTheme === 'kindness') {
    picture = <KindnessScene sceneId={sceneId} clue={art} height={240} />;
  } else {
    picture = (
      <Animated.View entering={ZoomIn.springify()}>
        <Art art={art} size={190} />
      </Animated.View>
    );
  }
  return (
    <>
      {picture}
      {overlay}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md },
  scene: { width: '100%', maxWidth: 720, minHeight: 240, aspectRatio: 16 / 9, alignSelf: 'center', borderRadius: radius.xl, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  sceneVideo: { width: '100%', height: '100%' },
  questionOverlay: { position: 'absolute', left: spacing.sm, right: spacing.sm, bottom: spacing.sm, gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: alpha(palette.navy[500], 0.9) },
  familyBanner: { borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  speech: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  bubble: { flex: 1, borderRadius: radius.lg, borderTopLeftRadius: radius.xs, padding: spacing.md, gap: spacing.xs },
  storyText: { lineHeight: 28 },
  choices: { gap: spacing.sm, marginTop: 'auto' },
  choice: { minHeight: touchTargets.little + 8, borderRadius: radius.xl, borderWidth: 2, padding: spacing.xs, paddingRight: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  choiceArt: { width: 64, height: 64, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
