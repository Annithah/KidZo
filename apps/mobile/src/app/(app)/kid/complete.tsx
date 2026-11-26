import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { localize, type Locale } from '@kidzo/shared';
import { Art } from '../../../components/art/Art';
import { Sticker } from '../../../components/art/Sticker';
import { Button } from '../../../components/Button';
import { Confetti } from '../../../components/Confetti';
import { Icon } from '../../../components/icon/Icon';
import { Card, Row, Screen } from '../../../components/Layout';
import { InlineMessage } from '../../../components/States';
import { Text } from '../../../components/Typography';
import { useT } from '../../../i18n';
import { childrenQueryKey, useFamily } from '../../../lib/family';
import { getLastResult } from '../../../lib/last-result';
import { palette, radius, shadow, spacing, useTheme } from '../../../theme/core';

export default function Complete() {
  const { t } = useT();
  const theme = useTheme();
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
      world
      footer={
        <View style={{ gap: spacing.sm }}>
          {canReplay ? (
            <Button label={t('complete.watchReplay')} icon="replay" size="kid" variant={theme.isCalm ? 'moon' : 'grape'} fullWidth onPress={() => router.push('/kid/replay')} />
          ) : null}
          <Button label={t('complete.home')} icon="home" variant="secondary" fullWidth onPress={() => router.replace('/kid/home')} />
        </View>
      }
    >
      {theme.isCalm ? null : <Confetti />}
      <View style={styles.hero}>
        <Art art={theme.isCalm ? 'scene.bedtime' : 'scene.celebrate'} size={200} label={t('complete.title')} />
        <Text variant="kicker" color={theme.accentText}>
          {t('complete.title')}
        </Text>
        <Text variant="h2" align="center">
          {localize(result.content.title, locale)}
        </Text>
        <Animated.View entering={ZoomIn.springify()} style={[styles.stars, shadow(2, palette.star[700], theme)]}>
          <Icon name="star" weight="fill" size={32} color={palette.star[700]} />
          <Text variant="h1" color={palette.navy[500]}>
            {t('complete.stars', { count: result.starsEarned })}
          </Text>
        </Animated.View>
      </View>

      {result.stickerUnlocked ? (
        <Animated.View entering={ZoomIn.delay(400).springify()}>
          <Card layered world="grape">
            <Row>
              <Sticker art={result.stickerUnlocked.art} color={result.stickerUnlocked.color} size={96} shine />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={[styles.newBadge, { backgroundColor: palette.coral[500] }]}>
                  <Text variant="caption" color={palette.navy[500]}>
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
        <Row style={{ justifyContent: 'center' }}>
          <Icon name="replay" size={22} />
          <Text variant="bodyBold" align="center">
            {t('complete.replayTitle')}
          </Text>
        </Row>
      ) : null}
      {result.savedOffline ? <InlineMessage message={t('complete.savedOffline')} icon="offline" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
  stars: { backgroundColor: palette.star[200], borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  newBadge: { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 2 },
});
