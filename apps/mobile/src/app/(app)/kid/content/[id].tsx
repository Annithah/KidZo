import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { LOCALE_LABELS, ageRangeLabel, formatBytes, localize, type Locale } from '@kidzo/shared';
import { categoryFor } from '@kidzo/ui-tokens';
import { Art } from '../../../../components/art/Art';
import { Button } from '../../../../components/Button';
import { ProgressBar } from '../../../../components/Controls';
import { Icon } from '../../../../components/icon/Icon';
import { contentWorld } from '../../../../components/Kid';
import { Card, Chip, Header, Row, Screen } from '../../../../components/Layout';
import { ErrorView, InlineMessage, LoadingView, OfflineBanner } from '../../../../components/States';
import { Text } from '../../../../components/Typography';
import { useT, type TranslationKey } from '../../../../i18n';
import { downloadsSupported, useDownloadAction, useDownloads } from '../../../../lib/downloads';
import { useFamily } from '../../../../lib/family';
import { useBedtime, useContentDetail } from '../../../../lib/queries';
import { palette, radius, shadow, spacing, useTheme } from '../../../../theme/core';

const TYPE_KICKER: Record<string, TranslationKey> = {
  adventure: 'detail.adventure',
  story: 'detail.story',
  song: 'detail.song',
  game: 'detail.game',
};

export default function ContentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const theme = useTheme();
  const { activeChild, familyMode } = useFamily();
  const bedtime = useBedtime(activeChild);
  const detail = useContentDetail(id, activeChild);
  const downloads = useDownloads();
  const download = useDownloadAction(id ?? '');

  if (!activeChild) return null;
  if (detail.isLoading) return <Screen scroll={false}><Header backLabel={t('common.back')} /><LoadingView /></Screen>;
  if (detail.error || !detail.data) {
    return (
      <Screen scroll={false}>
        <Header backLabel={t('common.back')} />
        <ErrorView error={detail.error} onRetry={() => void detail.refetch()} />
      </Screen>
    );
  }

  const item = detail.data;
  const locale = activeChild.locale as Locale;
  const entry = downloads.data?.[item.id];
  const outdated = entry && entry.version < item.version && !item.fromDownload;
  const blockedByBedtime = bedtime && !item.calm;
  const tooYoung = activeChild.age < item.ageMin;
  const others = item.languages.filter((l) => l !== locale).length;
  const world = contentWorld(item);
  const category = categoryFor(item);

  return (
    <Screen
      world
      footer={
        blockedByBedtime || tooYoung ? (
          <Button label={t('detail.notAvailable')} icon="lock" disabled fullWidth size="kid" />
        ) : (
          <Button
            label={familyMode ? t('detail.playTogether') : t('detail.play')}
            icon={familyMode ? 'familyMode' : 'play'}
            size="kid"
            variant={theme.isCalm ? 'moon' : 'primary'}
            fullWidth
            onPress={() => router.push({ pathname: '/kid/play/[id]', params: { id: item.id } })}
          />
        )
      }
    >
      <Header backLabel={t('common.back')} />
      <OfflineBanner />
      <View style={[styles.cover, { backgroundColor: theme.isCalm ? theme.surface : palette[world][100] }, shadow(2, palette[world][700], theme)]}>
        <Art art={item.coverArt} size={190} label={localize(item.title, locale)} />
        <View style={styles.categoryBadge}>
          <Art art={category.art} size={56} />
        </View>
      </View>
      <Text variant="kicker" color={theme.accentText}>
        {t(TYPE_KICKER[item.type] ?? 'detail.adventure')}
      </Text>
      <Text variant="display">{localize(item.title, locale)}</Text>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Chip icon="timer" label={t('common.minutes', { count: item.durationMinutes })} world="sky" />
        <Chip icon="age" label={ageRangeLabel(item.ageMin, item.ageMax)} world="bubblegum" />
        <Chip icon="star" label={t('common.stars', { count: item.rewardStars })} world="star" />
        <Chip icon="language" label={`${LOCALE_LABELS[item.languages.includes(locale) ? locale : 'en'].short}${others > 0 ? ` +${others}` : ''}`} world="coral" />
      </Row>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {item.skills.map((s) => (
          <Chip key={s} label={t(`skill.${s}`)} world="mint" />
        ))}
      </Row>
      <Text>{localize(item.summary, locale)}</Text>
      {item.type === 'adventure' ? (
        <Row gap={6}>
          <Icon name="choices" size={22} color={theme.accentText} />
          <Text variant="bodyBold" color={theme.accentText} style={{ flex: 1 }}>
            {t('detail.choicesShape')}
          </Text>
        </Row>
      ) : null}

      {blockedByBedtime ? <InlineMessage message={t('blocked.bedtimeBody')} icon="bedtime" /> : null}
      {tooYoung ? <InlineMessage message={t('blocked.ageBody')} icon="age" /> : null}

      {downloadsSupported ? (
        <Card>
          <Row>
            <Icon name={entry ? 'checkCircle' : 'downloads'} size={28} color={entry ? theme.successText : theme.text} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyBold">{entry ? t('detail.downloaded') : t('detail.availableOffline')}</Text>
              <Text variant="caption" muted>
                {formatBytes(entry?.sizeBytes ?? item.sizeBytes)}
                {outdated ? ` · ${t('downloads.updateAvailable')}` : ''}
              </Text>
            </View>
            {download.progress !== null ? null : entry && !outdated ? (
              <Button label={t('detail.removeDownload')} size="sm" variant="secondary" onPress={() => void download.remove()} />
            ) : (
              <Button label={t('detail.download')} icon="downloads" size="sm" variant="sky" onPress={() => void download.start()} />
            )}
          </Row>
          {download.progress !== null ? (
            <View style={styles.progress}>
              <Text variant="caption" muted>
                {t('detail.downloading')} {Math.round(download.progress * 100)}%
              </Text>
              <ProgressBar value={download.progress} color={palette.sky[500]} />
            </View>
          ) : null}
          {download.error ? <InlineMessage tone="error" message={t('downloads.failed')} /> : null}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { height: 240, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  categoryBadge: { position: 'absolute', right: 12, bottom: 12 },
  progress: { gap: 6, marginTop: spacing.sm },
});
