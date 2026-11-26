import { View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { fonts, palette, useTheme } from '../theme/core';

/** Token-styled bar chart for parent insights. Rounded bars, a subtle grid, labels below. */
export function BarChart({ data, height = 140, label }: { data: { label: string; value: number }[]; height?: number; label: string }) {
  const theme = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 320;
  const chartH = height - 22;
  const slot = W / Math.max(1, data.length);
  const bar = Math.min(28, slot * 0.55);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`}>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <Line key={g} x1={0} x2={W} y1={chartH - chartH * g} y2={chartH - chartH * g} stroke={theme.line} strokeWidth={1} strokeDasharray="4 6" />
        ))}
        {data.map((d, i) => {
          const h = Math.max(6, (chartH - 8) * (d.value / max));
          const x = i * slot + (slot - bar) / 2;
          const top = i === data.length - 1;
          return (
            <Rect key={d.label + i} x={x} y={chartH - h} width={bar} height={h} rx={bar / 2} fill={top ? palette.coral[500] : palette.grape[300]} />
          );
        })}
        {data.map((d, i) => (
          <SvgText key={`l${i}`} x={i * slot + slot / 2} y={height - 4} fontSize={12} fontFamily={fonts.bodyBold} fill={theme.textMuted} textAnchor="middle">
            {d.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
