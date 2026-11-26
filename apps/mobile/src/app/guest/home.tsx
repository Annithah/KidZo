import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { localize } from '@kidzo/shared';
import { Art } from '../../components/art/Art';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/Kid';
import { Header, Screen } from '../../components/Layout';
import { StoryPlayer } from '../../components/players/StoryPlayer';
import { EmptyView, ErrorView, LoadingView } from '../../components/States';
import { Text } from '../../components/Typography';
import { Zo } from '../../components/Zo';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { dailyRoutineAdventure } from '../../lib/daily-routine-adventure';
import { dailyRoutineVideos } from '../../lib/daily-routine-videos';
import { useGuest } from '../../lib/guest';
import { firstGuestStory } from '../../lib/guest-home';
import { radius, shadow, spacing, useTheme } from '../../theme/core';

const LESSON_ART = ['object.sun', 'object.book', 'object.friends', 'object.flower'];

export default function GuestHomeScreen() {
  const { t, locale } = useT();
  const theme = useTheme();
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
      <Screen world>
        <Header title="My Day, My Way" onBack={closeSample} backLabel={t('common.back')} />
        {sampleFinished ? (
          <View style={styles.finished}>
            <Zo size={120} mood="celebrating" />
            <Text variant="display" align="center">Great day!</Text>
            <Text muted align="center">
              You explored routines, picture schedules, communication, and screen balance.
            </Text>
            <Button label={t('common.done')} icon="star" size="kid" fullWidth variant="star" onPress={closeSample} />
          </View>
        ) : (
          <StoryPlayer
            body={dailyRoutineAdventure}
            locale={locale}
            familyMode={false}
            narration={false}
            childAge={age}
            sceneVideos={dailyRoutineVideos}
            advanceAfterSceneVideo
            onFinish={() => setSampleFinished(true)}
          />
        )}
      </Screen>
    );
  }

  const playFeatured = () => {
    if (featuredStory) router.push({ pathname: '/guest/play/[id]', params: { id: featuredStory.id } });
  };

  return (
    <Screen world>
      <Header title={t('guest.homeTitle')} onBack={() => {
        setAge(null);
        router.replace('/guest/age');
      }} backLabel={t('common.back')} />
      <View style={styles.intro}>
        <Zo size={88} mood="happy" />
        <Text variant="h1" align="center">{t('guest.greeting')}</Text>
        <Text muted align="center">{t('guest.ageLabel', { age })}</Text>
      </View>
      {age >= 5 && age <= 10 ? (
        <View style={[styles.localAdventure, { backgroundColor: theme.surface }, shadow(1, undefined, theme)]}>
          <View style={[styles.lessonArt, { backgroundColor: theme.background }]} accessibilityElementsHidden>
            {LESSON_ART.map((art) => (
              <Art key={art} art={art} size={56} />
            ))}
          </View>
          <Text variant="h2">My Day, My Way</Text>
          <Text muted>
            Watch four short video clips and make choices about routines, schedules, communication, and screen balance.
          </Text>
          <Text variant="caption" muted>
            Clips: Power of Routine, Visual Schedules, Foundations to Communication, How Technology Effects Development in Children (Kim Hughes)
          </Text>
          <Button label={t('detail.play')} iconRight="forward" size="kid" fullWidth onPress={() => setPlayingSample(true)} />
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
              <ContentCard item={featuredStory} locale={locale} wide onPress={playFeatured} />
              <Text variant="caption" muted style={styles.description}>
                {localize(featuredStory.summary, locale)}
              </Text>
              <Button label={t('detail.play')} iconRight="forward" size="kid" fullWidth onPress={playFeatured} />
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
      <Text variant="caption" muted align="center">
        {t('guest.aggregateNotice')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', gap: spacing.xs },
  localAdventure: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg },
  lessonArt: { minHeight: 116, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderRadius: radius.md },
  finished: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  featured: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  item: { width: '47%', flexGrow: 1, gap: spacing.xs },
  description: { paddingHorizontal: spacing.xs },
});
