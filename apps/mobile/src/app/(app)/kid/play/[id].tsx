import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { localize, type Child, type ContentDetail, type Locale } from '@kidzo/shared';
import { Art } from '../../../../components/art/Art';
import { Button } from '../../../../components/Button';
import { ConfirmDialog } from '../../../../components/ConfirmDialog';
import { Icon } from '../../../../components/icon/Icon';
import { IconButton } from '../../../../components/IconButton';
import { Row, Screen } from '../../../../components/Layout';
import { QuizPlayer } from '../../../../components/players/QuizPlayer';
import { SongPlayer } from '../../../../components/players/SongPlayer';
import { VideoPlayer } from '../../../../components/players/VideoPlayer';
import { StoryPlayer } from '../../../../components/players/StoryPlayer';
import { ErrorView, LoadingView } from '../../../../components/States';
import { Text } from '../../../../components/Typography';
import { useT } from '../../../../i18n';
import { useFamily } from '../../../../lib/family';
import { setLastResult } from '../../../../lib/last-result';
import { stopSpeaking } from '../../../../lib/narration';
import { usePlaySession } from '../../../../lib/play-session';
import { useContentDetail, useTimezone } from '../../../../lib/queries';
import { palette, radius, spacing, useTheme } from '../../../../theme/core';

export default function PlayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeChild, familyMode } = useFamily();
  const detail = useContentDetail(id, activeChild);

  if (!activeChild) return null;
  if (detail.isLoading) return <Screen scroll={false}><LoadingView /></Screen>;
  if (!detail.data) {
    return (
      <Screen scroll={false}>
        <ErrorView error={detail.error} onRetry={() => void detail.refetch()} />
      </Screen>
    );
  }
  return <Player child={activeChild} content={detail.data} familyMode={familyMode} />;
}

function Player({ child, content, familyMode }: { child: Child; content: ContentDetail; familyMode: boolean }) {
  const { t } = useT();
  const theme = useTheme();
  const [confirmExit, setConfirmExit] = useState(false);
  const timezone = useTimezone();
  const session = usePlaySession({ child, content, familyMode, timezone });
  const [saving, setSaving] = useState(false);
  const locale = child.locale as Locale;

  useEffect(() => {
    if (session.phase === 'blocked' && session.blockReason) {
      router.replace({ pathname: '/kid/blocked', params: { reason: session.blockReason } });
    }
  }, [session.phase, session.blockReason]);

  const finish = async (path: string[], answers?: Record<string, string>) => {
    setSaving(true);
    try {
      const result = await session.finish(path, answers);
      setLastResult({ ...result, content, path, childId: child.id });
      router.replace('/kid/complete');
    } catch {
      setSaving(false);
      Alert.alert(t('common.error'), t('error.generic'));
    }
  };

  const leave = () => {
    setConfirmExit(false);
    stopSpeaking();
    router.back();
  };

  if (session.phase === 'starting' || session.phase === 'blocked' || saving) {
    return <Screen scroll={false}><LoadingView /></Screen>;
  }
  if (session.phase === 'error') {
    return (
      <Screen scroll={false}>
        <ErrorView error={new Error(session.error ?? '')} onRetry={() => router.back()} />
      </Screen>
    );
  }
  if (session.phase === 'timesUp') {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <Art art="scene.time-up" size={220} />
        <Text variant="h1" align="center">
          {t('player.timesUp')}
        </Text>
        <Text muted align="center">
          {t('blocked.limitBody')}
        </Text>
        <Button label={t('complete.home')} icon="home" size="kid" variant={theme.isCalm ? 'moon' : 'primary'} onPress={() => router.replace('/kid/home')} />
      </Screen>
    );
  }

  const minutesLeft = session.remaining !== null ? Math.max(1, Math.ceil(session.remaining / 60)) : null;
  return (
    <Screen world scroll={content.body.kind !== 'song'}>
      <Row>
        <IconButton icon="close" label={t('player.exit')} onPress={() => setConfirmExit(true)} />
        <Text variant="bodyBold" numberOfLines={1} style={{ flex: 1 }} align="center">
          {localize(content.title, locale)}
        </Text>
        <View style={styles.close}>{familyMode ? <Icon name="familyMode" size={28} label={t('player.familyMode')} /> : null}</View>
      </Row>

      {session.warning && minutesLeft !== null ? (
        <View style={styles.headsUp} accessibilityLiveRegion="polite">
          <Icon name="timer" size={22} color={palette.navy[500]} />
          <Text variant="bodyBold" color={palette.navy[500]} style={{ flex: 1 }}>
            {t('player.headsUp', { minutes: minutesLeft })}
          </Text>
        </View>
      ) : null}

      {content.body.kind === 'branching' ? (
        <StoryPlayer
          body={content.body}
          locale={locale}
          familyMode={familyMode}
          narration={child.settings.narrationEnabled || child.age <= 5}
          childAge={child.age}
          feedbackSeconds={child.settings.feedbackSeconds}
          onFinish={(path, answers) => void finish(path, answers)}
        />
      ) : content.body.kind === 'quiz' ? (
        <QuizPlayer body={content.body} locale={locale} narration={child.settings.narrationEnabled || child.age <= 5} feedbackSeconds={child.settings.feedbackSeconds} onFinish={(path, answers) => void finish(path, answers)} />
      ) : content.body.kind === 'video' ? (
        <VideoPlayer
          body={content.body}
          locale={locale}
          narration={child.settings.narrationEnabled || child.age <= 5}
          feedbackSeconds={child.settings.feedbackSeconds}
          fallbackArt={content.coverArt}
          onFinish={(path, answers) => void finish(path, answers)}
        />
      ) : (
        <SongPlayer body={content.body} locale={locale} volume={child.settings.soundEffectsVolume} onFinish={() => void finish([])} />
      )}
      <ConfirmDialog
        visible={confirmExit}
        title={t('player.exit')}
        message={t('player.exitConfirm')}
        confirmLabel={t('player.exit')}
        cancelLabel={t('common.cancel')}
        onConfirm={leave}
        onCancel={() => setConfirmExit(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  headsUp: { backgroundColor: palette.star[200], borderRadius: radius.md, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, flex: 1 },
});
