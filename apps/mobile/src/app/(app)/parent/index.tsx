import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { explorerTitle, localParts, type Child } from '@kidzo/shared';
import { Button } from '../../../components/Button';
import { ProgressBar } from '../../../components/Controls';
import { Avatar, avatarColor } from '../../../components/Kid';
import { Card, Row, Screen, SectionTitle } from '../../../components/Layout';
import { EmptyView, ErrorView, InlineMessage, LoadingView, OfflineBanner, errorMessage } from '../../../components/States';
import { Text } from '../../../components/Typography';
import { useT } from '../../../i18n';
import { api } from '../../../lib/api';
import { childrenQueryKey, useFamily } from '../../../lib/family';
import { useParentGate } from '../../../lib/parent-gate';
import { useInsights, useNow, useTimezone, useToday } from '../../../lib/queries';
import { useSession } from '../../../lib/session';
import { colors, radii, spacing } from '../../../theme';

export default function ControlCenter() {
  const { t } = useT();
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
          <Text variant="kicker" color={colors.coral}>
            {t('parent.kicker')}
          </Text>
          <Text variant="h1">{t(greetingKey, { name: user?.displayName ?? '' })}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('parent.account')} onPress={() => router.push('/parent/account')} style={styles.initials}>
          <Text variant="bodyBold" color={colors.white}>
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
        <EmptyView message={t('parent.noChildren')} action={<Button label={t('profiles.add')} onPress={() => router.push('/parent/child/new')} />} />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kids}>
            {children.map((c, i) => (
              <Pressable
                key={c.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: c.id === child.id }}
                accessibilityLabel={c.name}
                onPress={() => setSelectedId(c.id)}
                style={[styles.kidChip, c.id === child.id && styles.kidChipOn]}
              >
                <Avatar avatar={c.avatar} size={40} color={avatarColor(i)} />
                <View>
                  <Text variant="bodyBold">{c.name}</Text>
                  <Text variant="caption" muted>
                    {explorerTitle(c.age)} · {c.age}
                  </Text>
                </View>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel={t('parent.addChild')} onPress={() => router.push('/parent/child/new')} style={styles.addKid}>
              <Text variant="h2" muted>
                +
              </Text>
            </Pressable>
          </ScrollView>
          <ChildDashboard child={child} />
        </>
      )}

      <Button label={`← ${t('parent.backToKids')}`} variant="navy" fullWidth onPress={backToKids} />
    </Screen>
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
  const balance =
    limit === null ? t('parent.balanceUnlimited') : ratio >= 1 ? t('parent.balanceDone') : ratio >= 0.8 ? t('parent.balanceNear') : t('parent.balanceGood');
  const highlight = insights.data?.highlight;
  const week = insights.data?.dailyMinutes ?? [];
  const maxDay = Math.max(1, ...week.map((d) => d.minutes));
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
            <ProgressBar value={ratio} color={ratio >= 1 ? colors.coral : colors.mint} />
          </View>
        ) : null}
        <Row style={{ marginTop: spacing.md }} gap={spacing.md}>
          <View style={[styles.stat, { backgroundColor: colors.skyTint }]}>
            <Text variant="h1">{today.data?.adventuresCompleted ?? 0}</Text>
            <Text variant="caption" muted>
              {t('parent.adventures')}
            </Text>
          </View>
          <View style={[styles.stat, { backgroundColor: '#FFF3C4' }]}>
            <Text variant="h1">{today.data?.starsEarnedToday ?? 0}</Text>
            <Text variant="caption" muted>
              {t('parent.starsEarned')}
            </Text>
          </View>
        </Row>
      </Card>

      <SectionTitle title={t('parent.quickActions')} />
      <View style={styles.actions}>
        <ActionTile emoji="📥" label={t('parent.downloadContent')} color={colors.skyTint} onPress={() => router.push('/parent/downloads')} />
        <ActionTile emoji="🌙" label={t('parent.bedtimeMode')} color="#EEE8FF" onPress={() => router.push({ pathname: '/parent/limits/[id]', params: { id: child.id } })} />
        <ActionTile
          emoji={locked ? '🔓' : '🔒'}
          label={locked ? t('parent.unlock') : t('parent.lockNow')}
          sublabel={locked ? t('parent.lockedUntil', { time: lockTime }) : t('parent.lockNowHint', { name: child.name })}
          color={colors.coralTint}
          onPress={() => lockMutation.mutate()}
        />
        <ActionTile emoji="✏️" label={t('parent.editProfile')} color="#E3F9EF" onPress={() => router.push({ pathname: '/parent/child/[id]', params: { id: child.id } })} />
      </View>
      {lockMutation.error ? <InlineMessage tone="error" message={errorMessage(lockMutation.error, t)} /> : null}

      <Card>
        <Text variant="kicker" muted>
          {t('parent.thisWeek')}
        </Text>
        {insights.isLoading ? (
          <Text muted>{t('common.loading')}</Text>
        ) : highlight ? (
          <>
            <Text variant="h2">🌱 {t('parent.skillBlooming', { skill: t(`skill.${highlight.skill}` as 'skill.calm') })}</Text>
            <Text muted>{t('parent.skillPracticed', { name: child.name, count: highlight.count })}</Text>
          </>
        ) : (
          <Text muted>{t('parent.noActivity')}</Text>
        )}
        {week.length > 0 ? (
          <View style={styles.chart} accessibilityLabel={t('parent.weekMinutes', { minutes: Math.round((insights.data?.totalSeconds ?? 0) / 60) })}>
            {week.map((d) => (
              <View key={d.date} style={styles.barCol}>
                <View style={[styles.bar, { height: 8 + (72 * d.minutes) / maxDay }]} />
                <Text variant="caption" muted>
                  {new Date(`${d.date}T12:00:00`).toLocaleDateString([], { weekday: 'narrow' })}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text variant="caption" muted>
          {t('parent.weekMinutes', { minutes: Math.round((insights.data?.totalSeconds ?? 0) / 60) })}
        </Text>
      </Card>
    </>
  );
}

function ActionTile({ emoji, label, sublabel, color, onPress }: { emoji: string; label: string; sublabel?: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={sublabel}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: color, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <Text style={{ fontSize: 30, lineHeight: 38 }}>{emoji}</Text>
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
  initials: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  kids: { gap: spacing.sm, paddingVertical: 4 },
  kidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: spacing.md,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  kidChipOn: { borderColor: colors.navy },
  addKid: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderStyle: 'dashed', borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  stat: { flex: 1, borderRadius: radii.md, padding: spacing.sm, alignItems: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '48%', flexGrow: 1, minHeight: 120, borderRadius: radii.lg, padding: spacing.md, gap: 4 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 110, marginTop: spacing.md },
  barCol: { alignItems: 'center', gap: 4, flex: 1 },
  bar: { width: 18, borderRadius: 9, backgroundColor: colors.lavender },
});
