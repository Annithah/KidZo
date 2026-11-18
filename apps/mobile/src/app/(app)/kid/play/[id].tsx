import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { localize, type Child, type ContentDetail, type Locale } from '@kidzo/shared';
import { Button } from '../../../../components/Button';
import { Row, Screen } from '../../../../components/Layout';
import { QuizPlayer } from '../../../../components/players/QuizPlayer';
import { SongPlayer } from '../../../../components/players/SongPlayer';
import { StoryPlayer } from '../../../../components/players/StoryPlayer';
import { ErrorView, LoadingView } from '../../../../components/States';
import { Text } from '../../../../components/Typography';
import { Zo } from '../../../../components/Zo';
import { useT } from '../../../../i18n';
import { useFamily } from '../../../../lib/family';
import { setLastResult } from '../../../../lib/last-result';
import { stopSpeaking } from '../../../../lib/narration';
import { usePlaySession } from '../../../../lib/play-session';
import { useContentDetail, useTimezone } from '../../../../lib/queries';
import { colors, radii, softShadow, spacing, usePalette } from '../../../../theme';

export default function PlayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeChild, familyMode } = useFamily();
  const detail = useContentDetail(id);

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
  const palette = usePalette();
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

  const exit = () => {
    const leave = () => {
      stopSpeaking();
      router.back();
    };
    if (Platform.OS === 'web') return leave();
    Alert.alert(t('player.exit'), t('player.exitConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('player.exit'), style: 'destructive', onPress: leave },
    ]);
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
        <Zo size={140} mood="sleepy" />
        <Text variant="h1" align="center">
          {t('player.timesUp')}
        </Text>
        <Text muted align="center">
          {t('blocked.limitBody')}
        </Text>
        <Button label={t('complete.home')} size="kid" onPress={() => router.replace('/kid/home')} />
      </Screen>
    );
  }

  const minutesLeft = session.remaining !== null ? Math.max(1, Math.ceil(session.remaining / 60)) : null;
  return (
    <Screen scroll={content.body.kind !== 'song'}>
      <Row>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('player.exit')}
          onPress={exit}
          hitSlop={10}
          style={[styles.close, { backgroundColor: palette.surface }, softShadow(2)]}
        >
          <Text variant="h3">✕</Text>
        </Pressable>
        <Text variant="bodyBold" numberOfLines={1} style={{ flex: 1 }} align="center">
          {localize(content.title, locale)}
        </Text>
        <View style={styles.close}>{familyMode ? <Text variant="h3">👨‍👩‍👧</Text> : null}</View>
      </Row>

      {session.warning && minutesLeft !== null ? (
        <View style={styles.headsUp} accessibilityLiveRegion="polite">
          <Text variant="bodyBold" color={colors.navy} align="center">
            ⏳ {t('player.headsUp', { minutes: minutesLeft })}
          </Text>
        </View>
      ) : null}

      {content.body.kind === 'branching' ? (
        <StoryPlayer
          body={content.body}
          locale={locale}
          familyMode={familyMode}
          narration={child.settings.narrationEnabled}
          onFinish={(path) => void finish(path)}
        />
      ) : content.body.kind === 'quiz' ? (
        <QuizPlayer body={content.body} locale={locale} narration={child.settings.narrationEnabled} onFinish={(path, answers) => void finish(path, answers)} />
      ) : (
        <SongPlayer body={content.body} locale={locale} volume={child.settings.soundEffectsVolume} onFinish={() => void finish([])} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  headsUp: { backgroundColor: colors.starYellow, borderRadius: radii.md, padding: spacing.sm },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, flex: 1 },
});
