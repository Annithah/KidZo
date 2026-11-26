import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { ageRangeLabel, localize, type ContentSummary, type Locale } from '@kidzo/shared';
import { CONTENT_TYPE_WORLD, categoryFor } from '@kidzo/ui-tokens';
import { useT } from '../i18n';
import { motion, palette, radius, shadow, spacing, useTheme, type ColorName } from '../theme/core';
import { Art } from './art/Art';
import { Avatar, avatarWorld } from './art/Avatar';
import { Icon } from './icon/Icon';
import { API_URL } from '../lib/config';
import { resolveMediaUrl } from '../lib/media-url';
import { Text } from './Typography';

export { Avatar, avatarWorld };

export function StarCounter({ stars }: { stars: number }) {
  return (
    <View style={[styles.stars, shadow(1, palette.star[700])]} accessible accessibilityLabel={`${stars} stars`}>
      <Icon name="star" weight="fill" size={20} color={palette.star[700]} />
      <Text variant="bodyBold" color={palette.navy[500]}>
        {stars}
      </Text>
    </View>
  );
}

/** World color for a content item, from its category. */
export function contentWorld(item: Pick<ContentSummary, 'type' | 'calm' | 'skills'>): ColorName {
  const cat = categoryFor(item);
  return (cat.world === 'lavender' ? 'grape' : cat.world) as ColorName;
}

/** Layered paper card: art cover on its world tint, title, length and ages, offline badge. */
export function ContentCard({
  item,
  locale,
  onPress,
  downloaded,
  wide,
  big,
}: {
  item: ContentSummary;
  locale: Locale;
  onPress: () => void;
  downloaded?: boolean;
  wide?: boolean;
  /** Huge tile for ages 2 to 5. */
  big?: boolean;
}) {
  const theme = useTheme();
  const { t } = useT();
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const title = localize(item.title, locale);
  const world = (CONTENT_TYPE_WORLD[item.type] ?? contentWorld(item)) as ColorName;
  const cover = theme.isCalm ? theme.surfaceRaised : palette[world][100];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${t('common.minutes', { count: item.durationMinutes })}${downloaded ? `, ${t('detail.downloaded')}` : ''}`}
      onPress={onPress}
      onPressIn={() => {
        scale.value = reduce ? 0.97 : withSpring(0.96, motion.spring.pop);
      }}
      onPressOut={() => {
        scale.value = reduce ? 1 : withSpring(1, motion.spring.pop);
      }}
      style={wide ? styles.cardWide : big ? styles.cardBig : styles.cardNarrow}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {!theme.isCalm ? <View style={[styles.sheet, { backgroundColor: palette[world][200] }]} /> : null}
        <View style={[styles.card, { backgroundColor: theme.surface }, shadow(2, palette[world][700], theme), theme.isCalm && { borderWidth: 1, borderColor: theme.line }]}>
          <View style={[styles.cover, { backgroundColor: cover, height: big ? 160 : 118 }]}>
            {item.thumbnailUrl ? (
              <>
                <Image source={{ uri: resolveMediaUrl(item.thumbnailUrl, API_URL) }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
                <View style={[styles.playBadge, { backgroundColor: palette.paper[500] }]}>
                  <Icon name="play" size={20} color={palette.coral[500]} />
                </View>
              </>
            ) : (
              <Art art={item.coverArt} size={big ? 130 : 96} />
            )}
            {downloaded ? (
              <View style={styles.badge}>
                <Icon name="check" size={14} color={palette.navy[500]} />
              </View>
            ) : null}
          </View>
          <View style={styles.cardBody}>
            <Text variant={big ? 'h3' : 'bodyBold'} numberOfLines={2}>
              {title}
            </Text>
            <View style={styles.meta}>
              <Icon name="timer" size={14} color={theme.textMuted} />
              <Text variant="caption" muted>
                {t('common.minutes', { count: item.durationMinutes })} · {ageRangeLabel(item.ageMin, item.ageMax)}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stars: { backgroundColor: palette.star[200], borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardNarrow: { width: 172 },
  cardWide: { flex: 1 },
  cardBig: { width: '100%' },
  sheet: { position: 'absolute', left: 8, right: 8, top: 8, bottom: -5, borderRadius: radius.lg, transform: [{ rotate: '1.5deg' }] },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  cover: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  playBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', opacity: 0.92 },
  badge: { position: 'absolute', top: 8, right: 8, backgroundColor: palette.mint[300], borderRadius: radius.full, width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: palette.paper[500] },
  cardBody: { padding: spacing.sm, gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
