import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LOCALES, LOCALE_LABELS, type Locale } from '@kidzo/shared';
import { Button } from '../components/Button';
import { Segmented } from '../components/Controls';
import { Screen } from '../components/Layout';
import { Text } from '../components/Typography';
import { Zo } from '../components/Zo';
import { setAppLocale, useT } from '../i18n';
import { colors, spacing } from '../theme';

const logo = require('../../assets/images/logo.png');

export default function Welcome() {
  const { t, locale } = useT();
  const [lang, setLang] = useState<Locale>(locale);

  return (
    <Screen
      footer={
        <View style={styles.actions}>
          <Button label={t('welcome.getStarted')} size="kid" fullWidth onPress={() => router.push('/sign-up')} />
          <Button label={t('welcome.haveAccount')} variant="secondary" fullWidth onPress={() => router.push('/sign-in')} />
          <Button label={t('guest.try')} variant="ghost" fullWidth onPress={() => router.push('/guest/age')} />
        </View>
      }
    >
      <View style={styles.hero}>
        <Image source={logo} style={styles.logo} contentFit="contain" accessibilityLabel="KIDZO" />
        <Zo size={140} mood="cheer" />
        <Text variant="kicker" color={colors.coral}>
          {t('welcome.kicker')}
        </Text>
        <Text variant="display" align="center">
          {t('welcome.title')}
          {'\n'}
          <Text variant="display" color={colors.coral}>
            {t('welcome.titleAccent')}
          </Text>
        </Text>
        <Text muted align="center">
          {t('welcome.subtitle')}
        </Text>
      </View>
      <View style={styles.langs}>
        <Segmented
          options={LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l].native }))}
          value={lang}
          onChange={(l) => {
            setLang(l);
            setAppLocale(l);
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg },
  logo: { width: 200, height: 94 },
  langs: { alignItems: 'center', marginTop: spacing.md },
  actions: { gap: spacing.sm },
});
