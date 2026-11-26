import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { localize, type ContentDetail, type GuestPlaybackInput, type Locale } from '@kidzo/shared';
import { Button } from '../../../components/Button';
import { Row, Screen } from '../../../components/Layout';
import { QuizPlayer } from '../../../components/players/QuizPlayer';
import { SongPlayer } from '../../../components/players/SongPlayer';
import { VideoPlayer } from '../../../components/players/VideoPlayer';
import { StoryPlayer } from '../../../components/players/StoryPlayer';
import { ErrorView, InlineMessage, LoadingView } from '../../../components/States';
import { Text } from '../../../components/Typography';
import { useT } from '../../../i18n';
import { api } from '../../../lib/api';
import { useGuest } from '../../../lib/guest';
import { stopSpeaking } from '../../../lib/narration';
import { radius, spacing, useTheme } from '../../../theme/core';
import { IconButton } from '../../../components/IconButton';

export default function GuestPlayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { age } = useGuest();
  const detail = useQuery({
    queryKey: ['guest', 'content', id, age],
    queryFn: () => {
      if (age === null) throw new Error('Guest age is required');
      return api.guestContent(id, age);
    },
    enabled: age !== null && !!id,
  });
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (age === null) router.replace('/guest/age');
  }, [age]);
  useEffect(() => {
    if (detail.data && startedAt.current === null) startedAt.current = Date.now();
  }, [detail.data]);

  if (age === null) return <Screen scroll={false}><LoadingView /></Screen>;
  if (detail.isLoading) return <Screen scroll={false}><LoadingView /></Screen>;
  if (!detail.data) {
    return <Screen scroll={false}><ErrorView error={detail.error} onRetry={() => void detail.refetch()} /></Screen>;
  }
  return <GuestPlayer content={detail.data} startedAt={startedAt} age={age} />;
}

function GuestPlayer({
  content,
  startedAt,
  age,
}: {
  content: ContentDetail;
  startedAt: MutableRefObject<number | null>;
  age: number;
}) {
  const { t, locale } = useT();
  const [saving, setSaving] = useState(false);
  const [reportError, setReportError] = useState<unknown>(null);
  const [pending, setPending] = useState<GuestPlaybackInput | null>(null);
  const activeRequest = useRef(false);
  const contentLocale = locale as Locale;
  const theme = useTheme();

  const report = async (input: GuestPlaybackInput) => {
    if (activeRequest.current) return;
    activeRequest.current = true;
    setSaving(true);
    setReportError(null);
    try {
      await api.guestPlayback(input);
      setPending(null);
      router.replace('/guest/home');
    } catch (error) {
      setPending(input);
      setReportError(error);
    } finally {
      activeRequest.current = false;
      setSaving(false);
    }
  };

  const finish = (path: string[], answers?: Record<string, string>) => {
    const secondsPlayed = Math.min(2 * 60 * 60, Math.max(0, Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000)));
    void report({
      contentId: content.id,
      secondsPlayed,
      completed: true,
      path,
      ...(answers ? { answers } : {}),
    });
  };

  const exit = () => {
    stopSpeaking();
    const secondsPlayed = Math.min(2 * 60 * 60, Math.max(0, Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000)));
    void report({ contentId: content.id, secondsPlayed, completed: false, path: [] });
  };

  return (
    <Screen world scroll={content.body.kind !== 'song'}>
      <Row>
        <IconButton icon="close" label={t('player.exit')} onPress={exit} />
        <Text variant="bodyBold" numberOfLines={1} style={{ flex: 1 }} align="center">
          {localize(content.title, contentLocale)}
        </Text>
        <View style={styles.close} />
      </Row>
      {reportError ? (
        <View style={[styles.reportError, { backgroundColor: theme.surface }]}>
          <InlineMessage tone="error" message={t('guest.reportFailed')} />
          <Button label={t('common.retry')} icon="sync" loading={saving} onPress={() => pending && void report(pending)} />
          <Button label={t('guest.leaveWithoutReporting')} variant="secondary" onPress={() => router.replace('/guest/home')} />
        </View>
      ) : null}
      {content.body.kind === 'branching' ? (
        <StoryPlayer body={content.body} locale={contentLocale} familyMode={false} narration childAge={age} onFinish={(path, answers) => finish(path, answers)} />
      ) : content.body.kind === 'quiz' ? (
        <QuizPlayer body={content.body} locale={contentLocale} narration onFinish={(path, answers) => finish(path, answers)} />
      ) : content.body.kind === 'video' ? (
        <VideoPlayer body={content.body} locale={contentLocale} narration fallbackArt={content.coverArt} onFinish={(path, answers) => finish(path, answers)} />
      ) : (
        <SongPlayer body={content.body} locale={contentLocale} volume={0.6} onFinish={() => finish([])} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  reportError: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg },
});
