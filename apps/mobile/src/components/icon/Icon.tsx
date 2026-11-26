import { weightFor, type IconName, type IconWeight } from '@kidzo/art';
import { decorative, palette, useTheme } from '../../theme/core';
import { ICONS } from './icons';

export type { IconName } from '@kidzo/art';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  /** Secondary fill for duotone icons. Defaults to a brand tint. */
  accent?: string;
  weight?: IconWeight;
  /** Spoken label. Leave empty for decorative icons next to visible text. */
  label?: string;
}

/**
 * The only way screens render icons. Duotone with a brand colored secondary layer for
 * navigation and features, bold for small actions.
 */
export function Icon({ name, size = 24, color, accent, weight, label }: Props) {
  const theme = useTheme();
  const Component = ICONS[name];
  const w = weightFor(name, weight);
  return (
    <Component
      size={size}
      color={color ?? theme.text}
      weight={w}
      duotoneColor={accent ?? (theme.isCalm ? theme.accent : palette.coral[400])}
      duotoneOpacity={theme.isCalm ? 0.35 : 0.45}
      {...(label ? { title: label, accessibilityLabel: label, accessibilityRole: 'image' } : decorative)}
    />
  );
}
