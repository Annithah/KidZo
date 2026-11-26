import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, shadow, spacing, useTheme } from '../theme/core';
import { Icon } from './icon/Icon';
import { Text } from './Typography';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

/** Four dot PIN entry with a large keypad. */
export function PinPad({ value, onChange, length = 4, disabled }: { value: string; onChange: (v: string) => void; length?: number; disabled?: boolean }) {
  const theme = useTheme();
  const press = (key: string) => {
    if (disabled) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    if (key === 'del') onChange(value.slice(0, -1));
    else if (value.length < length) onChange(value + key);
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.dots} accessible accessibilityLabel={`${value.length} of ${length} digits entered`} accessibilityLiveRegion="polite">
        {Array.from({ length }, (_, i) => (
          <View key={i} style={[styles.dot, { borderColor: theme.text }, i < value.length && { backgroundColor: palette.coral[500], borderColor: palette.coral[700] }]} />
        ))}
      </View>
      <View style={styles.grid}>
        {KEYS.map((key, i) =>
          key === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={key === 'del' ? 'Delete' : key}
              onPress={() => press(key)}
              style={({ pressed }) => [styles.key, styles.keyFace, { backgroundColor: pressed ? palette.sky[50] : theme.surface, borderColor: theme.line }, shadow(1, undefined, theme)]}
            >
              {key === 'del' ? <Icon name="backspace" size={28} color={theme.text} /> : <Text variant="h1">{key}</Text>}
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.lg },
  dots: { flexDirection: 'row', gap: spacing.md },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 3 * 80 + 2 * 16, gap: 16 },
  key: { width: 80, height: 72 },
  keyFace: { borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
});
