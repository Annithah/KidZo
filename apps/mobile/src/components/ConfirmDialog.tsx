import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { alpha, palette, radius, shadow, spacing, useTheme } from '../theme/core';
import { Art } from './art/Art';
import { Button } from './Button';
import { Text } from './Typography';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  art?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Branded confirmation dialog for exits and deletions, the same on iOS, Android and web. */
export function ConfirmDialog({ visible, title, message, confirmLabel, cancelLabel, destructive, art = 'zo.thinking', onConfirm, onCancel }: Props) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} accessibilityViewIsModal>
      <Pressable style={[styles.scrim, { backgroundColor: alpha(palette.navy[800], 0.55) }]} onPress={onCancel} accessibilityLabel={cancelLabel} accessibilityRole="button">
        <Animated.View entering={ZoomIn.springify()} style={[styles.card, { backgroundColor: theme.surface }, shadow(3, undefined, theme)]} onStartShouldSetResponder={() => true}>
          <Art art={art} size={96} />
          <Text variant="h2" align="center" accessibilityRole="header">
            {title}
          </Text>
          <Text muted align="center">
            {message}
          </Text>
          <View style={styles.actions}>
            <Button label={confirmLabel} variant={destructive ? 'danger' : 'primary'} fullWidth onPress={onConfirm} />
            <Button label={cancelLabel} variant="secondary" fullWidth onPress={onCancel} />
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 400, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
});
