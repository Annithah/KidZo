import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Share, View } from 'react-native';
import { LOCALES, LOCALE_LABELS, pinSchema, type Locale } from '@kidzo/shared';
import { Button } from '../../../components/Button';
import { Segmented, TextField } from '../../../components/Controls';
import { Card, Header, Row, Screen } from '../../../components/Layout';
import { InlineMessage, errorMessage } from '../../../components/States';
import { Text } from '../../../components/Typography';
import { setAppLocale, useT } from '../../../i18n';
import { api } from '../../../lib/api';
import { offlineQueue } from '../../../lib/offline';
import { useSession } from '../../../lib/session';
import { spacing } from '../../../theme/core';
import { Icon } from '../../../components/icon/Icon';

type Notice = { tone: 'success' | 'error'; message: string } | null;

export default function Account() {
  const { t } = useT();
  const { user, setUser, signOut } = useSession();
  const queryClient = useQueryClient();
  const pending = useQuery({ queryKey: ['pending-sync'], queryFn: () => offlineQueue.size() });

  const [notice, setNotice] = useState<Notice>(null);
  const [pinPassword, setPinPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
    } catch (error) {
      setNotice({ tone: 'error', message: errorMessage(error, t) });
    } finally {
      setBusy(null);
    }
  };

  if (!user) return null;

  return (
    <Screen>
      <Header title={t('account.title')} backLabel={t('common.back')} />
      <Card>
        <Text variant="h3">{user.displayName}</Text>
        <Text muted>{user.email}</Text>
      </Card>

      <Card>
        <Text variant="bodyBold">{t('account.language')}</Text>
        <View style={{ marginTop: spacing.xs }}>
          <Segmented
            options={LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l].native }))}
            value={user.locale}
            onChange={(locale: Locale) =>
              void run('locale', async () => {
                setAppLocale(locale);
                setUser(await api.updateMe({ locale }));
              })
            }
          />
        </View>
      </Card>

      <Card>
        <Text variant="bodyBold">{t('account.changePin')}</Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
          <TextField label={t('account.currentPassword')} icon="password" value={pinPassword} onChangeText={setPinPassword} secureTextEntry autoComplete="current-password" />
          <TextField label={t('account.newPin')} icon="lock" value={newPin} onChangeText={setNewPin} keyboardType="number-pad" maxLength={4} secureTextEntry />
          <Button
            label={t('common.save')}
            variant="sky"
            loading={busy === 'pin'}
            onPress={() =>
              void run('pin', async () => {
                const pin = pinSchema.parse(newPin);
                await api.setPin(pin, pinPassword);
                setPinPassword('');
                setNewPin('');
                setNotice({ tone: 'success', message: t('account.pinChanged') });
              })
            }
          />
        </View>
      </Card>

      <Card>
        <Row>
          <Icon name="sync" size={22} />
          <Text variant="bodyBold">{t('account.pendingSync', { count: pending.data ?? 0 })}</Text>
        </Row>
        <View style={{ marginTop: spacing.xs }}>
          <Button
            label={t('account.syncNow')}
            size="sm"
            variant="secondary"
            loading={busy === 'sync'}
            disabled={(pending.data ?? 0) === 0}
            onPress={() =>
              void run('sync', async () => {
                await offlineQueue.flush(api.syncSessions);
                await queryClient.invalidateQueries();
              })
            }
          />
        </View>
      </Card>

      <Card>
        <Text variant="bodyBold">{t('account.exportData')}</Text>
        <Text variant="small" muted>
          {t('account.exportHint')}
        </Text>
        <View style={{ marginTop: spacing.xs }}>
          <Button
            label={t('account.exportData')}
            size="sm"
            variant="secondary"
            loading={busy === 'export'}
            onPress={() =>
              void run('export', async () => {
                const data = await api.exportData();
                await Share.share({ title: 'KIDZO data export', message: JSON.stringify(data, null, 2) });
                setNotice({ tone: 'success', message: t('account.exportReady') });
              })
            }
          />
        </View>
      </Card>

      <Row style={{ justifyContent: 'center', paddingHorizontal: spacing.md }}>
        <Icon name="privacy" size={20} />
        <Text variant="small" muted style={{ flex: 1 }}>
          {t('account.privacy')}
        </Text>
      </Row>
      {notice ? <InlineMessage tone={notice.tone} message={notice.message} /> : null}

      <Button label={t('account.credits')} icon="video" variant="sky" fullWidth onPress={() => router.push('/parent/credits')} />
      <Button label={t('account.signOut')} icon="signOut" variant="navy" fullWidth onPress={() => void signOut()} />

      <Card>
        <Text variant="bodyBold">{t('account.deleteAccount')}</Text>
        <Text variant="small" muted>
          {t('account.deleteHint')}
        </Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
          <TextField label={t('account.deleteConfirm')} value={deletePassword} onChangeText={setDeletePassword} secureTextEntry autoComplete="current-password" />
          <Button
            label={t('account.deleteAccount')}
            icon="delete"
            variant="danger"
            disabled={deletePassword.length === 0}
            loading={busy === 'delete'}
            onPress={() =>
              void run('delete', async () => {
                await api.deleteAccount(deletePassword);
                await signOut();
              })
            }
          />
        </View>
      </Card>
    </Screen>
  );
}
