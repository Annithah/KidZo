import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { ToggleRow } from '../../components/Controls';
import { Avatar, avatarColor } from '../../components/Kid';
import { Card, Row, Screen } from '../../components/Layout';
import { EmptyView, ErrorView, LoadingView, OfflineBanner } from '../../components/States';
import { Text } from '../../components/Typography';
import { Zo } from '../../components/Zo';
import { useT } from '../../i18n';
import { useFamily } from '../../lib/family';
import { colors, radii, softShadow, spacing } from '../../theme';

const logo = require('../../../assets/images/logo.png');

/** "Who's playing?" profile picker. */
export default function WhoIsPlaying() {
  const { t } = useT();
  const { children, selectChild, familyMode, setFamilyMode, isLoading, error, refetch } = useFamily();

  const header = (
    <Row style={styles.header}>
      <Image source={logo} style={styles.logo} contentFit="contain" accessibilityLabel="KIDZO" />
      <View style={{ flex: 1 }} />
      <Button label={`🔒 ${t('profiles.parentArea')}`} size="sm" variant="secondary" onPress={() => router.push('/parent')} />
    </Row>
  );

  if (isLoading) return <Screen scroll={false}>{header}<LoadingView /></Screen>;
  if (error && children.length === 0) {
    return (
      <Screen scroll={false}>
        {header}
        <ErrorView error={error} onRetry={refetch} />
      </Screen>
    );
  }

  if (children.length === 0) {
    return (
      <Screen scroll={false}>
        {header}
        <EmptyView
          message={t('profiles.empty')}
          action={<Button label={t('profiles.add')} size="kid" onPress={() => router.push('/parent/child/new')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      <OfflineBanner />
      <View style={styles.titleBlock}>
        <Zo size={84} />
        <Text variant="display" align="center">
          {t('profiles.title')}
        </Text>
        <Text muted align="center">
          {t('profiles.subtitle')}
        </Text>
      </View>

      <View style={styles.grid}>
        {children.map((child, i) => (
          <Pressable
            key={child.id}
            accessibilityRole="button"
            accessibilityLabel={child.name}
            onPress={() => {
              selectChild(child.id);
              router.push('/kid/home');
            }}
            style={({ pressed }) => [styles.profile, softShadow(3), { transform: [{ scale: pressed ? 0.96 : 1 }] }]}
          >
            <Avatar avatar={child.avatar} size={84} color={avatarColor(i)} />
            <Text variant="h3" numberOfLines={1}>
              {child.name}
            </Text>
            <Text variant="caption" muted>
              ⭐ {child.stars}
            </Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profiles.add')}
          onPress={() => router.push('/parent/child/new')}
          style={[styles.profile, styles.addProfile]}
        >
          <View style={styles.plus}>
            <Text variant="display" color={colors.inkSubtle}>
              +
            </Text>
          </View>
          <Text variant="bodyBold" muted>
            {t('profiles.add')}
          </Text>
        </Pressable>
      </View>

      <Card>
        <ToggleRow
          icon="👨‍👩‍👧"
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
  header: { minHeight: 48 },
  logo: { width: 110, height: 52 },
  titleBlock: { alignItems: 'center', gap: spacing.xs, marginVertical: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  profile: {
    width: 150,
    minHeight: 170,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: spacing.md,
  },
  addProfile: { backgroundColor: 'transparent', borderWidth: 3, borderStyle: 'dashed', borderColor: colors.line },
  plus: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
});
