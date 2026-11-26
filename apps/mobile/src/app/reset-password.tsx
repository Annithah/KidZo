import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { resetPasswordSchema } from '@kidzo/shared';
import { Button } from '../components/Button';
import { TextField } from '../components/Controls';
import { Header, Screen } from '../components/Layout';
import { InlineMessage, errorMessage } from '../components/States';
import { Text } from '../components/Typography';
import { Zo } from '../components/Zo';
import { useT } from '../i18n';
import { api } from '../lib/api';
import { validate, validateField, type FieldErrors } from '../lib/form';
import { spacing } from '../theme/core';

/**
 * Opened from the reset email link (kidzo://reset-password?token=...). If the link did not
 * open the app, the parent can paste the code by hand. A successful reset signs out every device.
 */
export default function ResetPassword() {
  const { t } = useT();
  const params = useLocalSearchParams<{ token?: string }>();
  const linkToken = typeof params.token === 'string' ? params.token : '';
  const [token, setToken] = useState(linkToken);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const blur = (field: string) => setErrors((e) => ({ ...e, [field]: validateField(resetPasswordSchema, { token: token.trim(), password }, field) ?? '' }));
  const submit = async () => {
    const { data, errors: fieldErrors } = validate(resetPasswordSchema, { token: token.trim(), password });
    if (fieldErrors.token) fieldErrors.token = t('auth.resetInvalid');
    setErrors(fieldErrors);
    setFormError(null);
    if (!data) return;
    setBusy(true);
    try {
      await api.resetPassword(data.token, data.password);
      setDone(true);
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
          <Zo size={96} mood="waving" />
          <Text variant="h1" align="center">
            {t('auth.resetTitle')}
          </Text>
        </View>
        {done ? (
          <>
            <InlineMessage tone="success" message={t('auth.resetDone')} />
            <Button label={t('auth.signIn')} size="kid" fullWidth onPress={() => router.replace('/sign-in')} />
          </>
        ) : (
          <>
            {linkToken ? null : (
              <TextField
                label={t('auth.resetCode')}
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                autoCorrect={false}
                hint={t('auth.resetCodeHint')}
                error={errors.token || undefined}
          onBlur={() => blur('token')}
              />
            )}
            {linkToken && errors.token ? <InlineMessage tone="error" message={errors.token} /> : null}
            <TextField
              label={t('auth.newPassword')}
          icon="password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              hint={t('auth.passwordHint')}
              error={errors.password || undefined}
          onBlur={() => blur('password')}
              onSubmitEditing={submit}
            />
            {formError ? <InlineMessage tone="error" message={formError} /> : null}
            <Button label={t('auth.resetSubmit')} icon="check" size="kid" fullWidth loading={busy} disabled={busy} onPress={submit} />
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
});
