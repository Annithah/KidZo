import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Platform } from 'react-native';
import { Button } from '../../../../components/Button';
import { ChildForm } from '../../../../components/ChildForm';
import { Header, Screen } from '../../../../components/Layout';
import { ErrorView } from '../../../../components/States';
import { useT } from '../../../../i18n';
import { api } from '../../../../lib/api';
import { childrenQueryKey, useFamily } from '../../../../lib/family';

export default function EditChild() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const queryClient = useQueryClient();
  const { children, selectChild, activeChild } = useFamily();
  const child = children.find((c) => c.id === id);

  if (!child) {
    return (
      <Screen scroll={false}>
        <Header backLabel={t('common.back')} />
        <ErrorView error={new Error('Not found')} onRetry={() => router.back()} />
      </Screen>
    );
  }

  const remove = async () => {
    await api.deleteChild(child.id);
    if (activeChild?.id === child.id) selectChild(null);
    await queryClient.invalidateQueries({ queryKey: childrenQueryKey });
    router.replace('/parent');
  };

  const confirmDelete = () => {
    const message = t('childForm.deleteConfirm', { name: child.name });
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(message)) void remove();
      return;
    }
    Alert.alert(t('childForm.deleteProfile'), message, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void remove() },
    ]);
  };

  return (
    <Screen>
      <Header title={t('childForm.editTitle')} backLabel={t('common.back')} />
      <ChildForm
        initial={child}
        submitLabel={t('common.save')}
        onSubmit={async (input) => {
          await api.updateChild(child.id, input);
          await queryClient.invalidateQueries({ queryKey: childrenQueryKey });
          router.back();
        }}
      />
      <Button label={t('childForm.deleteProfile')} variant="danger" fullWidth onPress={confirmDelete} />
    </Screen>
  );
}
