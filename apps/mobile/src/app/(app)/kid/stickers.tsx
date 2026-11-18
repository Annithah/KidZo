import { StyleSheet, View } from 'react-native';
import { localize, type Locale } from '@kidzo/shared';
import { Header, Screen } from '../../../components/Layout';
import { ErrorView, LoadingView, OfflineBanner } from '../../../components/States';
import { Text } from '../../../components/Typography';
import { useT } from '../../../i18n';
import { useFamily } from '../../../lib/family';
import { useStickers } from '../../../lib/queries';
import { colors, radii, softShadow, spacing, usePalette } from '../../../theme';

export default function Stickers() {
  const { t } = useT();
  const palette = usePalette();
  const { activeChild } = useFamily();
  const { all, owned } = useStickers(activeChild?.id);
  if (!activeChild) return null;
  const locale = activeChild.locale as Locale;
  const ownedIds = new Set((owned.data ?? []).map((s) => s.id));
  const list = all.data ?? [];

  return (
    <Screen>
      <Header title={t('stickers.title')} backLabel={t('common.back')} />
      <OfflineBanner />
      {all.isLoading ? (
        <LoadingView />
      ) : all.error && list.length === 0 ? (
        <ErrorView error={all.error} onRetry={() => void all.refetch()} />
      ) : (
        <>
          <Text variant="h3" align="center">
            {t('stickers.count', { owned: ownedIds.size, total: list.length })}
          </Text>
          <View style={styles.grid}>
            {list.map((s) => {
              const has = ownedIds.has(s.id);
              const name = localize(s.name, locale);
              return (
                <View
                  key={s.id}
                  style={[styles.tile, { backgroundColor: palette.surface }, !palette.isCalm && softShadow(2)]}
                  accessible
                  accessibilityLabel={has ? name : t('stickers.locked')}
                >
                  <View style={[styles.circle, { backgroundColor: has ? s.color : colors.line }]}>
                    <Text style={[styles.emoji, !has && styles.lockedEmoji]}>{has ? s.emoji : '?'}</Text>
                  </View>
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
  tile: { width: 104, borderRadius: radii.lg, padding: spacing.sm, alignItems: 'center', gap: 6 },
  circle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 38, lineHeight: 46 },
  lockedEmoji: { color: colors.inkSubtle, fontSize: 30 },
});
