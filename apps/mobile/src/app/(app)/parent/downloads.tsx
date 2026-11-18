import { useQueryClient } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { formatBytes, localize, type ContentSummary } from '@kidzo/shared';
import { Button } from '../../../components/Button';
import { ProgressBar } from '../../../components/Controls';
import { Card, Header, Row, Screen, SectionTitle } from '../../../components/Layout';
import { ErrorView, InlineMessage, LoadingView, OfflineBanner } from '../../../components/States';
import { Text } from '../../../components/Typography';
import { useT } from '../../../i18n';
import { downloadsQueryKey, downloadsSupported, removeAllDownloads, useDownloadAction, useDownloads } from '../../../lib/downloads';
import { useCatalog } from '../../../lib/queries';
import { colors, radii, spacing } from '../../../theme';

export default function Downloads() {
  const { t, locale } = useT();
  const queryClient = useQueryClient();
  const downloads = useDownloads();
  const catalog = useCatalog(undefined);
  const entries = Object.values(downloads.data ?? {});
  const used = entries.reduce((sum, e) => sum + e.sizeBytes, 0);
  const available = (catalog.data ?? []).filter((c) => !downloads.data?.[c.id]);
  const outdated = (catalog.data ?? []).filter((c) => {
    const e = downloads.data?.[c.id];
    return e && e.version < c.version;
  });

  if (!downloadsSupported) {
    return (
      <Screen>
        <Header title={t('downloads.title')} backLabel={t('common.back')} />
        <InlineMessage message={t('downloads.subtitle')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t('downloads.title')} backLabel={t('common.back')} />
      <OfflineBanner />
      <Text muted>{t('downloads.subtitle')}</Text>
      <Card color={colors.skyTint}>
        <Text variant="bodyBold">💾 {t('downloads.storage', { size: formatBytes(used) })}</Text>
      </Card>

      <SectionTitle title={t('downloads.onDevice')} />
      {entries.length === 0 ? (
        <Text muted>{t('downloads.empty')}</Text>
      ) : (
        <>
          {entries.map((e) => {
            const summary = catalog.data?.find((c) => c.id === e.id);
            return (
              <DownloadRow
                key={e.id}
                id={e.id}
                title={summary ? localize(summary.title, locale) : e.title}
                emoji={e.coverEmoji}
                color={e.coverColor}
                size={e.sizeBytes}
                downloaded
                outdated={outdated.some((o) => o.id === e.id)}
              />
            );
          })}
          <Button
            label={t('downloads.removeAll')}
            variant="danger"
            onPress={async () => {
              await removeAllDownloads();
              await queryClient.invalidateQueries({ queryKey: downloadsQueryKey });
            }}
          />
        </>
      )}

      <SectionTitle title={t('downloads.available')} />
      {catalog.isLoading ? (
        <LoadingView />
      ) : catalog.error && available.length === 0 ? (
        <ErrorView error={catalog.error} onRetry={() => void catalog.refetch()} />
      ) : (
        available.map((c: ContentSummary) => (
          <DownloadRow key={c.id} id={c.id} title={localize(c.title, locale)} emoji={c.coverEmoji} color={c.coverColor} size={c.sizeBytes} downloaded={false} />
        ))
      )}
    </Screen>
  );
}

function DownloadRow(props: { id: string; title: string; emoji: string; color: string; size: number; downloaded: boolean; outdated?: boolean }) {
  const { t } = useT();
  const action = useDownloadAction(props.id);
  return (
    <Card>
      <Row>
        <View style={[styles.cover, { backgroundColor: props.color }]}>
          <Text style={{ fontSize: 28, lineHeight: 34 }}>{props.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyBold" numberOfLines={1}>
            {props.title}
          </Text>
          <Text variant="caption" muted>
            {formatBytes(props.size)}
            {props.outdated ? ` · ${t('downloads.updateAvailable')}` : ''}
          </Text>
        </View>
        {action.progress !== null ? null : props.downloaded && !props.outdated ? (
          <Button label={t('common.delete')} size="sm" variant="secondary" onPress={() => void action.remove()} />
        ) : (
          <Button label={t('detail.download')} size="sm" variant="sky" onPress={() => void action.start()} />
        )}
      </Row>
      {action.progress !== null ? (
        <View style={{ marginTop: spacing.xs }}>
          <ProgressBar value={action.progress} color={colors.skyBlue} />
        </View>
      ) : null}
      {action.error ? <InlineMessage tone="error" message={t('downloads.failed')} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  cover: { width: 52, height: 52, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
});
