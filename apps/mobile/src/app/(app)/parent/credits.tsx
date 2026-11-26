import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { localize, type VideoCreditEntry } from '@kidzo/shared';
import { Card, Header, Screen } from '../../../components/Layout';
import { EmptyView, ErrorView, LoadingView, OfflineBanner } from '../../../components/States';
import { Text } from '../../../components/Typography';
import { useT } from '../../../i18n';
import { api } from '../../../lib/api';
import { withOfflineCache } from '../../../lib/offline';
import { spacing } from '../../../theme/core';

const SOURCE_NAMES: Record<VideoCreditEntry['credit']['source'], string> = {
  pexels: 'Pexels',
  pixabay: 'Pixabay',
  nasa: 'NASA',
  wikimedia: 'Wikimedia Commons',
  blender: 'Blender Foundation',
  kidzo: 'KIDZO',
  upload: 'KIDZO',
};

/** Where every video in the library came from, who made it and its license. */
export default function Credits() {
  const { t, locale } = useT();
  const credits = useQuery({ queryKey: ['credits'], queryFn: () => withOfflineCache('credits', () => api.credits()) });

  return (
    <Screen>
      <Header title={t('credits.title')} backLabel={t('common.back')} />
      <OfflineBanner />
      <Text muted>{t('credits.subtitle')}</Text>
      {credits.isLoading ? (
        <LoadingView />
      ) : credits.error && !credits.data ? (
        <ErrorView error={credits.error} onRetry={() => void credits.refetch()} />
      ) : (credits.data ?? []).length === 0 ? (
        <EmptyView message={t('credits.empty')} />
      ) : (
        (credits.data ?? []).map((entry) => (
          <Card key={entry.contentId}>
            <View style={{ gap: spacing.xxs }}>
              <Text variant="bodyBold">{localize(entry.title, locale)}</Text>
              <Text variant="caption" muted>
                {[SOURCE_NAMES[entry.credit.source], entry.credit.author, entry.credit.license].filter(Boolean).join(' · ')}
              </Text>
              {entry.credit.attribution ? <Text variant="caption">{entry.credit.attribution}</Text> : null}
              {entry.credit.sourceUrl ? (
                <Text variant="small" muted selectable>
                  {entry.credit.sourceUrl}
                </Text>
              ) : null}
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
