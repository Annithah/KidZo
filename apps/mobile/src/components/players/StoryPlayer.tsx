import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { localize, type BranchingBody, type Locale } from '@kidzo/shared';
import { useT } from '../../i18n';
import { speak, stopSpeaking } from '../../lib/narration';
import { colors, radii, spacing, usePalette } from '../../theme';
import { Button, type ButtonVariant } from '../Button';
import { Text } from '../Typography';

const CHOICE_VARIANTS: ButtonVariant[] = ['sky', 'mint', 'lavender', 'yellow'];

interface Props {
  body: BranchingBody;
  locale: Locale;
  familyMode: boolean;
  narration: boolean;
  onFinish: (path: string[]) => void;
}

/** Plays a branching adventure or a linear story, one scene at a time. */
export function StoryPlayer({ body, locale, familyMode, narration, onFinish }: Props) {
  const { t } = useT();
  const palette = usePalette();
  const nodes = useMemo(() => new Map(body.nodes.map((n) => [n.id, n])), [body.nodes]);
  const [path, setPath] = useState<string[]>([body.startNodeId]);
  const [speaking, setSpeaking] = useState(false);
  const [failedVideoNodeId, setFailedVideoNodeId] = useState<string | null>(null);
  const node = nodes.get(path[path.length - 1] ?? body.startNodeId);
  const text = node ? localize(node.text, locale) : '';
  const parentsTurn = !!node?.familyTurn && familyMode;
  const videoUrl = node?.scene.videoUrl ?? null;
  const videoPlayer = useVideoPlayer(videoUrl, (player) => {
    player.loop = true;
  });

  useEffect(() => {
    const subscription = videoPlayer.addListener('statusChange', ({ status }) => {
      setFailedVideoNodeId(status === 'error' ? node?.id ?? null : null);
    });
    if (videoUrl) videoPlayer.play();
    else videoPlayer.pause();
    return () => {
      subscription.remove();
      videoPlayer.pause();
    };
  }, [node?.id, videoPlayer, videoUrl]);
  const videoFailed = !!node && failedVideoNodeId === node.id;

  const calm = palette.isCalm;
  const read = (value: string) => {
    void speak(value, locale, { calm, onStart: () => setSpeaking(true), onDone: () => setSpeaking(false) });
  };

  // Read each new scene aloud once when narration is on.
  useEffect(() => {
    if (narration && text) {
      void speak(text, locale, { calm, onStart: () => setSpeaking(true), onDone: () => setSpeaking(false) });
    }
    return () => stopSpeaking();
  }, [narration, text, locale, calm]);

  if (!node) return null;
  const go = (next: string) => {
    stopSpeaking();
    setPath((p) => [...p, next]);
  };

  return (
    <View style={styles.wrap}>
      <Animated.View key={node.id} entering={FadeIn.duration(350)} style={[styles.scene, { backgroundColor: node.scene.color }]}>
        {videoUrl && !videoFailed ? (
          <VideoView player={videoPlayer} style={styles.sceneVideo} nativeControls contentFit="cover" />
        ) : (
          <Text style={styles.sceneEmoji} accessibilityElementsHidden>
            {node.scene.emoji}
          </Text>
        )}
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

      <View style={styles.choices}>
        {node.choices.length > 0 ? (
          node.choices.map((choice, i) => (
            <Button
              key={choice.id}
              label={`${choice.emoji}  ${localize(choice.label, locale)}`}
              size="kid"
              fullWidth
              variant={palette.isCalm ? 'moon' : (CHOICE_VARIANTS[i % CHOICE_VARIANTS.length] ?? 'sky')}
              onPress={() => go(choice.next)}
            />
          ))
        ) : node.next ? (
          <Button label={`${t('player.next')}  ›`} size="kid" fullWidth variant={palette.isCalm ? 'moon' : 'primary'} onPress={() => go(node.next as string)} />
        ) : (
          <Button
            label={`🌟  ${t('common.done')}`}
            size="kid"
            fullWidth
            variant={palette.isCalm ? 'moon' : 'yellow'}
            onPress={() => {
              stopSpeaking();
              onFinish(path);
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md },
  scene: { height: 220, borderRadius: radii.xl, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  sceneVideo: { width: '100%', height: '100%' },
  sceneEmoji: { fontSize: 120, lineHeight: 140 },
  familyBanner: { backgroundColor: colors.lavender, borderRadius: radii.lg, padding: spacing.md, gap: 2 },
  textCard: { borderRadius: radii.lg, padding: spacing.md, gap: spacing.xs },
  storyText: { lineHeight: 30 },
  choices: { gap: spacing.sm, marginTop: 'auto' },
});
