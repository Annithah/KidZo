import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChildForm } from '../../../../components/ChildForm';
import { Header, Screen } from '../../../../components/Layout';
import { useT } from '../../../../i18n';
import { api } from '../../../../lib/api';
import { childrenQueryKey, useFamily } from '../../../../lib/family';

export default function NewChild() {
  const { t } = useT();
  const queryClient = useQueryClient();
  const { selectChild } = useFamily();
  return (
    <Screen>
      <Header title={t('childForm.newTitle')} backLabel={t('common.back')} />
      <ChildForm
        submitLabel={t('profiles.add')}
        onSubmit={async (input) => {
          const child = await api.createChild(input);
          await queryClient.invalidateQueries({ queryKey: childrenQueryKey });
          selectChild(child.id);
          router.replace({ pathname: '/parent/limits/[id]', params: { id: child.id } });
        }}
      />
    </Screen>
  );
}
