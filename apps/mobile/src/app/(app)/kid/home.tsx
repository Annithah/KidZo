import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MIN_CATEGORY_ITEMS, localize, type Child, type ContentSummary, type Locale } from '@kidzo/shared';
import { CATEGORIES, categoryFor, type CategoryKey } from '@kidzo/ui-tokens';
import { Art } from '../../../components/art/Art';
import { Button } from '../../../components/Button';
import { ProgressBar } from '../../../components/Controls';
import { Icon } from '../../../components/icon/Icon';
import { Avatar, ContentCard, StarCounter } from '../../../components/Kid';
import { Card, Chip, Row, Screen, SectionTitle } from '../../../components/Layout';
import { EmptyView, ErrorView, LoadingView, OfflineBanner } from '../../../components/States';
import { TabBar } from '../../../components/TabBar';
import { Text } from '../../../components/Typography';
import { Zo } from '../../../components/Zo';
import { useT } from '../../../i18n';
import { useDownloads } from '../../../lib/downloads';
import { useFamily } from '../../../lib/family';
import { useBedtime, useCatalog, useContinueWatching, useRecommendations, useToday } from '../../../lib/queries';
import { SLEEP_TIMER_MINUTES, cancelSleepTimer, minutesLeft, startSleepTimer, useSleepTimer } from '../../../lib/sleep-timer';
import { ageBand, palette, radius, shadow, spacing, touchTargets, useTheme, type AgeBand, type ColorName } from '../../../theme/core';

export default function KidHome() {
  const { activeChild } = useFamily();
  const bedtime = useBedtime(activeChild);
  if (!activeChild) return null;
  return bedtime ? <CalmHome child={activeChild} /> : <DayHome child={activeChild} />;
}

function openContent(item: ContentSummary) {
  router.push({ pathname: '/kid/content/[id]', params: { id: item.id } });
}

const worldOf = (w: string): ColorName => (w === 'lavender' ? 'grape' : (w as ColorName));

/** Illustrated category tile; huge for the littlest players. */
function CategoryTile({ category, selected, band, onPress }: { category: (typeof CATEGORIES)[number]; selected: boolean; band: AgeBand; onPress: () => void }) {
  const { t } = useT();
  const theme = useTheme();
  const w = worldOf(category.world);
  const size = band === 'little' ? 96 : 64;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(`category.${category.key}` as 'category.learning')}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.catTile,
        { width: band === 'little' ? 150 : 108, minHeight: band === 'little' ? 150 : touchTargets.little + 56, backgroundColor: selected ? palette[w][100] : theme.surface, borderColor: selected ? palette[w][500] : 'transparent', transform: [{ scale: pressed ? 0.95 : 1 }] },
        shadow(1, palette[w][700], theme),
      ]}
    >
      <Art art={category.art} size={size} />
      <Text variant={band === 'little' ? 'h3' : 'caption'} align="center" numberOfLines={2}>
        {t(`category.${category.key}` as 'category.learning')}
      </Text>
    </Pressable>
  );
}

function DayHome({ child }: { child: Child }) {
  const { t } = useT();
  const locale = child.locale as Locale;
  const band = ageBand(child.age);
  const catalog = useCatalog(child.id);
  const recommendations = useRecommendations(child.id);
  const continuing = useContinueWatching(child.id);
  const today = useToday(child);
  const downloads = useDownloads();
  const [category, setCategory] = useState<CategoryKey | null>(null);

  const items = useMemo(() => catalog.data ?? [], [catalog.data]);
  const featured = items.find((c) => c.featured && !c.calm) ?? items.find((c) => c.type === 'adventure');
  const byCategory = useMemo(() => {
    const map = new Map<CategoryKey, ContentSummary[]>();
    for (const item of items) {
      const key = categoryFor(item).key;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [items]);
  // A category appears only once it has enough items for this child's age group.
  const categories = CATEGORIES.filter((c) => (byCategory.get(c.key)?.length ?? 0) >= MIN_CATEGORY_ITEMS);
  // Only show picks that are still in this child's catalog (a parent may have changed settings).
  const picks = useMemo(() => {
    const ids = new Set(items.map((i) => i.id));
    return (recommendations.data ?? []).filter((r) => ids.has(r.item.id) && r.item.id !== featured?.id).slice(0, 6);
  }, [recommendations.data, items, featured?.id]);
  const visible = category ? (byCategory.get(category) ?? []) : items;
  const remainingMin = today.data?.remainingSeconds != null ? Math.ceil(today.data.remainingSeconds / 60) : null;
  const downloaded = (id: string) => !!downloads.data?.[id];

  return (
    <Screen world overlay={<TabBar />}>
      <Row>
        <Pressable accessibilityRole="button" accessibilityLabel={t('profiles.title')} onPress={() => router.replace('/')}>
          <Avatar avatar={child.avatar} size={60} ring />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="h2">{t('home.hello', { name: child.name })}</Text>
          {remainingMin !== null ? (
            <Row gap={4}>
              <Icon name="timer" size={16} />
              <Text variant="caption" muted>
                {t('home.timeLeft', { minutes: remainingMin })}
              </Text>
            </Row>
          ) : null}
        </View>
        <StarCounter stars={child.stars} />
      </Row>
      <OfflineBanner />

      {catalog.isLoading ? (
        <LoadingView />
      ) : catalog.error && items.length === 0 ? (
        <ErrorView error={catalog.error} onRetry={() => void catalog.refetch()} />
      ) : items.length === 0 ? (
        <EmptyView message={t('home.empty')} />
      ) : (
        <>
          {featured && !category ? (
            <Card world="grape" layered color={palette.grape[500]} onPress={() => openContent(featured)} accessibilityLabel={localize(featured.title, locale)}>
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Chip label={t('home.featured')} icon="sparkle" world="star" solid />
                  <Text variant={band === 'little' ? 'h1' : 'h2'} color={palette.paper[500]}>
                    {localize(featured.title, locale)}
                  </Text>
                  <Row gap={6} style={{ flexWrap: 'wrap' }}>
                    <Chip label={t('common.minutes', { count: featured.durationMinutes })} icon="timer" world="grape" />
                    {band !== 'little'
                      ? featured.skills.slice(0, 2).map((s) => <Chip key={s} label={t(`skill.${s}`)} world="grape" />)
                      : null}
                  </Row>
                </View>
                <Art art={featured.coverArt} size={band === 'little' ? 120 : 100} />
              </Row>
              <View style={{ marginTop: spacing.md }}>
                <Button label={t('detail.play')} icon="play" variant="star" size={band === 'little' ? 'kid' : 'md'} onPress={() => openContent(featured)} />
              </View>
            </Card>
          ) : null}

          {(continuing.data?.length ?? 0) > 0 && !category ? (
            <View style={{ gap: spacing.sm }}>
              <SectionTitle title={t('home.continue')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.sm }}>
                {(continuing.data ?? []).map((item) => (
                  <ContentCard key={item.id} item={item} locale={locale} downloaded={downloaded(item.id)} onPress={() => openContent(item)} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {picks.length > 0 && !category ? (
            <View style={{ gap: spacing.sm }}>
              <SectionTitle title={t('home.forYou')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.sm }}>
                {picks.map(({ item, becauseSkill }) => (
                  <View key={item.id} style={styles.pick}>
                    <ContentCard item={item} locale={locale} downloaded={downloaded(item.id)} onPress={() => openContent(item)} />
                    <Text variant="caption" muted numberOfLines={2}>
                      {becauseSkill ? t('home.becauseYouLike', { skill: t(`skill.${becauseSkill}`) }) : t('home.newForYou')}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <SectionTitle title={t('home.find')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cats}>
            {categories.map((c) => (
              <CategoryTile key={c.key} category={c} band={band} selected={category === c.key} onPress={() => setCategory(category === c.key ? null : c.key)} />
            ))}
          </ScrollView>

          {band === 'middle' && !category ? (
            categories.map((c) => (
              <View key={c.key} style={{ gap: spacing.sm }}>
                <Row>
                  <Art art={c.art} size={36} />
                  <Text variant="h3" style={{ flex: 1 }}>
                    {t(`category.${c.key}` as 'category.learning')}
                  </Text>
                </Row>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.sm }}>
                  {(byCategory.get(c.key) ?? []).map((item) => (
                    <ContentCard key={item.id} item={item} locale={locale} downloaded={downloaded(item.id)} onPress={() => openContent(item)} />
                  ))}
                </ScrollView>
              </View>
            ))
          ) : (
            <View style={styles.grid}>
              {visible.map((item) => (
                <View key={item.id} style={band === 'little' ? styles.gridBig : band === 'big' ? styles.gridDense : styles.gridItem}>
                  <ContentCard item={item} locale={locale} wide big={band === 'little'} downloaded={downloaded(item.id)} onPress={() => openContent(item)} />
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

/** Bedtime: night theme, moon and stars, narrated calm stories only, games tucked away. */
function CalmHome({ child }: { child: Child }) {
  const { t } = useT();
  const theme = useTheme();
  const locale = child.locale as Locale;
  const catalog = useCatalog(child.id);
  const today = useToday(child);
  const calm = (catalog.data ?? []).filter((c) => c.calm);
  const tonight = calm.find((c) => c.featured) ?? calm[0];
  const others = calm.filter((c) => c.id !== tonight?.id);
  const usedMin = Math.round((today.data?.secondsPlayed ?? 0) / 60);
  const limit = today.data?.dailyLimitMinutes ?? null;
  const sleepEndsAt = useSleepTimer();
  const now = useTimerClock(sleepEndsAt);
  const sleepLeft = sleepEndsAt === null ? null : minutesLeft(sleepEndsAt, now);

  if (sleepLeft === 0) {
    return (
      <Screen world>
        <View style={styles.calmHero}>
          <Zo size={140} mood="sleepy" />
          <Text variant="h1" align="center">
            {t('sleep.goodnight')}
          </Text>
        </View>
        <Button label={t('sleep.off')} icon="close" variant="moon" onPress={cancelSleepTimer} />
      </Screen>
    );
  }

  return (
    <Screen world overlay={<TabBar />}>
      <Row>
        <Pressable accessibilityRole="button" accessibilityLabel={t('profiles.title')} onPress={() => router.replace('/')}>
          <Avatar avatar={child.avatar} size={52} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Chip label={t('calm.kicker')} icon="bedtime" world="grape" />
      </Row>
      <OfflineBanner />
      <View style={styles.calmHero}>
        <Zo size={120} mood="sleepy" />
        <Text variant="h1" align="center">
          {t('calm.greeting', { name: child.name })}
        </Text>
        <Text muted align="center">
          {t('calm.subtitle')}
        </Text>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Row gap={6}>
          <Icon name="timer" size={18} color={theme.textMuted} />
          <Text variant="bodyBold">{sleepLeft !== null ? t('sleep.left', { minutes: sleepLeft }) : t('sleep.title')}</Text>
        </Row>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {SLEEP_TIMER_MINUTES.map((m) => (
            <Pressable key={m} accessibilityRole="button" accessibilityLabel={`${t('sleep.title')} ${t('sleep.minutes', { minutes: m })}`} onPress={() => startSleepTimer(m)}>
              <Chip label={t('sleep.minutes', { minutes: m })} icon="timer" world="grape" />
            </Pressable>
          ))}
          {sleepEndsAt !== null ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`${t('sleep.title')} ${t('sleep.off')}`} onPress={cancelSleepTimer}>
              <Chip label={t('sleep.off')} icon="close" world="grape" />
            </Pressable>
          ) : null}
        </Row>
      </View>

      {catalog.isLoading ? (
        <LoadingView />
      ) : catalog.error && calm.length === 0 ? (
        <ErrorView error={catalog.error} onRetry={() => void catalog.refetch()} />
      ) : tonight ? (
        <Card onPress={() => openContent(tonight)} accessibilityLabel={localize(tonight.title, locale)}>
          <Text variant="kicker" color={theme.accentText}>
            {t('calm.tonight')}
          </Text>
          <Row style={{ marginTop: spacing.xs }}>
            <View style={[styles.calmCover, { backgroundColor: theme.surfaceRaised }]}>
              <Art art={tonight.coverArt} size={64} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="h3">{localize(tonight.title, locale)}</Text>
              <Text variant="caption" muted>
                {t('common.minutes', { count: tonight.durationMinutes })} · {t('calm.narrated')}
              </Text>
            </View>
          </Row>
          <View style={{ marginTop: spacing.md }}>
            <Button label={t('detail.play')} icon="play" variant="moon" onPress={() => openContent(tonight)} />
          </View>
        </Card>
      ) : (
        <EmptyView message={t('home.empty')} art="scene.bedtime" />
      )}

      {others.length > 0 ? (
        <>
          <SectionTitle title={t('calm.more')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {others.map((item) => (
              <ContentCard key={item.id} item={item} locale={locale} onPress={() => openContent(item)} />
            ))}
          </ScrollView>
        </>
      ) : null}

      <View style={[styles.calmNote, { borderColor: theme.line }]}>
        <Row style={{ justifyContent: 'center' }}>
          <Icon name="bedtime" size={20} color={theme.textMuted} />
          <Text variant="bodyBold" align="center" muted>
            {t('calm.gamesAway')}
          </Text>
        </Row>
        {limit !== null ? (
          <View style={{ gap: 6 }}>
            <Text variant="caption" align="center" muted>
              {t('calm.usage', { used: usedMin, limit })}
            </Text>
            <ProgressBar value={usedMin / limit} color={palette.moon[500]} track={theme.line} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

/** The current time, refreshed when the timer changes and every 15 seconds while it runs. */
function useTimerClock(endsAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt === null) return;
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [endsAt]);
  return now;
}

const styles = StyleSheet.create({
  pick: { width: 168, gap: spacing.xxs },
  cats: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.lg },
  catTile: { borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridItem: { width: '47%', flexGrow: 1 },
  gridBig: { width: '100%' },
  gridDense: { width: '30%', flexGrow: 1, minWidth: 140 },
  calmHero: { alignItems: 'center', gap: spacing.xs, marginVertical: spacing.sm },
  calmCover: { width: 80, height: 80, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  calmNote: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 2 },
});
