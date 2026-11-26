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
import { serverFieldErrors, validate, validateField, type FieldErrors } from '../lib/form';
import { deviceTimezone } from '../lib/queries';
import { useSession } from '../lib/session';
import { palette, radius, spacing, themes } from '../theme/core';
import { Icon } from '../components/icon/Icon';

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

  const blur = (field: string) =>
    setErrors((e) => ({
      ...e,
      [field]: validateField(registerSchema, { displayName, email, password, parentalConsent: true, locale, timezone: deviceTimezone() }, field) ?? '',
    }));

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
          <Text variant="kicker" color={themes.light.accentText}>
            {t('auth.grownUpsOnly')}
          </Text>
          <Text variant="h1" align="center">
            {t('auth.signUpTitle')}
          </Text>
        </View>
        <TextField
          label={t('auth.yourName')}
          icon="user"
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="name"
          error={errors.displayName || undefined}
          onBlur={() => blur('displayName')}
        />
        <TextField
          label={t('auth.email')}
          icon="email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          error={errors.email || undefined}
          onBlur={() => blur('email')}
        />
        <TextField
          label={t('auth.password')}
          icon="password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          hint={t('auth.passwordHint')}
          error={errors.password || undefined}
          onBlur={() => blur('password')}
        />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          accessibilityLabel={t('auth.consent')}
          onPress={() => setConsent((c) => !c)}
          style={styles.consent}
        >
          <View style={[styles.box, consent && styles.boxOn]}>{consent ? <Icon name="check" size={18} color={palette.navy[500]} /> : null}</View>
          <Text variant="small" style={{ flex: 1 }}>
            {t('auth.consent')}
          </Text>
        </Pressable>
        {errors.parentalConsent ? <InlineMessage tone="error" message={errors.parentalConsent} /> : null}
        {formError ? <InlineMessage tone="error" message={formError} /> : null}
        <Button label={t('auth.signUp')} icon="sparkle" size="kid" fullWidth loading={busy} disabled={busy} onPress={submit} />
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
    borderRadius: radius.sm / 2,
    borderWidth: 2,
    borderColor: palette.navy[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: palette.mint[300], borderColor: palette.mint[700] },
});
