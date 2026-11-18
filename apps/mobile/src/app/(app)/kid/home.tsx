import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { localize, type Child, type ContentSummary, type ContentType, type Locale } from '@kidzo/shared';
import { Button } from '../../../components/Button';
import { ProgressBar, Segmented } from '../../../components/Controls';
import { Avatar, ContentCard, StarCounter, avatarColor } from '../../../components/Kid';
import { Card, Chip, Row, Screen, SectionTitle } from '../../../components/Layout';
import { EmptyView, ErrorView, LoadingView, OfflineBanner } from '../../../components/States';
import { Text } from '../../../components/Typography';
import { Zo } from '../../../components/Zo';
import { useT } from '../../../i18n';
import { useDownloads } from '../../../lib/downloads';
import { useFamily } from '../../../lib/family';
import { useBedtime, useCatalog, useToday } from '../../../lib/queries';
import { bedtimeColors, colors, radii, spacing, usePalette } from '../../../theme';

type Filter = 'all' | ContentType;

export default function KidHome() {
  const { activeChild, children } = useFamily();
  const bedtime = useBedtime(activeChild);
  if (!activeChild) return null;
  const index = Math.max(0, children.findIndex((c) => c.id === activeChild.id));
  return bedtime ? <CalmHome child={activeChild} /> : <DayHome child={activeChild} colorIndex={index} />;
}

function openContent(item: ContentSummary) {
  router.push({ pathname: '/kid/content/[id]', params: { id: item.id } });
}

function DayHome({ child, colorIndex }: { child: Child; colorIndex: number }) {
  const { t } = useT();
  const locale = child.locale as Locale;
  const catalog = useCatalog(child.id);
  const today = useToday(child);
  const downloads = useDownloads();
  const [filter, setFilter] = useState<Filter>('all');

  const items = useMemo(() => catalog.data ?? [], [catalog.data]);
  const featured = items.find((c) => c.featured && !c.calm) ?? items.find((c) => c.type === 'adventure');
  const visible = useMemo(() => items.filter((c) => filter === 'all' || c.type === filter), [items, filter]);
  const remainingMin = today.data?.remainingSeconds != null ? Math.ceil(today.data.remainingSeconds / 60) : null;

  return (
    <Screen>
      <Row>
        <Pressable accessibilityRole="button" accessibilityLabel={t('profiles.title')} onPress={() => router.replace('/')}>
          <Avatar avatar={child.avatar} size={56} color={avatarColor(colorIndex)} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="h2">{t('home.hello', { name: child.name })}</Text>
          {remainingMin !== null ? (
            <Text variant="caption" muted>
              ⏳ {t('home.timeLeft', { minutes: remainingMin })}
            </Text>
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
          <Text variant="h1">{t('home.find')}</Text>
          {featured ? (
            <Card color={colors.skyBlue} onPress={() => openContent(featured)} accessibilityLabel={localize(featured.title, locale)}>
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text variant="kicker" color={colors.white}>
                    {t('home.featured')}
                  </Text>
                  <Text variant="h1" color={colors.white}>
                    {localize(featured.title, locale)}
                  </Text>
                  <Row gap={6} style={{ flexWrap: 'wrap' }}>
                    <Chip label={t('common.minutes', { count: featured.durationMinutes })} color="rgba(255,255,255,0.25)" textColor={colors.white} />
                    {featured.skills.slice(0, 2).map((s) => (
                      <Chip key={s} label={t(`skill.${s}`)} color="rgba(255,255,255,0.25)" textColor={colors.white} />
                    ))}
                  </Row>
                </View>
                <Text style={styles.featuredEmoji}>{featured.coverEmoji}</Text>
              </Row>
              <View style={{ marginTop: spacing.md }}>
                <Button label={t('detail.play')} variant="yellow" onPress={() => openContent(featured)} />
              </View>
            </Card>
          ) : null}

          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: '✨' },
              { value: 'adventure', label: t('home.adventures') },
              { value: 'story', label: t('home.stories') },
              { value: 'song', label: t('home.songs') },
              { value: 'game', label: t('home.games') },
            ]}
          />
          <View style={styles.grid}>
            {visible.map((item) => (
              <View key={item.id} style={styles.gridItem}>
                <ContentCard item={item} locale={locale} wide downloaded={!!downloads.data?.[item.id]} onPress={() => openContent(item)} />
              </View>
            ))}
          </View>
        </>
      )}

      <Button label={`🏅 ${t('home.myStickers')}`} variant="lavender" fullWidth onPress={() => router.push('/kid/stickers')} />
    </Screen>
  );
}

/** Calm Mode: soft indigo palette, narrated stories only, games tucked away. */
function CalmHome({ child }: { child: Child }) {
  const { t } = useT();
  const palette = usePalette();
  const locale = child.locale as Locale;
  const catalog = useCatalog(child.id);
  const today = useToday(child);
  const calm = (catalog.data ?? []).filter((c) => c.calm);
  const tonight = calm.find((c) => c.featured) ?? calm[0];
  const others = calm.filter((c) => c.id !== tonight?.id);
  const usedMin = Math.round((today.data?.secondsPlayed ?? 0) / 60);
  const limit = today.data?.dailyLimitMinutes ?? null;

  return (
    <Screen background={palette.background}>
      <Row>
        <Pressable accessibilityRole="button" accessibilityLabel={t('profiles.title')} onPress={() => router.replace('/')}>
          <Avatar avatar={child.avatar} size={48} color={bedtimeColors.mutedLavender} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Chip label={`🌙 ${t('calm.kicker')}`} color={bedtimeColors.indigoRaised} textColor={bedtimeColors.moonYellow} />
      </Row>
      <OfflineBanner />
      <View style={styles.calmHero}>
        <Zo size={110} mood="sleepy" />
        <Text variant="h1" align="center">
          {t('calm.greeting', { name: child.name })}
        </Text>
        <Text muted align="center">
          {t('calm.subtitle')}
        </Text>
      </View>

      {catalog.isLoading ? (
        <LoadingView />
      ) : catalog.error && calm.length === 0 ? (
        <ErrorView error={catalog.error} onRetry={() => void catalog.refetch()} />
      ) : tonight ? (
        <Card color={bedtimeColors.indigoRaised} onPress={() => openContent(tonight)} accessibilityLabel={localize(tonight.title, locale)}>
          <Text variant="kicker" color={bedtimeColors.moonYellow}>
            {t('calm.tonight')}
          </Text>
          <Row style={{ marginTop: spacing.xs }}>
            <View style={[styles.calmCover, { backgroundColor: tonight.coverColor }]}>
              <Text style={{ fontSize: 40, lineHeight: 50 }}>{tonight.coverEmoji}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="h3">{localize(tonight.title, locale)}</Text>
              <Text variant="caption" muted>
                {t('common.minutes', { count: tonight.durationMinutes })} · {t('calm.narrated')}
              </Text>
            </View>
          </Row>
          <View style={{ marginTop: spacing.md }}>
            <Button label={`▶  ${t('detail.play')}`} variant="moon" onPress={() => openContent(tonight)} />
          </View>
        </Card>
      ) : (
        <EmptyView message={t('home.empty')} />
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

      <View style={styles.calmNote}>
        <Text variant="bodyBold" align="center" color={bedtimeColors.textOnIndigoMuted}>
          🧸 {t('calm.gamesAway')}
        </Text>
        {limit !== null ? (
          <View style={{ gap: 6 }}>
            <Text variant="caption" align="center" muted>
              {t('calm.usage', { used: usedMin, limit })}
            </Text>
            <ProgressBar value={usedMin / limit} color={bedtimeColors.moonYellow} track={bedtimeColors.indigoSoft} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  featuredEmoji: { fontSize: 72, lineHeight: 84 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridItem: { width: '47%', flexGrow: 1 },
  calmHero: { alignItems: 'center', gap: spacing.xs, marginVertical: spacing.sm },
  calmCover: { width: 72, height: 72, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  calmNote: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, borderWidth: 2, borderColor: bedtimeColors.indigoSoft },
});
