import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  AVATARS,
  LOCALES,
  LOCALE_LABELS,
  MAX_AGE,
  MIN_AGE,
  createChildSchema,
  type Avatar as AvatarName,
  type Child,
  type CreateChildInput,
  type Locale,
} from '@kidzo/shared';
import { useT } from '../i18n';
import { serverFieldErrors, validate, type FieldErrors } from '../lib/form';
import { colors, radii, spacing } from '../theme';
import { Button } from './Button';
import { Segmented, Stepper, TextField } from './Controls';
import { Avatar, avatarColor } from './Kid';
import { Card } from './Layout';
import { InlineMessage, errorMessage } from './States';
import { Text } from './Typography';

interface Props {
  initial?: Child;
  submitLabel: string;
  onSubmit: (input: CreateChildInput) => Promise<void>;
}

export function ChildForm({ initial, submitLabel, onSubmit }: Props) {
  const { t, locale: appLocale } = useT();
  const [name, setName] = useState(initial?.name ?? '');
  const [age, setAge] = useState(initial?.age ?? 5);
  const [avatar, setAvatar] = useState<AvatarName>(initial?.avatar ?? 'fox');
  const [locale, setLocale] = useState<Locale>(initial?.locale ?? appLocale);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const { data, errors: fieldErrors } = validate(createChildSchema, { name, age, avatar, locale });
    setErrors(fieldErrors);
    setFormError(null);
    if (!data) return;
    setBusy(true);
    try {
      await onSubmit(data);
    } catch (error) {
      const fromServer = serverFieldErrors(error);
      if (Object.keys(fromServer).length) setErrors(fromServer);
      else setFormError(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <TextField label={t('childForm.name')} value={name} onChangeText={setName} maxLength={30} autoComplete="off" error={errors.name} />

      <Card>
        <Text variant="bodyBold">{t('childForm.age')}</Text>
        <Stepper
          label={t('childForm.age')}
          valueLabel={String(age)}
          onDecrease={() => setAge((a) => Math.max(MIN_AGE, a - 1))}
          onIncrease={() => setAge((a) => Math.min(MAX_AGE, a + 1))}
          canDecrease={age > MIN_AGE}
          canIncrease={age < MAX_AGE}
        />
      </Card>

      <Text variant="bodyBold">{t('childForm.avatar')}</Text>
      <View style={styles.avatars} accessibilityRole="radiogroup">
        {AVATARS.map((a, i) => (
          <Pressable
            key={a}
            accessibilityRole="radio"
            accessibilityLabel={a}
            accessibilityState={{ selected: avatar === a }}
            onPress={() => setAvatar(a)}
            style={[styles.avatarChoice, avatar === a && styles.avatarOn]}
          >
            <Avatar avatar={a} size={60} color={avatarColor(i)} />
          </Pressable>
        ))}
      </View>

      <Text variant="bodyBold">{t('childForm.language')}</Text>
      <Segmented options={LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l].native }))} value={locale} onChange={setLocale} />

      <InlineMessage message={`🔐 ${t('childForm.privacy')}`} />
      {formError ? <InlineMessage tone="error" message={formError} /> : null}
      <Button label={submitLabel} size="kid" fullWidth loading={busy} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  avatarChoice: { borderRadius: radii.pill, borderWidth: 4, borderColor: 'transparent', padding: 2 },
  avatarOn: { borderColor: colors.navy },
});
