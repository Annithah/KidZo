import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { MAX_AGE, MIN_AGE } from '@kidzo/shared';
import { Button } from '../../components/Button';
import { Header, Screen } from '../../components/Layout';
import { Text } from '../../components/Typography';
import { useT } from '../../i18n';
import { useGuest } from '../../lib/guest';
import { ageBand, spacing } from '../../theme/core';
import type { ButtonVariant } from '../../components/Button';
import { ZoSays } from '../../components/Zo';

const BAND_VARIANT: Record<ReturnType<typeof ageBand>, ButtonVariant> = { little: 'tangerine', middle: 'sky', big: 'grape' };

export default function GuestAgeScreen() {
  const { t } = useT();
  const { setAge } = useGuest();

  return (
    <Screen world>
      <Header title={t('guest.ageTitle')} onBack={() => router.replace('/welcome')} backLabel={t('common.back')} />
      <ZoSays mood="waving" message={t('guest.agePrompt')} />
      <View style={styles.ages}>
        {Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, index) => MIN_AGE + index).map((age) => (
          <View key={age} style={styles.ageButton}>
            <Button
              label={String(age)}
              size="kid"
              variant={BAND_VARIANT[ageBand(age)]}
              fullWidth
              accessibilityHint={t('guest.ageHint', { age })}
              onPress={() => {
                setAge(age);
                router.replace('/guest/home');
              }}
            />
          </View>
        ))}
      </View>
      <Text variant="caption" muted align="center">
        {t('guest.privacy')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ages: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  ageButton: { width: '30%' },
});
