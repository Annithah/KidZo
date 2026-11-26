import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { text, useTheme } from '../theme/core';

type Variant = keyof typeof text;

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  muted?: boolean;
  align?: TextStyle['textAlign'];
}

/** Themed text. Fredoka for headings, Nunito for body; supports large text up to 1.6x. */
export function Text({ variant = 'body', color, muted, align, style, ...rest }: Props) {
  const theme = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={variant === 'display' || variant === 'h1' ? 1.3 : 1.6}
      {...rest}
      style={[text[variant], { color: color ?? (muted ? theme.textMuted : theme.text), textAlign: align }, style]}
    />
  );
}
