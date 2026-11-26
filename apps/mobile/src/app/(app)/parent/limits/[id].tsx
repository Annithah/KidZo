import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { parseTimeOfDay, type CategoryKey, type ChildSettings } from '@kidzo/shared';
import { CATEGORIES } from '@kidzo/ui-tokens';
import { Button } from '../../../../components/Button';
import { Stepper, ToggleRow } from '../../../../components/Controls';
import { Card, Header, Row, Screen } from '../../../../components/Layout';
import { ErrorView, InlineMessage, errorMessage } from '../../../../components/States';
import { Text } from '../../../../components/Typography';
import { Zo } from '../../../../components/Zo';
import { useT } from '../../../../i18n';
import { api } from '../../../../lib/api';
import { childrenQueryKey, useFamily } from '../../../../lib/family';
import { palette, radius, spacing, themes } from '../../../../theme/core';

const LIMIT_STEPS: (number | null)[] = [10, 15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240, null];

const shiftTime = (value: string, deltaMinutes: number): string => {
  const total = (parseTimeOfDay(value) + deltaMinutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const displayTime = (value: string): string => {
  const [h = 0, m = 0] = value.split(':').map(Number);
  return new Date(2026, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export default function LimitsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const queryClient = useQueryClient();
  const { children } = useFamily();
  const child = children.find((c) => c.id === id);
  const [edits, setEdits] = useState<ChildSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const draft = edits ?? child?.settings ?? null;

  const save = useMutation({
    mutationFn: (settings: ChildSettings) => {
      const { lockedUntil: _ignored, ...rest } = settings;
      return api.updateSettings(id ?? '', rest);
    },
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: childrenQueryKey });
      // Blocked categories change what the child sees.
      void queryClient.invalidateQueries({ queryKey: ['catalog', id] });
      void queryClient.invalidateQueries({ queryKey: ['recommendations', id] });
    },
  });

  if (!child || !draft) {
    return (
      <Screen scroll={false}>
        <Header backLabel={t('common.back')} />
        <ErrorView error={new Error('Not found')} onRetry={() => router.back()} />
      </Screen>
    );
  }

  const update = (patch: Partial<ChildSettings>) => {
    setSaved(false);
    setEdits({ ...draft, ...patch });
  };
  const limitIndex = Math.max(0, LIMIT_STEPS.indexOf(draft.dailyLimitMinutes));

  return (
    <Screen
      footer={
        <Button
          label={t('common.save')}
          icon="check"
          size="kid"
          fullWidth
          loading={save.isPending}
          onPress={() => save.mutate(draft)}
        />
      }
    >
      <Header title={t('limits.title')} backLabel={t('common.back')} />

      <Card>
        <Text variant="kicker" muted>
          {t('limits.dailyLimit')}
        </Text>
        <Stepper
          label={t('limits.dailyLimit')}
          valueLabel={draft.dailyLimitMinutes === null ? t('limits.noLimit') : t('limits.perDay', { minutes: draft.dailyLimitMinutes })}
          onDecrease={() => update({ dailyLimitMinutes: LIMIT_STEPS[limitIndex - 1] ?? 10 })}
          onIncrease={() => update({ dailyLimitMinutes: LIMIT_STEPS[limitIndex + 1] ?? null })}
          canDecrease={limitIndex > 0}
          canIncrease={limitIndex < LIMIT_STEPS.length - 1}
        />
        <Text variant="small" muted style={{ marginTop: spacing.sm }}>
          {t('limits.headsUp', { name: child.name })}
        </Text>
        <Stepper
          label={t('limits.warning', { minutes: draft.warningMinutes })}
          valueLabel={t('limits.warning', { minutes: draft.warningMinutes })}
          onDecrease={() => update({ warningMinutes: Math.max(1, draft.warningMinutes - 1) })}
          onIncrease={() => update({ warningMinutes: Math.min(15, draft.warningMinutes + 1) })}
          canDecrease={draft.warningMinutes > 1}
          canIncrease={draft.warningMinutes < 15}
        />
      </Card>

      <Card>
        <ToggleRow
          icon="bedtime"
          title={t('limits.gentleEvenings')}
          subtitle={t('limits.gentleEveningsHint')}
          value={draft.bedtimeEnabled}
          onChange={(v) => update({ bedtimeEnabled: v })}
        />
        {draft.bedtimeEnabled ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Text variant="kicker" muted>
              {t('limits.schedule')}
            </Text>
            <Text variant="bodyBold">{t('limits.starts')}</Text>
            <Stepper
              label={t('limits.starts')}
              valueLabel={displayTime(draft.bedtimeStart)}
              onDecrease={() => update({ bedtimeStart: shiftTime(draft.bedtimeStart, -15) })}
              onIncrease={() => update({ bedtimeStart: shiftTime(draft.bedtimeStart, 15) })}
            />
            <Text variant="bodyBold">{t('limits.ends')}</Text>
            <Stepper
              label={t('limits.ends')}
              valueLabel={displayTime(draft.bedtimeEnd)}
              onDecrease={() => update({ bedtimeEnd: shiftTime(draft.bedtimeEnd, -15) })}
              onIncrease={() => update({ bedtimeEnd: shiftTime(draft.bedtimeEnd, 15) })}
            />
          </View>
        ) : null}
      </Card>

      {draft.bedtimeEnabled ? (
        <View style={styles.preview}>
          <Text variant="kicker" color={themes.bedtime.accentText}>
            {t('limits.preview')}
          </Text>
          <Row>
            <Zo size={72} mood="sleepy" bounce={false} />
            <View style={{ flex: 1 }}>
              <Text variant="h3" color={themes.bedtime.text}>
                {t('limits.calmPreviewTitle', { name: child.name })}
              </Text>
              <Text variant="small" color={themes.bedtime.textMuted}>
                {t('limits.calmPreviewBody', { time: displayTime(draft.bedtimeEnd) })}
              </Text>
            </View>
          </Row>
        </View>
      ) : null}

      <Card>
        <ToggleRow
          icon="readAloud"
          world="sky"
          title={t('limits.narration')}
          subtitle={t('limits.narrationHint')}
          value={draft.narrationEnabled}
          onChange={(v) => update({ narrationEnabled: v })}
        />
        <Text variant="bodyBold" style={{ marginTop: spacing.sm }}>
          {t('limits.volume')}
        </Text>
        <Text variant="small" muted>
          {t('limits.volumeHint')}
        </Text>
        <Stepper
          label={t('limits.volume')}
          valueLabel={`${Math.round(draft.soundEffectsVolume * 100)}%`}
          onDecrease={() => update({ soundEffectsVolume: Math.max(0, Math.round((draft.soundEffectsVolume - 0.2) * 10) / 10) })}
          onIncrease={() => update({ soundEffectsVolume: Math.min(1, Math.round((draft.soundEffectsVolume + 0.2) * 10) / 10) })}
          canDecrease={draft.soundEffectsVolume > 0}
          canIncrease={draft.soundEffectsVolume < 1}
        />
      </Card>

      <Card>
        <Text variant="kicker" muted>
          {t('limits.feedback')}
        </Text>
        <Text variant="small" muted>
          {t('limits.feedbackHint')}
        </Text>
        <Stepper
          label={t('limits.feedback')}
          valueLabel={t('limits.feedbackSeconds', { seconds: draft.feedbackSeconds })}
          onDecrease={() => update({ feedbackSeconds: draft.feedbackSeconds === 8 ? 5 : 3 })}
          onIncrease={() => update({ feedbackSeconds: draft.feedbackSeconds === 3 ? 5 : 8 })}
          canDecrease={draft.feedbackSeconds > 3}
          canIncrease={draft.feedbackSeconds < 8}
        />
      </Card>

      <Card>
        <Text variant="kicker" muted>
          {t('limits.categories', { name: child.name.toUpperCase() })}
        </Text>
        <Text variant="small" muted>
          {t('limits.categoriesHint', { name: child.name })}
        </Text>
        {CATEGORIES.map((c) => {
          const key = c.key as CategoryKey;
          const on = !draft.blockedCategories.includes(key);
          return (
            <ToggleRow
              key={c.key}
              art={c.art}
              world={c.world}
              title={t(`category.${c.key}`)}
              subtitle={on ? t('limits.categoryOn') : t('limits.categoryOff')}
              value={on}
              onChange={(v) =>
                update({ blockedCategories: v ? draft.blockedCategories.filter((b) => b !== key) : [...draft.blockedCategories, key] })
              }
            />
          );
        })}
      </Card>

      {saved ? <InlineMessage tone="success" message={`${t('common.saved')} ${t('limits.settingsSaved', { name: child.name })}`} /> : null}
      {save.error ? <InlineMessage tone="error" message={errorMessage(save.error, t)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { backgroundColor: themes.bedtime.background, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs, borderWidth: 2, borderColor: palette.lavender[500] },
});
