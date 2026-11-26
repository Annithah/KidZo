import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useT } from '../i18n';
import { api } from '../lib/api';
import { ApiError } from '@kidzo/shared';
import { useParentGate } from '../lib/parent-gate';
import { useSession } from '../lib/session';
import { spacing, useTheme } from '../theme/core';
import { Icon } from './icon/Icon';
import { Button } from './Button';
import { TextField } from './Controls';
import { Header, Row, Screen } from './Layout';
import { PinPad } from './PinPad';
import { InlineMessage, errorMessage } from './States';
import { Text } from './Typography';
import { Zo } from './Zo';

type Mode = 'enter' | 'create' | 'confirm' | 'offline';

const randomFactor = () => 6 + Math.floor(Math.random() * 7);

/**
 * Grown-ups only gate. First use creates a PIN. Online, the PIN is checked by the server
 * (rate limited, locks after repeated failures). Offline, an adult level multiplication
 * question is used instead, since young children cannot answer it.
 */
export function ParentGate() {
  const { t } = useT();
  const theme = useTheme();
  const { user, setUser, signOut } = useSession();
  const { unlock } = useParentGate();
  const [mode, setMode] = useState<Mode>(user?.hasPin ? 'enter' : 'create');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [question] = useState(() => ({ a: randomFactor(), b: randomFactor() }));
  const [answer, setAnswer] = useState('');

  const submit = (value: string) => {
    if (mode === 'create') {
      setFirstPin(value);
      setMode('confirm');
      setMessage(null);
      return;
    }
    if (mode === 'confirm') {
      if (value !== firstPin) {
        setMode('create');
        setMessage(t('gate.mismatch'));
        return;
      }
      setBusy(true);
      api
        .setPin(value)
        .then(() => {
          if (user) setUser({ ...user, hasPin: true });
          unlock();
        })
        .catch((e: unknown) => setMessage(errorMessage(e, t)))
        .finally(() => setBusy(false));
      return;
    }
    if (mode === 'enter') {
      setBusy(true);
      api
        .verifyPin(value)
        .then(() => unlock())
        .catch((e: unknown) => {
          if (e instanceof ApiError && e.isNetwork) {
            setMode('offline');
            setMessage(null);
          } else if (e instanceof ApiError && e.code === 'PIN_INCORRECT') {
            const left = (e.details as { attemptsLeft?: number } | undefined)?.attemptsLeft ?? 0;
            setMessage(left > 0 ? t('gate.wrong', { count: left }) : t('gate.locked'));
          } else if (e instanceof ApiError && e.code === 'PIN_LOCKED') {
            setMessage(t('gate.locked'));
          } else {
            setMessage(errorMessage(e, t));
          }
        })
        .finally(() => setBusy(false));
    }
  };

  const onPinChange = (value: string) => {
    if (busy) return;
    if (value.length < 4) {
      setPin(value);
      return;
    }
    setPin('');
    submit(value);
  };

  const prompt = mode === 'create' ? t('gate.setPin') : mode === 'confirm' ? t('gate.confirmPin') : t('gate.enterPin');

  return (
    <Screen>
      <Header backLabel={t('common.back')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <View style={styles.top}>
        <Zo size={88} mood="waving" />
        <Row gap={6}>
          <Icon name="lock" size={16} color={theme.accentText} />
          <Text variant="kicker" color={theme.accentText}>
            {t('gate.title')}
          </Text>
        </Row>
      </View>
      {mode === 'offline' ? (
        <View style={styles.offline}>
          <Text variant="bodyBold" align="center">
            {t('gate.offline')}
          </Text>
          <Text variant="display" align="center">
            {t('gate.mathQuestion', { a: question.a, b: question.b })}
          </Text>
          <TextField label={t('gate.title')} value={answer} onChangeText={setAnswer} keyboardType="number-pad" maxLength={3} icon="password" />
          <Button
            label={t('common.continue')}
            size="kid"
            fullWidth
            onPress={() => {
              if (Number(answer) === question.a * question.b) unlock();
              else setMessage(t('gate.mismatch'));
            }}
          />
        </View>
      ) : (
        <>
          <Text variant="h2" align="center">
            {prompt}
          </Text>
          <PinPad value={pin} onChange={onPinChange} disabled={busy} />
        </>
      )}
      {message ? <InlineMessage tone="error" message={message} /> : null}
      {mode === 'enter' ? <Button label={t('gate.forgot')} icon="signOut" variant="ghost" onPress={() => void signOut()} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: spacing.xs },
  offline: { gap: spacing.md },
});
