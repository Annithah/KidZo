import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { explorerTitle, localParts, type Child } from '@kidzo/shared';
import { BarChart } from '../../../components/BarChart';
import { Button } from '../../../components/Button';
import { ProgressBar } from '../../../components/Controls';
import { Icon, type IconName } from '../../../components/icon/Icon';
import { Avatar } from '../../../components/Kid';
import { Card, Row, Screen, SectionTitle } from '../../../components/Layout';
import { EmptyView, ErrorView, InlineMessage, LoadingView, OfflineBanner, errorMessage } from '../../../components/States';
import { Text } from '../../../components/Typography';
import { useT } from '../../../i18n';
import { api } from '../../../lib/api';
import { childrenQueryKey, useFamily } from '../../../lib/family';
import { useParentGate } from '../../../lib/parent-gate';
import { useInsights, useNow, useTimezone, useToday } from '../../../lib/queries';
import { useSession } from '../../../lib/session';
import { palette, radius, spacing, useTheme, type ColorName } from '../../../theme/core';

export default function ControlCenter() {
  const { t } = useT();
  const theme = useTheme();
  const { user } = useSession();
  const { lock } = useParentGate();
  const { children, isLoading, error, refetch } = useFamily();
  const timezone = useTimezone();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const child = children.find((c) => c.id === selectedId) ?? children[0] ?? null;
  const hour = Math.floor(localParts(new Date(), timezone).minuteOfDay / 60);
  const greetingKey = hour < 12 ? 'parent.goodMorning' : hour < 18 ? 'parent.goodAfternoon' : 'parent.goodEvening';
  const initials = (user?.displayName ?? '?').slice(0, 2).toUpperCase();

  const backToKids = () => {
    lock();
    router.replace('/');
  };

  return (
    <Screen>
      <Row>
        <View style={{ flex: 1, gap: 2 }}>
          <Row gap={6}>
            <Icon name="parent" size={16} color={theme.accentText} />
            <Text variant="kicker" color={theme.accentText}>
              {t('parent.kicker')}
            </Text>
          </Row>
          <Text variant="h1">{t(greetingKey, { name: user?.displayName ?? '' })}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('parent.account')} onPress={() => router.push('/parent/account')} style={styles.initials}>
          <Text variant="bodyBold" color={palette.paper[500]}>
            {initials}
          </Text>
        </Pressable>
      </Row>
      <OfflineBanner />

      {isLoading ? (
        <LoadingView />
      ) : error && children.length === 0 ? (
        <ErrorView error={error} onRetry={refetch} />
      ) : !child ? (
        <EmptyView message={t('parent.noChildren')} action={<Button label={t('profiles.add')} icon="plus" onPress={() => router.push('/parent/child/new')} />} />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kids} accessibilityRole="tablist">
            {children.map((c) => {
              const on = c.id === child.id;
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={c.name}
                  onPress={() => setSelectedId(c.id)}
                  style={[styles.kidChip, { backgroundColor: theme.surface, borderColor: on ? palette.navy[500] : theme.line }]}
                >
                  <Avatar avatar={c.avatar} size={40} />
                  <View>
                    <Text variant="bodyBold">{c.name}</Text>
                    <Text variant="caption" muted>
                      {explorerTitle(c.age)} · {c.age}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <Pressable accessibilityRole="button" accessibilityLabel={t('parent.addChild')} onPress={() => router.push('/parent/child/new')} style={[styles.addKid, { borderColor: theme.lineStrong }]}>
              <Icon name="plus" size={22} color={theme.textMuted} />
            </Pressable>
          </ScrollView>
          <ChildDashboard child={child} />
        </>
      )}

      <Button label={t('parent.backToKids')} icon="back" variant="navy" fullWidth onPress={backToKids} />
    </Screen>
  );
}

function StatTile({ value, label, icon, world }: { value: number; label: string; icon: IconName; world: ColorName }) {
  return (
    <View style={[styles.stat, { backgroundColor: palette[world][50], borderColor: palette[world][100] }]}>
      <Icon name={icon} size={22} color={palette[world][800]} accent={palette[world][300]} />
      <Text variant="h1">{value}</Text>
      <Text variant="caption" muted>
        {label}
      </Text>
    </View>
  );
}

function ChildDashboard({ child }: { child: Child }) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const today = useToday(child);
  const insights = useInsights(child.id);
  const now = useNow();
  const locked = child.settings.lockedUntil !== null && new Date(child.settings.lockedUntil).getTime() > now;

  const lockMutation = useMutation({
    mutationFn: () => (locked ? api.unlockChild(child.id) : api.lockChild(child.id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: childrenQueryKey });
      void queryClient.invalidateQueries({ queryKey: ['today', child.id] });
    },
  });

  const played = Math.round((today.data?.secondsPlayed ?? 0) / 60);
  const limit = today.data?.dailyLimitMinutes ?? child.settings.dailyLimitMinutes;
  const ratio = limit ? played / limit : 0;
  const balance = limit === null ? t('parent.balanceUnlimited') : ratio >= 1 ? t('parent.balanceDone') : ratio >= 0.8 ? t('parent.balanceNear') : t('parent.balanceGood');
  const highlight = insights.data?.highlight;
  const week = insights.data?.dailyMinutes ?? [];
  const weekMinutes = Math.round((insights.data?.totalSeconds ?? 0) / 60);
  const lockTime = child.settings.lockedUntil ? new Date(child.settings.lockedUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

  return (
    <>
      <Card>
        <Text variant="kicker" muted>
          {t('parent.today')}
        </Text>
        <Text variant="h2">{balance}</Text>
        <Text variant="small" muted>
          {t('parent.minutesPlayed', { minutes: played })}
          {limit !== null ? ` / ${t('common.minutes', { count: limit })}` : ''}
        </Text>
        {limit !== null ? (
          <View style={{ marginTop: spacing.xs }}>
            <ProgressBar value={ratio} color={ratio >= 1 ? palette.coral[500] : palette.mint[500]} />
          </View>
        ) : null}
        <Row style={{ marginTop: spacing.md }} gap={spacing.sm}>
          <StatTile value={today.data?.adventuresCompleted ?? 0} label={t('parent.adventures')} icon="adventure" world="sky" />
          <StatTile value={today.data?.starsEarnedToday ?? 0} label={t('parent.starsEarned')} icon="star" world="star" />
        </Row>
      </Card>

      <SectionTitle title={t('parent.quickActions')} />
      <View style={styles.actions}>
        <ActionTile icon="downloads" world="sky" label={t('parent.downloadContent')} onPress={() => router.push('/parent/downloads')} />
        <ActionTile icon="bedtime" world="grape" label={t('parent.bedtimeMode')} onPress={() => router.push({ pathname: '/parent/limits/[id]', params: { id: child.id } })} />
        <ActionTile
          icon={locked ? 'unlock' : 'lock'}
          world="coral"
          label={locked ? t('parent.unlock') : t('parent.lockNow')}
          sublabel={locked ? t('parent.lockedUntil', { time: lockTime }) : t('parent.lockNowHint', { name: child.name })}
          busy={lockMutation.isPending}
          onPress={() => lockMutation.mutate()}
        />
        <ActionTile icon="edit" world="mint" label={t('parent.editProfile')} onPress={() => router.push({ pathname: '/parent/child/[id]', params: { id: child.id } })} />
      </View>
      {lockMutation.error ? <InlineMessage tone="error" message={errorMessage(lockMutation.error, t)} /> : null}

      <Card>
        <Row>
          <Text variant="kicker" muted style={{ flex: 1 }}>
            {t('parent.thisWeek')}
          </Text>
          <Text variant="caption" muted>
            {t('parent.weekMinutes', { minutes: weekMinutes })}
          </Text>
        </Row>
        {insights.isLoading ? (
          <Text muted>{t('common.loading')}</Text>
        ) : highlight ? (
          <Row style={{ marginTop: spacing.xs, alignItems: 'flex-start' }}>
            <View style={[styles.highlightIcon, { backgroundColor: palette.leaf[50] }]}>
              <Icon name="sparkle" size={24} color={palette.leaf[800]} accent={palette.leaf[300]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h3">{t('parent.skillBlooming', { skill: t(`skill.${highlight.skill}` as 'skill.calm') })}</Text>
              <Text variant="small" muted>
                {t('parent.skillPracticed', { name: child.name, count: highlight.count })}
              </Text>
            </View>
          </Row>
        ) : (
          <Text muted>{t('parent.noActivity')}</Text>
        )}
        {week.length > 0 ? (
          <View style={{ marginTop: spacing.md }}>
            <BarChart
              label={t('parent.weekMinutes', { minutes: weekMinutes })}
              data={week.map((d) => ({ label: new Date(`${d.date}T12:00:00`).toLocaleDateString([], { weekday: 'narrow' }), value: d.minutes }))}
            />
          </View>
        ) : null}
      </Card>
    </>
  );
}

function ActionTile({ icon, world, label, sublabel, busy, onPress }: { icon: IconName; world: ColorName; label: string; sublabel?: string; busy?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={sublabel}
      accessibilityState={{ busy: !!busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: theme.surface, borderColor: theme.line, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: palette[world][50] }]}>
        <Icon name={icon} size={26} color={palette[world][800]} accent={palette[world][300]} />
      </View>
      <Text variant="bodyBold">{label}</Text>
      {sublabel ? (
        <Text variant="caption" muted numberOfLines={2}>
          {sublabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  initials: { width: 48, height: 48, borderRadius: 24, backgroundColor: palette.navy[500], alignItems: 'center', justifyContent: 'center' },
  kids: { gap: spacing.sm, paddingVertical: 4 },
  kidChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.full, paddingVertical: 6, paddingLeft: 6, paddingRight: spacing.md, borderWidth: 2, minHeight: 56 },
  addKid: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  stat: { flex: 1, borderRadius: radius.md, padding: spacing.sm, alignItems: 'flex-start', gap: 2, borderWidth: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '48%', flexGrow: 1, minHeight: 128, borderRadius: radius.lg, padding: spacing.md, gap: 6, borderWidth: 1 },
  tileIcon: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  highlightIcon: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
