import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fontFamilies, radii, spacing, usePalette } from '../theme';
import { Text } from './Typography';

interface FieldProps extends TextInputProps {
  label: string;
  error?: string | undefined;
  hint?: string;
}

export function TextField({ label, error, hint, style, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text variant="bodyBold">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.inkSubtle}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          styles.input,
          { borderColor: error ? colors.error : focused ? colors.skyBlue : colors.line },
          style,
        ]}
      />
      {error ? (
        <Text variant="small" color={colors.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  icon,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon?: string;
}) {
  const palette = usePalette();
  return (
    <View style={styles.toggleRow}>
      {icon ? <Text variant="h2">{icon}</Text> : null}
      <View style={{ flex: 1 }}>
        <Text variant="bodyBold">{title}</Text>
        {subtitle ? (
          <Text variant="small" muted>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: palette.line, true: colors.mint }}
        thumbColor={colors.white}
      />
    </View>
  );
}

/** Large minus / value / plus control. Works well for small hands and screen readers. */
export function Stepper({
  label,
  valueLabel,
  onDecrease,
  onIncrease,
  canDecrease = true,
  canIncrease = true,
}: {
  label: string;
  valueLabel: string;
  onDecrease: () => void;
  onIncrease: () => void;
  canDecrease?: boolean;
  canIncrease?: boolean;
}) {
  const palette = usePalette();
  const btn = (symbol: string, onPress: () => void, enabled: boolean, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      style={[styles.stepBtn, { backgroundColor: enabled ? colors.skyTint : palette.line }]}
    >
      <Text variant="h2" color={enabled ? colors.navy : colors.inkSubtle}>
        {symbol}
      </Text>
    </Pressable>
  );
  return (
    <View style={styles.stepper} accessibilityLabel={`${label}: ${valueLabel}`}>
      {btn('−', onDecrease, canDecrease, `Decrease ${label}`)}
      <Text variant="h2" align="center" style={{ flex: 1 }}>
        {valueLabel}
      </Text>
      {btn('+', onIncrease, canIncrease, `Increase ${label}`)}
    </View>
  );
}

export function ProgressBar({ value, color = colors.mint, track }: { value: number; color?: string; track?: string }) {
  const palette = usePalette();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      style={[styles.track, { backgroundColor: track ?? palette.line }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
    >
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

/** Segmented choice, used for languages and options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && styles.segmentOn]}
          >
            <Text variant="caption" color={selected ? colors.white : colors.navy}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  input: {
    minHeight: 52,
    borderWidth: 2,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    color: colors.navy,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  track: { height: 12, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: {
    paddingHorizontal: 14,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.skyTint,
  },
  segmentOn: { backgroundColor: colors.navy },
});
