import { StyleSheet, View } from 'react-native';
import { localize, type Locale } from '@kidzo/shared';
import { Sticker } from '../../../components/art/Sticker';
import { SwooshProgress } from '../../../components/Controls';
import { Header, Screen } from '../../../components/Layout';
import { ErrorView, LoadingView, OfflineBanner } from '../../../components/States';
import { TabBar } from '../../../components/TabBar';
import { Text } from '../../../components/Typography';
import { ZoSays } from '../../../components/Zo';
import { useT } from '../../../i18n';
import { useFamily } from '../../../lib/family';
import { useStickers } from '../../../lib/queries';
import { radius, shadow, spacing, useTheme } from '../../../theme/core';

export default function Stickers() {
  const { t } = useT();
  const theme = useTheme();
  const { activeChild } = useFamily();
  const { all, owned } = useStickers(activeChild?.id);
  if (!activeChild) return null;
  const locale = activeChild.locale as Locale;
  const ownedIds = new Set((owned.data ?? []).map((s) => s.id));
  const list = all.data ?? [];

  return (
    <Screen world overlay={<TabBar />}>
      <Header title={t('stickers.title')} backLabel={t('common.back')} />
      <OfflineBanner />
      {all.isLoading ? (
        <LoadingView />
      ) : all.error && list.length === 0 ? (
        <ErrorView error={all.error} onRetry={() => void all.refetch()} />
      ) : (
        <>
          <ZoSays mood={ownedIds.size > 0 ? 'cheering' : 'waving'} message={t('stickers.count', { owned: ownedIds.size, total: list.length })} />
          <SwooshProgress done={ownedIds.size} total={Math.max(1, list.length)} label={t('stickers.count', { owned: ownedIds.size, total: list.length })} />
          <View style={styles.grid}>
            {list.map((s) => {
              const has = ownedIds.has(s.id);
              const name = localize(s.name, locale);
              return (
                <View key={s.id} style={[styles.tile, { backgroundColor: theme.surface }, shadow(1, undefined, theme)]}>
                  <Sticker art={s.art} color={s.color} size={84} locked={!has} label={has ? name : t('stickers.locked')} />
                  <Text variant="caption" align="center" muted={!has} numberOfLines={2}>
                    {has ? name : t('stickers.locked')}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  tile: { width: 108, borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center', gap: 6 },
});
