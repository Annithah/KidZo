import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { ApiError } from '@kidzo/shared';
import { useT } from '../i18n';
import { useIsOnline } from '../lib/offline';
import { palette, radius, spacing, useTheme } from '../theme/core';
import { Art } from './art/Art';
import { Button } from './Button';
import { Icon, type IconName } from './icon/Icon';
import { Text } from './Typography';

/** Spinning swoosh from the logo, used as the loader everywhere. */
export function SwooshLoader({ size = 56 }: { size?: number }) {
  const reduce = useReducedMotion();
  const r = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    r.value = withRepeat(withTiming(360, { duration: 1100, easing: Easing.linear }), -1);
  }, [r, reduce]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <Art art="motif.swoosh" size={size} />
    </Animated.View>
  );
}

export function LoadingView({ label }: { label?: string }) {
  const theme = useTheme();
  const { t } = useT();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label ?? t('common.loading')}>
      <Art art={theme.isCalm ? 'zo.sleepy' : 'zo.happy'} size={96} />
      <SwooshLoader />
    </View>
  );
}

export function errorMessage(error: unknown, t: ReturnType<typeof useT>['t']): string {
  if (error instanceof ApiError) {
    if (error.isNetwork) return t('error.network');
    return error.message;
  }
  return t('error.generic');
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useT();
  const offline = error instanceof ApiError && error.isNetwork;
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Art art={offline ? 'scene.offline' : 'scene.error'} size={180} />
      <Text variant="h3" align="center">
        {t('common.error')}
      </Text>
      <Text muted align="center">
        {errorMessage(error, t)}
      </Text>
      {onRetry ? <Button label={t('common.retry')} icon="sync" onPress={onRetry} variant="sky" /> : null}
    </View>
  );
}

export function EmptyView({ message, action, art = 'scene.empty' }: { message: string; action?: React.ReactNode; art?: string }) {
  return (
    <View style={styles.center}>
      <Art art={art} size={180} />
      <Text variant="h3" align="center">
        {message}
      </Text>
      {action}
    </View>
  );
}

export function OfflineBanner() {
  const online = useIsOnline();
  const { t } = useT();
  if (online) return null;
  return (
    <View style={[styles.banner, { backgroundColor: palette.star[100], borderColor: palette.star[300] }]} accessibilityRole="alert">
      <Icon name="offline" size={20} color={palette.navy[500]} accent={palette.star[400]} />
      <Text variant="caption" color={palette.navy[500]} style={{ flex: 1 }}>
        {t('common.offline')}
      </Text>
    </View>
  );
}

const TONE_ICON: Record<'info' | 'error' | 'success', IconName> = { info: 'info', error: 'warning', success: 'checkCircle' };

/** Inline notice with icon and color, never color alone. */
export function InlineMessage({ tone = 'info', message, icon }: { tone?: 'info' | 'error' | 'success'; message: string; icon?: IconName }) {
  const theme = useTheme();
  const bg = tone === 'error' ? theme.errorSurface : tone === 'success' ? theme.successSurface : theme.infoSurface;
  const fg = tone === 'error' ? theme.errorText : tone === 'success' ? theme.successText : theme.infoText;
  return (
    <View style={[styles.inline, { backgroundColor: bg }]} accessibilityRole={tone === 'error' ? 'alert' : 'text'} accessibilityLiveRegion="polite">
      <Icon name={icon ?? TONE_ICON[tone]} size={20} color={fg} />
      <Text variant="small" color={fg} style={{ flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, minHeight: 320 },
  banner: { borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1.5 },
  inline: { borderRadius: radius.md, padding: spacing.sm, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
});
