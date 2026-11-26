import { memo } from 'react';
import { OUTLINE, SILHOUETTE, countLayout, getArt, parseArtKey, resolvePaint, type Shape } from '@kidzo/art';

interface Props {
  /** Art key such as "sticker.ocean-pearl", "zo.thinking" or "object.apple*3". */
  art: string;
  size?: number;
  silhouette?: boolean;
  /** Accessible label. Omit when decorative. */
  label?: string;
  className?: string;
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
      <g transform={`translate(${shape.x} ${shape.y}) scale(${shape.scale})`} opacity={shape.o ?? 1}>
        <ArtShapes art={shape.u} silhouette={silhouette || !!shape.silhouette} depth={depth + 1} />
      </g>
    );
  }
  if ('c' in shape) return <circle cx={shape.c[0]} cy={shape.c[1]} r={shape.c[2]} fill={fill(shape.f)} {...common} {...(body ? outline : {})} />;
  if ('e' in shape) return <ellipse cx={shape.e[0]} cy={shape.e[1]} rx={shape.e[2]} ry={shape.e[3]} fill={fill(shape.f)} {...common} {...(body ? outline : {})} />;
  if ('r' in shape) return <rect x={shape.r[0]} y={shape.r[1]} width={shape.r[2]} height={shape.r[3]} rx={shape.r[4] ?? 0} fill={fill(shape.f)} {...common} {...(body ? outline : {})} />;
  if ('p' in shape) {
    const stroke = shape.s ? { stroke: fill(shape.s), strokeWidth: shape.sw ?? 2, strokeLinejoin: 'round' as const } : body ? outline : {};
    return <path d={shape.p} fill={fill(shape.f)} {...common} {...stroke} />;
  }
  return <path d={shape.l} fill="none" stroke={fill(shape.s)} strokeWidth={shape.sw} strokeLinecap={shape.cap ?? 'round'} strokeLinejoin="round" {...common} />;
}

function ArtShapes({ art, silhouette, depth }: { art: string; silhouette: boolean; depth: number }) {
  const { count } = parseArtKey(art);
  const shapes = getArt(art).shapes.map((s, i) => <ShapeView key={i} shape={s} silhouette={silhouette} depth={depth} />);
  if (count <= 1) return <>{shapes}</>;
  return (
    <>
      {countLayout(count).map((slot, i) => (
        <g key={i} transform={`translate(${slot.x} ${slot.y}) scale(${slot.scale})`}>
          {shapes}
        </g>
      ))}
    </>
  );
}

/** Renders any art key from the shared library as inline SVG. */
export const Art = memo(function Art({ art, size = 48, silhouette = false, label, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-4 -8 108 112"
      className={className}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true, focusable: false })}
    >
      <ArtShapes art={art} silhouette={silhouette} depth={0} />
    </svg>
  );
});
