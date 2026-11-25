import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { localize } from '@kidzo/shared';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/Kid';
import { Header, Screen } from '../../components/Layout';
import { StoryPlayer } from '../../components/players/StoryPlayer';
import { EmptyView, ErrorView, LoadingView } from '../../components/States';
import { Text } from '../../components/Typography';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { useGuest } from '../../lib/guest';
import { dailyRoutineAdventure } from '../../lib/daily-routine-adventure';
import { dailyRoutineVideos } from '../../lib/daily-routine-videos';
import { firstGuestStory } from '../../lib/guest-home';
import { colors, spacing } from '../../theme';

export default function GuestHomeScreen() {
  const { t, locale } = useT();
  const [playingSample, setPlayingSample] = useState(false);
  const [sampleFinished, setSampleFinished] = useState(false);
  const { age, setAge } = useGuest();
  const catalog = useQuery({
    queryKey: ['guest', 'catalog', age],
    queryFn: () => {
      if (age === null) throw new Error('Guest age is required');
      return api.guestCatalog(age);
    },
    enabled: age !== null,
  });

  useEffect(() => {
    if (age === null) router.replace('/guest/age');
  }, [age]);

  const items = catalog.data ?? [];
  const featuredStory = firstGuestStory(items);

  if (age === null) return <Screen scroll={false}><LoadingView /></Screen>;
  if (playingSample) {
    const closeSample = () => {
      setPlayingSample(false);
      setSampleFinished(false);
    };
    return (
      <Screen>
        <Header title="My Day, My Way" onBack={closeSample} backLabel={t('common.back')} />
        {sampleFinished ? (
          <View style={styles.finished}>
            <Text variant="display" align="center">🌟 Great day!</Text>
            <Text muted align="center">
              You explored routines, picture schedules, communication, and screen balance.
            </Text>
            <Button label={t('common.done')} size="kid" fullWidth onPress={closeSample} />
          </View>
        ) : (
          <StoryPlayer
            body={dailyRoutineAdventure}
            locale={locale}
            familyMode={false}
            narration={false}
            sceneVideos={dailyRoutineVideos}
            advanceAfterSceneVideo
            onFinish={() => setSampleFinished(true)}
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t('guest.homeTitle')} onBack={() => {
        setAge(null);
        router.replace('/guest/age');
      }} backLabel={t('common.back')} />
      <View style={styles.intro}>
        <Text variant="h1" align="center">{t('guest.greeting')}</Text>
        <Text muted align="center">{t('guest.ageLabel', { age })}</Text>
      </View>
      {age >= 5 && age <= 10 ? (
        <View style={styles.localAdventure}>
          <View style={styles.lessonArt} accessibilityElementsHidden>
            <Text style={styles.lessonEmoji}>🌅</Text>
            <Text style={styles.lessonEmoji}>📅</Text>
            <Text style={styles.lessonEmoji}>💬</Text>
            <Text style={styles.lessonEmoji}>🌿</Text>
          </View>
          <Text variant="h2">My Day, My Way</Text>
          <Text muted>
            Watch four short video clips and make choices about routines, schedules, communication, and screen balance.
          </Text>
          <Text variant="caption" muted>
            Clips: Power of Routine · Visual Schedules · Foundations to Communication · How Technology Effects Development in Children (Kim Hughes)
          </Text>
          <Button
            label={t('detail.play')}
            size="kid"
            fullWidth
            onPress={() => setPlayingSample(true)}
          />
        </View>
      ) : null}
      {catalog.isLoading ? (
        <LoadingView />
      ) : catalog.error && items.length === 0 ? (
        <ErrorView error={catalog.error} onRetry={() => void catalog.refetch()} />
      ) : items.length === 0 ? (
        <EmptyView message={t('guest.empty')} />
      ) : (
        <>
          <Text variant="h2">{t('guest.catalogTitle')}</Text>
          {featuredStory ? (
            <View style={styles.featured}>
              <ContentCard
                item={featuredStory}
                locale={locale}
                wide
                onPress={() => router.push({ pathname: '/guest/play/[id]', params: { id: featuredStory.id } })}
              />
              <Text variant="caption" muted>
                {localize(featuredStory.summary, locale)}
              </Text>
              <Button
                label={t('detail.play')}
                size="kid"
                fullWidth
                onPress={() => router.push({ pathname: '/guest/play/[id]', params: { id: featuredStory.id } })}
              />
            </View>
          ) : null}
          <View style={styles.grid}>
            {items.filter((item) => item.id !== featuredStory?.id).map((item) => (
              <View key={item.id} style={styles.item}>
                <ContentCard
                  item={item}
                  locale={locale}
                  wide
                  onPress={() => router.push({ pathname: '/guest/play/[id]', params: { id: item.id } })}
                />
                <Text variant="caption" muted style={styles.description}>
                  {localize(item.summary, locale)}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
      <Text variant="caption" color={colors.inkSubtle} align="center">
        {t('guest.aggregateNotice')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', gap: spacing.xs },
  localAdventure: { gap: spacing.sm, padding: spacing.md, backgroundColor: colors.white, borderRadius: 24 },
  lessonArt: { minHeight: 116, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: colors.cream, borderRadius: 18 },
  lessonEmoji: { fontSize: 38 },
  finished: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.mint },
  featured: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  item: { width: '47%', flexGrow: 1, gap: spacing.xs },
  description: { paddingHorizontal: spacing.xs },
});
