import * as Haptics from 'expo-haptics';
import { Platform, Pressable } from 'react-native';
import { palette, radius, shadow, touchTargets, useTheme } from '../theme/core';
import { Icon, type IconName } from './icon/Icon';

interface Props {
  icon: IconName;
  /** Required: icon buttons have no visible text. */
  label: string;
  onPress: () => void;
  size?: 'md' | 'kid';
  tone?: 'surface' | 'primary' | 'ghost';
  disabled?: boolean;
  hint?: string;
}

/** Round icon-only button with an accessible label and a 48 or 64 point target. */
export function IconButton({ icon, label, onPress, size = 'md', tone = 'surface', disabled, hint }: Props) {
  const theme = useTheme();
  const dim = size === 'kid' ? touchTargets.little : touchTargets.standard;
  const bg = tone === 'primary' ? theme.primary : tone === 'ghost' ? 'transparent' : theme.surface;
  const fg = tone === 'primary' ? theme.onPrimary : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        {
          width: dim,
          height: dim,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.92 : 1 }],
        },
        tone !== 'ghost' && shadow(1, undefined, theme),
        tone === 'surface' && !theme.isCalm && { borderWidth: 1.5, borderColor: palette.coral[50] },
      ]}
    >
      <Icon name={icon} size={dim * 0.46} color={fg} />
    </Pressable>
  );
}
