import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import type { BlockReason } from '@kidzo/shared';
import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Layout';
import { Text } from '../../../components/Typography';
import { Zo } from '../../../components/Zo';
import { useT, type TranslationKey } from '../../../i18n';
import { spacing, usePalette } from '../../../theme';

const COPY: Record<BlockReason, { title: TranslationKey; body: TranslationKey; emoji: string }> = {
  limit: { title: 'blocked.limitTitle', body: 'blocked.limitBody', emoji: '🌈' },
  locked: { title: 'blocked.lockedTitle', body: 'blocked.lockedBody', emoji: '🧸' },
  bedtime: { title: 'blocked.bedtimeTitle', body: 'blocked.bedtimeBody', emoji: '🌙' },
  age: { title: 'blocked.ageTitle', body: 'blocked.ageBody', emoji: '🚀' },
};

export default function Blocked() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const { t } = useT();
  const palette = usePalette();
  const copy = COPY[(reason as BlockReason) in COPY ? (reason as BlockReason) : 'limit'];

  return (
    <Screen scroll={false} contentStyle={styles.center}>
      <Zo size={150} mood="sleepy" />
      <Text style={styles.emoji}>{copy.emoji}</Text>
      <Text variant="h1" align="center">
        {t(copy.title)}
      </Text>
      <Text muted align="center">
        {t(copy.body)}
      </Text>
      {reason === 'bedtime' ? (
        <Button label={`🌙  ${t('blocked.calmStories')}`} variant="moon" size="kid" onPress={() => router.replace('/kid/home')} />
      ) : (
        <Button label={t('complete.home')} size="kid" variant={palette.isCalm ? 'moon' : 'primary'} onPress={() => router.replace('/kid/home')} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emoji: { fontSize: 48, lineHeight: 58 },
});
