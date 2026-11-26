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
import { palette, radius, spacing } from '../../../theme/core';
import { Art } from '../../../components/art/Art';
import { Icon } from '../../../components/icon/Icon';

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
      <Card color={palette.sky[50]}>
        <Row>
          <Icon name="storage" size={26} color={palette.navy[500]} accent={palette.sky[300]} />
          <Text variant="bodyBold" style={{ flex: 1 }}>
            {t('downloads.storage', { size: formatBytes(used) })}
          </Text>
        </Row>
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
                art={e.coverArt}
                color={e.coverColor}
                size={e.sizeBytes}
                downloaded
                outdated={outdated.some((o) => o.id === e.id)}
              />
            );
          })}
          <Button
            label={t('downloads.removeAll')}
            icon="delete"
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
          <DownloadRow key={c.id} id={c.id} title={localize(c.title, locale)} art={c.coverArt} color={c.coverColor} size={c.sizeBytes} downloaded={false} />
        ))
      )}
    </Screen>
  );
}

function DownloadRow(props: { id: string; title: string; art: string; color: string; size: number; downloaded: boolean; outdated?: boolean }) {
  const { t } = useT();
  const action = useDownloadAction(props.id);
  return (
    <Card>
      <Row>
        <View style={[styles.cover, { backgroundColor: palette.sky[50] }]}>
          <Art art={props.art} size={48} />
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
          <Button label={t('common.delete')} icon="delete" size="sm" variant="secondary" onPress={() => void action.remove()} />
        ) : (
          <Button label={t('detail.download')} icon="downloads" size="sm" variant="sky" onPress={() => void action.start()} />
        )}
      </Row>
      {action.progress !== null ? (
        <View style={{ marginTop: spacing.xs }}>
          <ProgressBar value={action.progress} color={palette.sky[500]} />
        </View>
      ) : null}
      {action.error ? <InlineMessage tone="error" message={t('downloads.failed')} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  cover: { width: 56, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
