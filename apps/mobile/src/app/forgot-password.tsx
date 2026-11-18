import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { forgotPasswordSchema } from '@kidzo/shared';
import { Button } from '../components/Button';
import { TextField } from '../components/Controls';
import { Header, Screen } from '../components/Layout';
import { InlineMessage, errorMessage } from '../components/States';
import { Text } from '../components/Typography';
import { Zo } from '../components/Zo';
import { useT } from '../i18n';
import { api } from '../lib/api';
import { validate, type FieldErrors } from '../lib/form';
import { colors, spacing } from '../theme';

/** Requests a password reset email. The API answers the same way whether or not the email exists. */
export default function ForgotPassword() {
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const { data, errors: fieldErrors } = validate(forgotPasswordSchema, { email });
    setErrors(fieldErrors);
    setFormError(null);
    if (!data) return;
    setBusy(true);
    try {
      await api.forgotPassword(data.email);
      setSent(true);
    } catch (error) {
      setFormError(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Header backLabel={t('common.back')} />
        <View style={styles.top}>
          <Zo size={88} />
          <Text variant="kicker" color={colors.coral}>
            {t('auth.grownUpsOnly')}
          </Text>
          <Text variant="h1" align="center">
            {t('auth.forgotTitle')}
          </Text>
          <Text align="center" muted>
            {t('auth.forgotBody')}
          </Text>
        </View>
        <TextField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          error={errors.email}
          onSubmitEditing={submit}
        />
        {sent ? <InlineMessage tone="success" message={t('auth.linkSent')} /> : null}
        {formError ? <InlineMessage tone="error" message={formError} /> : null}
        <Button label={t('auth.sendLink')} size="kid" fullWidth loading={busy} onPress={submit} />
        <Button label={t('auth.resetCode')} variant="ghost" onPress={() => router.push('/reset-password')} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
});
