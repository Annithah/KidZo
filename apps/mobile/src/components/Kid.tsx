import { Pressable, StyleSheet, View } from 'react-native';
import {
  AVATAR_EMOJI,
  accentColors,
  ageRangeLabel,
  localize,
  type Avatar as AvatarName,
  type ContentSummary,
  type Locale,
} from '@kidzo/shared';
import { useT } from '../i18n';
import { colors, radii, softShadow, spacing, usePalette } from '../theme';
import { Text } from './Typography';

export function avatarColor(index: number): string {
  return accentColors[index % accentColors.length] ?? colors.coral;
}

export function Avatar({ avatar, size = 72, color = colors.coral }: { avatar: AvatarName; size?: number; color?: string }) {
  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{AVATAR_EMOJI[avatar]}</Text>
    </View>
  );
}

export function StarCounter({ stars }: { stars: number }) {
  return (
    <View style={styles.stars} accessibilityLabel={`${stars} stars`}>
      <Text variant="bodyBold">⭐ {stars}</Text>
    </View>
  );
}

/** Content tile: colored cover with emoji, title, duration, age range and an offline badge. */
export function ContentCard({
  item,
  locale,
  onPress,
  downloaded,
  wide,
}: {
  item: ContentSummary;
  locale: Locale;
  onPress: () => void;
  downloaded?: boolean;
  wide?: boolean;
}) {
  const palette = usePalette();
  const { t } = useT();
  const title = localize(item.title, locale);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${t('common.minutes', { count: item.durationMinutes })}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        wide ? styles.cardWide : styles.cardNarrow,
        { backgroundColor: palette.surface, transform: [{ scale: pressed ? 0.97 : 1 }] },
        !palette.isCalm && softShadow(3),
      ]}
    >
      <View style={[styles.cover, { backgroundColor: item.coverColor }]}>
        <Text style={styles.coverEmoji}>{item.coverEmoji}</Text>
        {downloaded ? (
          <View style={styles.badge}>
            <Text variant="caption" color={colors.navy}>
              ✓
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text variant="bodyBold" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="caption" muted>
          {t('common.minutes', { count: item.durationMinutes })} · {ageRangeLabel(item.ageMin, item.ageMax)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  stars: { backgroundColor: colors.starYellow, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 6 },
  card: { borderRadius: radii.lg, overflow: 'hidden' },
  cardNarrow: { width: 168 },
  cardWide: { flex: 1 },
  cover: { height: 112, alignItems: 'center', justifyContent: 'center' },
  coverEmoji: { fontSize: 56, lineHeight: 68 },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.mint,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: spacing.sm, gap: 4 },
});
