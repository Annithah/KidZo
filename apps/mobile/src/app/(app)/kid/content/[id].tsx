import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { LOCALE_LABELS, ageRangeLabel, formatBytes, localize, type Locale } from '@kidzo/shared';
import { Button } from '../../../../components/Button';
import { ProgressBar } from '../../../../components/Controls';
import { Card, Chip, Header, Row, Screen } from '../../../../components/Layout';
import { ErrorView, InlineMessage, LoadingView, OfflineBanner } from '../../../../components/States';
import { Text } from '../../../../components/Typography';
import { useT, type TranslationKey } from '../../../../i18n';
import { downloadsSupported, useDownloadAction, useDownloads } from '../../../../lib/downloads';
import { useFamily } from '../../../../lib/family';
import { useBedtime, useContentDetail } from '../../../../lib/queries';
import { colors, radii, spacing, usePalette } from '../../../../theme';

const TYPE_KICKER: Record<string, TranslationKey> = {
  adventure: 'detail.adventure',
  story: 'detail.story',
  song: 'detail.song',
  game: 'detail.game',
};

export default function ContentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const palette = usePalette();
  const { activeChild, familyMode } = useFamily();
  const bedtime = useBedtime(activeChild);
  const detail = useContentDetail(id);
  const downloads = useDownloads();
  const download = useDownloadAction(id ?? '');

  if (!activeChild) return null;
  if (detail.isLoading) return <Screen scroll={false}><Header /><LoadingView /></Screen>;
  if (detail.error || !detail.data) {
    return (
      <Screen scroll={false}>
        <Header />
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

  return (
    <Screen
      footer={
        blockedByBedtime || tooYoung ? (
          <Button label={t('detail.notAvailable')} disabled fullWidth size="kid" />
        ) : (
          <Button
            label={familyMode ? `👨‍👩‍👧 ${t('detail.playTogether')}` : t('detail.play')}
            size="kid"
            variant={palette.isCalm ? 'moon' : 'primary'}
            fullWidth
            onPress={() => router.push({ pathname: '/kid/play/[id]', params: { id: item.id } })}
          />
        )
      }
    >
      <Header backLabel={t('common.back')} />
      <OfflineBanner />
      <View style={[styles.cover, { backgroundColor: item.coverColor }]}>
        <Text style={styles.coverEmoji}>{item.coverEmoji}</Text>
      </View>
      <Text variant="kicker" color={palette.isCalm ? palette.accent : colors.coral}>
        {t(TYPE_KICKER[item.type] ?? 'detail.adventure')}
      </Text>
      <Text variant="display">{localize(item.title, locale)}</Text>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Chip icon="⏱" label={t('common.minutes', { count: item.durationMinutes })} />
        <Chip icon="🧒" label={ageRangeLabel(item.ageMin, item.ageMax)} />
        <Chip icon="⭐" label={t('common.stars', { count: item.rewardStars })} color="#FFF3C4" />
        <Chip label={`${LOCALE_LABELS[item.languages.includes(locale) ? locale : 'en'].short}${others > 0 ? ` +${others}` : ''}`} color={colors.coralTint} />
      </Row>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {item.skills.map((s) => (
          <Chip key={s} label={t(`skill.${s}`)} color="#E3F9EF" />
        ))}
      </Row>
      <Text>{localize(item.summary, locale)}</Text>
      {item.type === 'adventure' ? (
        <Text variant="bodyBold" color={palette.isCalm ? palette.accent : colors.lavender}>
          ✨ {t('detail.choicesShape')}
        </Text>
      ) : null}

      {blockedByBedtime ? <InlineMessage message={t('blocked.bedtimeBody')} /> : null}
      {tooYoung ? <InlineMessage message={t('blocked.ageBody')} /> : null}

      {downloadsSupported ? (
        <Card>
          <Row>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyBold">{entry ? `✅ ${t('detail.downloaded')}` : `📥 ${t('detail.availableOffline')}`}</Text>
              <Text variant="caption" muted>
                {formatBytes(entry?.sizeBytes ?? item.sizeBytes)}
                {outdated ? ` · ${t('downloads.updateAvailable')}` : ''}
              </Text>
            </View>
            {download.progress !== null ? null : entry && !outdated ? (
              <Button label={t('detail.removeDownload')} size="sm" variant="secondary" onPress={() => void download.remove()} />
            ) : (
              <Button label={t('detail.download')} size="sm" variant="sky" onPress={() => void download.start()} />
            )}
          </Row>
          {download.progress !== null ? (
            <View style={styles.progress}>
              <Text variant="caption" muted>
                {t('detail.downloading')} {Math.round(download.progress * 100)}%
              </Text>
              <ProgressBar value={download.progress} color={colors.skyBlue} />
            </View>
          ) : null}
          {download.error ? <InlineMessage tone="error" message={t('downloads.failed')} /> : null}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { height: 220, borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center' },
  coverEmoji: { fontSize: 110, lineHeight: 130 },
  progress: { gap: 6, marginTop: spacing.sm },
});
