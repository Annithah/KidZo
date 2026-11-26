import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { fonts, palette, radius, spacing, touchTargets, useTheme, type ColorName } from '../theme/core';
import { Art } from './art/Art';
import { Icon, type IconName } from './icon/Icon';
import { Text } from './Typography';

interface FieldProps extends TextInputProps {
  label: string;
  error?: string | undefined;
  hint?: string;
  icon?: IconName;
}

/** Labelled input with hint, and an inline error (red border + icon) under the field. */
export function TextField({ label, error, hint, icon, style, ...rest }: FieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const border = error ? theme.error : focused ? theme.focus : theme.lineStrong;
  return (
    <View style={styles.field}>
      <Text variant="bodyBold">{label}</Text>
      <View style={[styles.inputWrap, { borderColor: border, backgroundColor: theme.isCalm ? theme.surface : palette.paper[500] }, focused && styles.focused]}>
        {icon ? <Icon name={icon} size={20} color={theme.textMuted} /> : null}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          aria-invalid={!!error}
          placeholderTextColor={theme.textSubtle}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, { color: theme.text }, style]}
        />
        {error ? <Icon name="warning" size={20} color={theme.error} /> : null}
      </View>
      {error ? (
        <View style={styles.message} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Text variant="small" color={theme.errorText}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="small" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function ToggleRow({ title, subtitle, value, onChange, icon, art, world = 'grape' }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; icon?: IconName; /** Art key shown instead of an icon. */ art?: string; world?: ColorName }) {
  const theme = useTheme();
  return (
    <View style={styles.toggleRow}>
      {icon || art ? (
        <View style={[styles.iconTile, { backgroundColor: theme.isCalm ? theme.surfaceRaised : palette[world][50] }]}>
          {art ? <Art art={art} size={36} /> : icon ? <Icon name={icon} size={26} color={theme.isCalm ? theme.accent : palette[world][700]} accent={palette[world][300]} /> : null}
        </View>
      ) : null}
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
        accessibilityHint={subtitle}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.lineStrong, true: theme.isCalm ? palette.moon[700] : palette.mint[600] }}
        thumbColor={palette.paper[500]}
      />
    </View>
  );
}

/** Large minus / value / plus control. Works for small hands and screen readers. */
export function Stepper({ label, valueLabel, onDecrease, onIncrease, canDecrease = true, canIncrease = true }: { label: string; valueLabel: string; onDecrease: () => void; onIncrease: () => void; canDecrease?: boolean; canIncrease?: boolean }) {
  const theme = useTheme();
  const btn = (icon: IconName, onPress: () => void, enabled: boolean, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      style={({ pressed }) => [styles.stepBtn, { backgroundColor: enabled ? (theme.isCalm ? theme.surfaceRaised : palette.sky[50]) : theme.surfaceSunken, transform: [{ scale: pressed ? 0.92 : 1 }] }]}
    >
      <Icon name={icon} size={24} color={enabled ? theme.text : theme.textSubtle} />
    </Pressable>
  );
  return (
    <View style={styles.stepper} accessible={false}>
      {btn('minus', onDecrease, canDecrease, `Decrease ${label}`)}
      <Text variant="h2" align="center" style={{ flex: 1 }} accessibilityLabel={`${label}: ${valueLabel}`} accessibilityLiveRegion="polite">
        {valueLabel}
      </Text>
      {btn('plus', onIncrease, canIncrease, `Increase ${label}`)}
    </View>
  );
}

export function ProgressBar({ value, color, track }: { value: number; color?: string; track?: string }) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={[styles.track, { backgroundColor: track ?? theme.line }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color ?? palette.mint[500] }]} />
    </View>
  );
}

/** Progress as stars along the logo swoosh: filled stars for done steps. */
export function SwooshProgress({ done, total, label }: { done: number; total: number; label?: string }) {
  const theme = useTheme();
  const n = Math.max(1, Math.min(total, 10));
  const filled = Math.round((Math.min(done, total) / Math.max(1, total)) * n);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: total, now: Math.min(done, total) }} style={styles.swoosh}>
      <Svg width="100%" height={36} viewBox="0 0 300 36" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Path d="M6 30 Q150 2 294 22" stroke={theme.isCalm ? theme.line : palette.coral[100]} strokeWidth={8} strokeLinecap="round" fill="none" />
        <Path d="M6 30 Q150 2 294 22" stroke={theme.isCalm ? palette.moon[500] : palette.coral[500]} strokeWidth={8} strokeLinecap="round" fill="none" strokeDasharray={`${(filled / n) * 300} 400`} />
      </Svg>
      <View style={styles.swooshStars}>
        {Array.from({ length: n }, (_, i) => (
          <View key={i} style={{ marginTop: i === 0 || i === n - 1 ? 8 : i < n / 2 ? 2 : 0 }}>
            <Icon name="star" size={20} weight={i < filled ? 'fill' : 'duotone'} color={i < filled ? palette.star[500] : theme.textSubtle} accent={palette.star[200]} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Segmented choice for languages, filters and options. */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string; icon?: IconName }[]; value: T; onChange: (v: T) => void; label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const selected = o.value === value;
        const fg = selected ? (theme.isCalm ? theme.onPrimary : palette.paper[500]) : theme.text;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.segment,
              { backgroundColor: selected ? (theme.isCalm ? theme.primary : palette.navy[500]) : theme.isCalm ? theme.surface : palette.paper[500], borderColor: selected ? 'transparent' : theme.line, transform: [{ scale: pressed ? 0.96 : 1 }] },
            ]}
          >
            {o.icon ? <Icon name={o.icon} size={18} color={fg} accent={selected ? palette.coral[400] : undefined} /> : null}
            <Text variant="caption" color={fg}>
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
  inputWrap: { minHeight: 54, borderWidth: 2, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  focused: { borderWidth: 3, paddingHorizontal: spacing.md - 1 },
  input: { flex: 1, minHeight: 50, fontFamily: fonts.body, fontSize: 16 },
  message: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 60 },
  iconTile: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: { width: 56, height: 56, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  track: { height: 12, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
  swoosh: { height: 40, justifyContent: 'center' },
  swooshStars: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 0 },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: { paddingHorizontal: 14, minHeight: touchTargets.standard, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6, borderRadius: radius.full, borderWidth: 1.5 },
});
