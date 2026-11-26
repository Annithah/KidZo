import { NetworkStateType, useNetworkState } from 'expo-network';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import { calmVolume, getSleepTimerEnd, useSleepTimer } from '../../lib/sleep-timer';
import { StyleSheet, View } from 'react-native';
import { localize, type Locale, type VideoBody } from '@kidzo/shared';
import { useT } from '../../i18n';
import { API_URL } from '../../lib/config';
import { resolveMediaUrl } from '../../lib/media-url';
import { radius, shadow, spacing, useTheme } from '../../theme/core';
import { Art } from '../art/Art';
import { Button } from '../Button';
import { Text } from '../Typography';
import { QuizPlayer } from './QuizPlayer';

interface Props {
  body: VideoBody;
  locale: Locale;
  narration: boolean;
  feedbackSeconds?: number;
  /** Art shown when the video cannot play. */
  fallbackArt: string;
  onFinish: (path: string[], answers: Record<string, string>) => void;
}

/** Kept outside the component: expo-video players are changed by assigning properties. */
function setVolume(player: { volume: number }, volume: number) {
  player.volume = volume;
}

/** Data saver: the 480p file on mobile data, 720p on Wi-Fi, the default stream otherwise. */
export function pickVideoUrl(body: Pick<VideoBody, 'videoUrl' | 'variants'>, onCellular: boolean): string {
  if (onCellular) return body.variants.p480 ?? body.videoUrl;
  return body.variants.p720 ?? body.videoUrl;
}

/** Plays one video, then its quiz (with the shared answer feedback) if it has one. */
export function VideoPlayer({ body, locale, narration, feedbackSeconds, fallbackArt, onFinish }: Props) {
  const { t } = useT();
  const theme = useTheme();
  const network = useNetworkState();
  const onCellular = network.type === NetworkStateType.CELLULAR;
  // Choose once per video so a network change does not restart playback.
  const [source] = useState(() => resolveMediaUrl(pickVideoUrl(body, onCellular), API_URL));
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
  });

  // Bedtime: fade out at the end of each clip and as the sleep timer runs out, then stop.
  const sleepEndsAt = useSleepTimer();
  const [asleep, setAsleep] = useState(false);
  useEffect(() => {
    if (!theme.isCalm) return;
    const tick = () => {
      const now = Date.now();
      const duration = player.duration;
      const clipRemainingMs = duration > 0 ? (duration - player.currentTime) * 1000 : null;
      setVolume(player, calmVolume({ now, endsAt: getSleepTimerEnd(), clipRemainingMs }));
      const end = getSleepTimerEnd();
      if (end !== null && now >= end) {
        player.pause();
        setAsleep(true);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [player, theme.isCalm, sleepEndsAt]);

  useEffect(() => {
    const end = player.addListener('playToEnd', () => setEnded(true));
    const status = player.addListener('statusChange', ({ status: s }) => setFailed(s === 'error'));
    player.play();
    return () => {
      end.remove();
      status.remove();
      player.pause();
    };
  }, [player]);

  const credit = useMemo(() => {
    const c = body.credit;
    return [c.author, c.attribution, c.license].filter((v, i, all) => v && all.indexOf(v) === i).join(' · ');
  }, [body.credit]);

  if (quizOpen && body.quiz.length > 0) {
    return (
      <QuizPlayer
        body={{ kind: 'quiz', questions: body.quiz }}
        locale={locale}
        narration={narration}
        feedbackSeconds={feedbackSeconds}
        onFinish={(path, answers) => onFinish(path, answers)}
      />
    );
  }

  const canContinue = ended || failed || asleep;
  return (
    <View style={styles.wrap}>
      <View style={[styles.stage, { backgroundColor: theme.surfaceSunken }, shadow(2, undefined, theme)]}>
        {failed ? (
          <View style={styles.fallback}>
            <Art art={fallbackArt} size={160} />
            <Text variant="bodyBold" align="center">
              {t('video.cannotPlay')}
            </Text>
          </View>
        ) : (
          <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
        )}
      </View>
      {body.captions ? (
        <Text variant="h3" align="center">
          {localize(body.captions, locale)}
        </Text>
      ) : null}
      {credit ? (
        <Text variant="caption" muted align="center">
          {t('video.credit', { credit })}
        </Text>
      ) : null}
      <View style={styles.actions}>
        {canContinue ? (
          body.quiz.length > 0 && !asleep ? (
            <Button label={t('video.quizTime')} icon="question" size="kid" fullWidth onPress={() => setQuizOpen(true)} />
          ) : (
            <Button label={t('common.done')} icon="star" size="kid" fullWidth variant={theme.isCalm ? 'moon' : 'star'} onPress={() => onFinish([], {})} />
          )
        ) : (
          <Text variant="caption" muted align="center">
            {asleep ? t('sleep.goodnight') : t('video.watchToEnd')}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md },
  stage: { width: '100%', maxWidth: 720, aspectRatio: 16 / 9, alignSelf: 'center', borderRadius: radius.xl, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  actions: { marginTop: 'auto', gap: spacing.sm },
});
