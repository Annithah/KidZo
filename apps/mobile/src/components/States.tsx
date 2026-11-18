import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useT } from '../i18n';
import { ApiError } from '@kidzo/shared';
import { useIsOnline } from '../lib/offline';
import { colors, radii, spacing, usePalette } from '../theme';
import { Button } from './Button';
import { Text } from './Typography';
import { Zo } from './Zo';

export function LoadingView({ label }: { label?: string }) {
  const palette = usePalette();
  const { t } = useT();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label ?? t('common.loading')}>
      <Zo size={88} mood={palette.isCalm ? 'sleepy' : 'happy'} />
      <ActivityIndicator color={palette.accent} size="large" />
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
  return (
    <View style={styles.center}>
      <Zo size={88} mood="sleepy" bounce={false} />
      <Text variant="h3" align="center">
        {t('common.error')}
      </Text>
      <Text muted align="center">
        {errorMessage(error, t)}
      </Text>
      {onRetry ? <Button label={t('common.retry')} onPress={onRetry} variant="sky" /> : null}
    </View>
  );
}

export function EmptyView({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <View style={styles.center}>
      <Zo size={88} />
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
    <View style={styles.banner} accessibilityRole="alert">
      <Text variant="caption" color={colors.navy}>
        📡 {t('common.offline')}
      </Text>
    </View>
  );
}

export function InlineMessage({ tone = 'info', message }: { tone?: 'info' | 'error' | 'success'; message: string }) {
  const bg = tone === 'error' ? '#FFE4E5' : tone === 'success' ? '#DDF7EA' : colors.skyTint;
  const fg = tone === 'error' ? colors.error : tone === 'success' ? '#1E8A59' : colors.navy;
  return (
    <View style={[styles.inline, { backgroundColor: bg }]} accessibilityRole={tone === 'error' ? 'alert' : 'text'}>
      <Text variant="small" color={fg}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, minHeight: 320 },
  banner: { backgroundColor: colors.starYellow, borderRadius: radii.md, paddingVertical: 8, paddingHorizontal: 14 },
  inline: { borderRadius: radii.sm, padding: spacing.sm },
});
