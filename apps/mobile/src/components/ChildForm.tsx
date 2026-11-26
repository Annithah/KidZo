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
import { serverFieldErrors, validate, validateField, type FieldErrors } from '../lib/form';
import { palette, radius, spacing } from '../theme/core';
import { Avatar, avatarWorld } from './art/Avatar';
import { Button } from './Button';
import { Segmented, Stepper, TextField } from './Controls';
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
  const values = { name, age, avatar, locale };

  const submit = async () => {
    const { data, errors: fieldErrors } = validate(createChildSchema, values);
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
      <TextField
        label={t('childForm.name')}
        value={name}
        onChangeText={(v) => {
          setName(v);
          if (errors.name) setErrors((e) => ({ ...e, name: validateField(createChildSchema, { ...values, name: v }, 'name') ?? '' }));
        }}
        onBlur={() => setErrors((e) => ({ ...e, name: validateField(createChildSchema, values, 'name') ?? '' }))}
        maxLength={30}
        autoComplete="off"
        icon="child"
        error={errors.name || undefined}
      />

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
      <View style={styles.avatars} accessibilityRole="radiogroup" accessibilityLabel={t('childForm.avatar')}>
        {AVATARS.map((a) => {
          const selected = avatar === a;
          return (
            <Pressable
              key={a}
              accessibilityRole="radio"
              accessibilityLabel={a}
              accessibilityState={{ selected }}
              onPress={() => setAvatar(a)}
              style={({ pressed }) => [
                styles.avatarChoice,
                { borderColor: selected ? palette[avatarWorld(a)][500] : 'transparent', backgroundColor: selected ? palette[avatarWorld(a)][50] : 'transparent', transform: [{ scale: pressed ? 0.94 : 1 }] },
              ]}
            >
              <Avatar avatar={a} size={64} />
            </Pressable>
          );
        })}
      </View>

      <Text variant="bodyBold">{t('childForm.language')}</Text>
      <Segmented label={t('childForm.language')} options={LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l].native }))} value={locale} onChange={setLocale} />

      <InlineMessage message={t('childForm.privacy')} icon="privacy" />
      {formError ? <InlineMessage tone="error" message={formError} /> : null}
      <Button label={submitLabel} size="kid" fullWidth loading={busy} disabled={busy} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  avatarChoice: { borderRadius: radius.full, borderWidth: 3, padding: 3 },
});
