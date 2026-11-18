import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { loginSchema } from '@kidzo/shared';
import { Button } from '../components/Button';
import { TextField } from '../components/Controls';
import { Header, Screen } from '../components/Layout';
import { InlineMessage, errorMessage } from '../components/States';
import { Text } from '../components/Typography';
import { Zo } from '../components/Zo';
import { useT } from '../i18n';
import { validate, type FieldErrors } from '../lib/form';
import { useSession } from '../lib/session';
import { colors, spacing } from '../theme';

export default function SignIn() {
  const { t } = useT();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const { data, errors: fieldErrors } = validate(loginSchema, { email, password });
    setErrors(fieldErrors);
    setFormError(null);
    if (!data) return;
    setBusy(true);
    try {
      await signIn(data);
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
            {t('auth.signInTitle')}
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
        />
        <TextField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          error={errors.password}
          onSubmitEditing={submit}
        />
        {formError ? <InlineMessage tone="error" message={formError} /> : null}
        <Button label={t('auth.signIn')} size="kid" fullWidth loading={busy} onPress={submit} />
        <Button label={t('auth.forgotPassword')} variant="ghost" onPress={() => router.push('/forgot-password')} />
        <Button label={t('auth.noAccount')} variant="ghost" onPress={() => router.replace('/sign-up')} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
});
