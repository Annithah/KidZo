import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { registerSchema } from '@kidzo/shared';
import { Button } from '../components/Button';
import { TextField } from '../components/Controls';
import { Header, Screen } from '../components/Layout';
import { InlineMessage, errorMessage } from '../components/States';
import { Text } from '../components/Typography';
import { useT } from '../i18n';
import { serverFieldErrors, validate, type FieldErrors } from '../lib/form';
import { deviceTimezone } from '../lib/queries';
import { useSession } from '../lib/session';
import { colors, radii, spacing } from '../theme';

export default function SignUp() {
  const { t, locale } = useT();
  const { signUp } = useSession();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const input = { displayName, email, password, parentalConsent: consent, locale, timezone: deviceTimezone() };
    const { data, errors: fieldErrors } = validate(registerSchema, input);
    if (!consent) fieldErrors.parentalConsent = t('auth.consentRequired');
    setErrors(fieldErrors);
    setFormError(null);
    if (!data) return;
    setBusy(true);
    try {
      await signUp(data);
    } catch (error) {
      const fromServer = serverFieldErrors(error);
      if (Object.keys(fromServer).length) setErrors(fromServer);
      else setFormError(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Header backLabel={t('common.back')} />
        <View style={styles.top}>
          <Text variant="kicker" color={colors.coral}>
            {t('auth.grownUpsOnly')}
          </Text>
          <Text variant="h1" align="center">
            {t('auth.signUpTitle')}
          </Text>
        </View>
        <TextField label={t('auth.yourName')} value={displayName} onChangeText={setDisplayName} autoComplete="name" error={errors.displayName} />
        <TextField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          error={errors.email}
        />
        <TextField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          hint={t('auth.passwordHint')}
          error={errors.password}
        />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          accessibilityLabel={t('auth.consent')}
          onPress={() => setConsent((c) => !c)}
          style={styles.consent}
        >
          <View style={[styles.box, consent && styles.boxOn]}>{consent ? <Text color={colors.white}>✓</Text> : null}</View>
          <Text variant="small" style={{ flex: 1 }}>
            {t('auth.consent')}
          </Text>
        </Pressable>
        {errors.parentalConsent ? <InlineMessage tone="error" message={errors.parentalConsent} /> : null}
        {formError ? <InlineMessage tone="error" message={formError} /> : null}
        <Button label={t('auth.signUp')} size="kid" fullWidth loading={busy} onPress={submit} />
        <Button label={t('auth.haveAccount')} variant="ghost" onPress={() => router.replace('/sign-in')} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  consent: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', paddingVertical: spacing.xs },
  box: {
    width: 28,
    height: 28,
    borderRadius: radii.sm / 2,
    borderWidth: 2,
    borderColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.mint, borderColor: colors.mint },
});
