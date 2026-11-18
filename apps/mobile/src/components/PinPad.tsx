import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../theme';
import { Text } from './Typography';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/** Four dot PIN entry with a large keypad. */
export function PinPad({ value, onChange, length = 4, disabled }: { value: string; onChange: (v: string) => void; length?: number; disabled?: boolean }) {
  const press = (key: string) => {
    if (disabled) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    if (key === '⌫') onChange(value.slice(0, -1));
    else if (value.length < length) onChange(value + key);
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.dots} accessibilityLabel={`${value.length} of ${length} digits entered`}>
        {Array.from({ length }, (_, i) => (
          <View key={i} style={[styles.dot, i < value.length && styles.dotOn]} />
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
              accessibilityLabel={key === '⌫' ? 'Delete' : key}
              onPress={() => press(key)}
              style={({ pressed }) => [styles.key, styles.keyFace, pressed && styles.keyPressed]}
            >
              <Text variant="h1">{key}</Text>
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
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: colors.navy },
  dotOn: { backgroundColor: colors.navy },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 3 * 80 + 2 * 16, gap: 16 },
  key: { width: 80, height: 72 },
  keyFace: { borderRadius: radii.lg, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.line },
  keyPressed: { backgroundColor: colors.skyTint },
});
