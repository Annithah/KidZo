import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { localize } from '@kidzo/shared';
import { ContentCard } from '../../components/Kid';
import { Header, Screen } from '../../components/Layout';
import { EmptyView, ErrorView, LoadingView } from '../../components/States';
import { Text } from '../../components/Typography';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { useGuest } from '../../lib/guest';
import { colors, spacing } from '../../theme';

export default function GuestHomeScreen() {
  const { t, locale } = useT();
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

  if (age === null) return <Screen scroll={false}><LoadingView /></Screen>;
  const items = catalog.data ?? [];

  return (
    <Screen>
      <Header title={t('guest.homeTitle')} onBack={() => {
        setAge(null);
        router.replace('/welcome');
      }} backLabel={t('common.back')} />
      <View style={styles.intro}>
        <Text variant="h1" align="center">{t('guest.greeting')}</Text>
        <Text muted align="center">{t('guest.ageLabel', { age })}</Text>
      </View>
      {catalog.isLoading ? (
        <LoadingView />
      ) : catalog.error && items.length === 0 ? (
        <ErrorView error={catalog.error} onRetry={() => void catalog.refetch()} />
      ) : items.length === 0 ? (
        <EmptyView message={t('guest.empty')} />
      ) : (
        <>
          <Text variant="h2">{t('guest.catalogTitle')}</Text>
          <View style={styles.grid}>
            {items.map((item) => (
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  item: { width: '47%', flexGrow: 1, gap: spacing.xs },
  description: { paddingHorizontal: spacing.xs },
});
