import { memo } from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { decorative } from '../../theme/core';
import { OUTLINE, SILHOUETTE, countLayout, getArt, parseArtKey, resolvePaint, type Shape } from '@kidzo/art';

interface Props {
  /** Art key such as "sticker.ocean-pearl", "zo.sleepy" or "object.apple*3". */
  art: string;
  size?: number;
  /** Greyed silhouette, used for locked stickers. */
  silhouette?: boolean;
  /** Spoken description. Omit when the art is decorative. */
  label?: string;
}

const outline = { stroke: resolvePaint(OUTLINE.paint), strokeOpacity: OUTLINE.opacity, strokeWidth: OUTLINE.width, strokeLinejoin: 'round' as const };

function ShapeView({ shape, silhouette, depth }: { shape: Shape; silhouette: boolean; depth: number }) {
  if (silhouette && (shape.k === 'hl' || shape.k === 'ink')) return null;
  const fill = (paint: string) => resolvePaint(silhouette ? SILHOUETTE : paint);
  const body = !shape.k || shape.k === 'body';
  const common = {
    opacity: shape.o ?? 1,
    ...(shape.rot ? { transform: `rotate(${shape.rot[0]} ${shape.rot[1] ?? 50} ${shape.rot[2] ?? 50})` } : {}),
  };
  if ('u' in shape) {
    if (depth > 4) return null;
    return (
      <G transform={`translate(${shape.x} ${shape.y}) scale(${shape.scale})`} opacity={shape.o ?? 1}>
        <ArtShapes art={shape.u} silhouette={silhouette || !!shape.silhouette} depth={depth + 1} />
      </G>
    );
  }
  if ('c' in shape) return <Circle cx={shape.c[0]} cy={shape.c[1]} r={shape.c[2]} fill={fill(shape.f)} {...common} {...(body ? outline : {})} />;
  if ('e' in shape) return <Ellipse cx={shape.e[0]} cy={shape.e[1]} rx={shape.e[2]} ry={shape.e[3]} fill={fill(shape.f)} {...common} {...(body ? outline : {})} />;
  if ('r' in shape) return <Rect x={shape.r[0]} y={shape.r[1]} width={shape.r[2]} height={shape.r[3]} rx={shape.r[4] ?? 0} fill={fill(shape.f)} {...common} {...(body ? outline : {})} />;
  if ('p' in shape) {
    const stroke = shape.s ? { stroke: fill(shape.s), strokeWidth: shape.sw ?? 2, strokeLinejoin: 'round' as const } : body ? outline : {};
    return <Path d={shape.p} fill={fill(shape.f)} {...common} {...stroke} />;
  }
  return <Path d={shape.l} fill="none" stroke={fill(shape.s)} strokeWidth={shape.sw} strokeLinecap={shape.cap ?? 'round'} strokeLinejoin="round" {...common} />;
}

function ArtShapes({ art, silhouette, depth }: { art: string; silhouette: boolean; depth: number }) {
  const { count } = parseArtKey(art);
  const def = getArt(art);
  const shapes = def.shapes.map((s, i) => <ShapeView key={i} shape={s} silhouette={silhouette} depth={depth} />);
  if (count <= 1) return <>{shapes}</>;
  return (
    <>
      {countLayout(count).map((slot, i) => (
        <G key={i} transform={`translate(${slot.x} ${slot.y}) scale(${slot.scale})`}>
          {shapes}
        </G>
      ))}
    </>
  );
}

/** Renders any art key from the shared library. */
export const Art = memo(function Art({ art, size = 96, silhouette = false, label }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="-4 -8 108 112"
      {...(label ? { accessible: true, accessibilityRole: 'image', accessibilityLabel: label } : decorative)}
    >
      <ArtShapes art={art} silhouette={silhouette} depth={0} />
    </Svg>
  );
});
