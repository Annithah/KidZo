import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { localize, type Locale } from '@kidzo/shared';
import { Button } from '../../../components/Button';
import { Card, Row, Screen } from '../../../components/Layout';
import { InlineMessage } from '../../../components/States';
import { Text } from '../../../components/Typography';
import { Zo } from '../../../components/Zo';
import { useT } from '../../../i18n';
import { childrenQueryKey, useFamily } from '../../../lib/family';
import { getLastResult } from '../../../lib/last-result';
import { colors, radii, spacing, usePalette } from '../../../theme';

export default function Complete() {
  const { t } = useT();
  const palette = usePalette();
  const queryClient = useQueryClient();
  const { activeChild } = useFamily();
  const result = getLastResult();

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: childrenQueryKey });
  }, [queryClient]);

  if (!result || !activeChild) return <Redirect href="/kid/home" />;
  const locale = activeChild.locale as Locale;
  const canReplay = result.content.body.kind === 'branching' && result.path.length > 1;

  return (
    <Screen
      footer={
        <View style={{ gap: spacing.sm }}>
          {canReplay ? (
            <Button label={`🎬  ${t('complete.watchReplay')}`} size="kid" variant={palette.isCalm ? 'moon' : 'lavender'} fullWidth onPress={() => router.push('/kid/replay')} />
          ) : null}
          <Button label={t('complete.home')} variant="secondary" fullWidth onPress={() => router.replace('/kid/home')} />
        </View>
      }
    >
      <View style={styles.hero}>
        <Zo size={150} mood={palette.isCalm ? 'sleepy' : 'cheer'} />
        <Text variant="kicker" color={palette.isCalm ? palette.accent : colors.coral}>
          {t('complete.title')}
        </Text>
        <Text variant="h2" align="center">
          {localize(result.content.title, locale)}
        </Text>
        <Animated.View entering={ZoomIn.springify()} style={styles.stars}>
          <Text variant="display" color={colors.navy}>
            ⭐ {t('complete.stars', { count: result.starsEarned })}
          </Text>
        </Animated.View>
      </View>

      {result.stickerUnlocked ? (
        <Animated.View entering={ZoomIn.delay(400).springify()}>
          <Card>
            <Row>
              <View style={[styles.sticker, { backgroundColor: result.stickerUnlocked.color }]}>
                <Text style={{ fontSize: 44, lineHeight: 54 }}>{result.stickerUnlocked.emoji}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.newBadge}>
                  <Text variant="caption" color={colors.white}>
                    {t('complete.new')}
                  </Text>
                </View>
                <Text variant="kicker" muted>
                  {t('complete.stickerUnlocked')}
                </Text>
                <Text variant="h3">{localize(result.stickerUnlocked.name, locale)}</Text>
              </View>
            </Row>
          </Card>
        </Animated.View>
      ) : null}

      {canReplay ? (
        <Text variant="bodyBold" align="center">
          🎬 {t('complete.replayTitle')}
        </Text>
      ) : null}
      {result.savedOffline ? <InlineMessage message={t('complete.savedOffline')} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
  stars: { backgroundColor: colors.starYellow, borderRadius: radii.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  sticker: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  newBadge: { alignSelf: 'flex-start', backgroundColor: colors.coral, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 2 },
});
