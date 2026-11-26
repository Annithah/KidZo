import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { explorerTitle } from '@kidzo/shared';
import { Button } from '../../components/Button';
import { ToggleRow } from '../../components/Controls';
import { Icon } from '../../components/icon/Icon';
import { Avatar, avatarWorld } from '../../components/Kid';
import { Card, Row, Screen } from '../../components/Layout';
import { EmptyView, ErrorView, LoadingView, OfflineBanner } from '../../components/States';
import { Text } from '../../components/Typography';
import { Zo } from '../../components/Zo';
import { useT } from '../../i18n';
import { useFamily } from '../../lib/family';
import { palette, radius, shadow, spacing, useTheme } from '../../theme/core';

const logo = require('../../../assets/images/logo.png');

/** "Who's playing?" profile picker. */
export default function WhoIsPlaying() {
  const { t } = useT();
  const theme = useTheme();
  const { children, selectChild, familyMode, setFamilyMode, isLoading, error, refetch } = useFamily();

  const header = (
    <Row style={styles.header}>
      <Image source={logo} style={styles.logo} contentFit="contain" accessibilityLabel="KIDZO" />
      <View style={{ flex: 1 }} />
      <Button label={t('profiles.parentArea')} icon="parent" size="sm" variant="secondary" onPress={() => router.push('/parent')} />
    </Row>
  );

  if (isLoading) return <Screen world scroll={false}>{header}<LoadingView /></Screen>;
  if (error && children.length === 0) {
    return (
      <Screen world scroll={false}>
        {header}
        <ErrorView error={error} onRetry={refetch} />
      </Screen>
    );
  }

  if (children.length === 0) {
    return (
      <Screen world scroll={false}>
        {header}
        <EmptyView message={t('profiles.empty')} action={<Button label={t('profiles.add')} icon="plus" size="kid" onPress={() => router.push('/parent/child/new')} />} />
      </Screen>
    );
  }

  return (
    <Screen world>
      {header}
      <OfflineBanner />
      <View style={styles.titleBlock}>
        <Zo size={96} mood="waving" />
        <Text variant="display" align="center" accessibilityRole="header">
          {t('profiles.title')}
        </Text>
        <Text muted align="center">
          {t('profiles.subtitle')}
        </Text>
      </View>

      <View style={styles.grid}>
        {children.map((child) => {
          const w = avatarWorld(child.avatar);
          return (
            <Pressable
              key={child.id}
              accessibilityRole="button"
              accessibilityLabel={`${child.name}, ${child.stars} stars`}
              onPress={() => {
                selectChild(child.id);
                router.push('/kid/home');
              }}
              style={({ pressed }) => [styles.profile, { backgroundColor: theme.surface, transform: [{ scale: pressed ? 0.96 : 1 }] }, shadow(2, palette[w][700], theme)]}
            >
              <View style={[styles.profileBand, { backgroundColor: palette[w][100] }]} />
              <Avatar avatar={child.avatar} size={92} />
              <Text variant="h3" numberOfLines={1}>
                {child.name}
              </Text>
              <Text variant="caption" muted>
                {explorerTitle(child.age)}
              </Text>
              <Row gap={4} style={[styles.starPill, { backgroundColor: palette.star[100] }]}>
                <Icon name="star" weight="fill" size={14} color={palette.star[700]} />
                <Text variant="caption" color={palette.navy[500]}>
                  {child.stars}
                </Text>
              </Row>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profiles.add')}
          onPress={() => router.push('/parent/child/new')}
          style={({ pressed }) => [styles.profile, styles.addProfile, { borderColor: theme.lineStrong, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
        >
          <View style={[styles.plus, { backgroundColor: theme.surface }]}>
            <Icon name="plus" size={36} color={theme.textMuted} />
          </View>
          <Text variant="bodyBold" muted>
            {t('profiles.add')}
          </Text>
        </Pressable>
      </View>

      <Card>
        <ToggleRow
          icon="familyMode"
          world="bubblegum"
          title={familyMode ? t('profiles.familyModeOn') : t('profiles.familyMode')}
          subtitle={t('profiles.familyModeHint')}
          value={familyMode}
          onChange={setFamilyMode}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 52 },
  logo: { width: 112, height: 52 },
  titleBlock: { alignItems: 'center', gap: spacing.xs, marginVertical: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  profile: { width: 156, minHeight: 200, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', gap: 4, padding: spacing.md, overflow: 'hidden' },
  profileBand: { position: 'absolute', top: 0, left: 0, right: 0, height: 72 },
  starPill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3, marginTop: 2 },
  addProfile: { backgroundColor: 'transparent', borderWidth: 3, borderStyle: 'dashed' },
  plus: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
});
