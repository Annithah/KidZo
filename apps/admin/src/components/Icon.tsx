import type { CSSProperties } from 'react';
import { weightFor, type IconName, type IconWeight } from '@kidzo/art';
import { ICONS } from './icons';

export type { IconName } from '@kidzo/art';

interface Props {
  name: IconName;
  size?: number;
  /** Any CSS color; defaults to currentColor. */
  color?: string;
  /** Secondary duotone fill (CSS color or var). Defaults to the coral tint. */
  accent?: string;
  weight?: IconWeight;
  /** Accessible label. Omit for decorative icons beside visible text. */
  label?: string;
  className?: string;
}

/** The only way admin screens render icons. Duotone for navigation, bold for actions. */
export function Icon({ name, size = 20, color, accent, weight, label, className }: Props) {
  const Component = ICONS[name];
  const w = weightFor(name, weight);
  const style = { '--icon-duo': accent ?? 'var(--coral-300)' } as CSSProperties;
  return (
    <Component
      size={size}
      color={color ?? 'currentColor'}
      weight={w}
      className={`icon icon-${w}${className ? ` ${className}` : ''}`}
      style={style}
      {...(label ? { 'aria-label': label, role: 'img' } : { 'aria-hidden': true, focusable: false })}
    />
  );
}
