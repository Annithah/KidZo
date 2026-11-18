import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { text, usePalette } from '../theme';

type Variant = keyof typeof text;

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  muted?: boolean;
  align?: TextStyle['textAlign'];
}

export function Text({ variant = 'body', color, muted, align, style, ...rest }: Props) {
  const palette = usePalette();
  return (
    <RNText
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[text[variant], { color: color ?? (muted ? palette.textMuted : palette.text), textAlign: align }, style]}
    />
  );
}
