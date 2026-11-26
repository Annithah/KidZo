import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import type { BlockReason } from '@kidzo/shared';
import { Art } from '../../../components/art/Art';
import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Layout';
import { Text } from '../../../components/Typography';
import { useT, type TranslationKey } from '../../../i18n';
import { spacing, useTheme } from '../../../theme/core';

const COPY: Record<BlockReason, { title: TranslationKey; body: TranslationKey; art: string }> = {
  limit: { title: 'blocked.limitTitle', body: 'blocked.limitBody', art: 'scene.time-up' },
  locked: { title: 'blocked.lockedTitle', body: 'blocked.lockedBody', art: 'zo.sleepy' },
  bedtime: { title: 'blocked.bedtimeTitle', body: 'blocked.bedtimeBody', art: 'scene.bedtime' },
  age: { title: 'blocked.ageTitle', body: 'blocked.ageBody', art: 'zo.thinking' },
  category: { title: 'blocked.categoryTitle', body: 'blocked.categoryBody', art: 'zo.thinking' },
};

export default function Blocked() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const { t } = useT();
  const theme = useTheme();
  const copy = COPY[(reason as BlockReason) in COPY ? (reason as BlockReason) : 'limit'];

  return (
    <Screen world scroll={false} contentStyle={styles.center}>
      <Art art={copy.art} size={240} />
      <Text variant="h1" align="center" accessibilityRole="header">
        {t(copy.title)}
      </Text>
      <Text muted align="center">
        {t(copy.body)}
      </Text>
      {reason === 'bedtime' ? (
        <Button label={t('blocked.calmStories')} icon="bedtime" variant="moon" size="kid" onPress={() => router.replace('/kid/home')} />
      ) : (
        <Button label={t('complete.home')} icon="home" size="kid" variant={theme.isCalm ? 'moon' : 'primary'} onPress={() => router.replace('/kid/home')} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md } });
