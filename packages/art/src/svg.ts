import { OUTLINE, SILHOUETTE, countLayout, getArt, parseArtKey, resolvePaint } from './index';
import type { Shape } from './types';

/**
 * Renders an art key to a standalone SVG string, the same drawing the apps show. Used by the
 * video generator (rendered to PNG) and anywhere a file is needed instead of a component.
 */
export function artToSvg(art: string, size = 512, options: { silhouette?: boolean } = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-4 -8 108 112">${shapesSvg(art, !!options.silhouette, 0)}</svg>`;
}

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
// Built on first use: index.ts re-exports this module, so its values are not ready at load time.
let outlineAttrs: string | null = null;
const outline = () => (outlineAttrs ??= `stroke="${resolvePaint(OUTLINE.paint)}" stroke-opacity="${OUTLINE.opacity}" stroke-width="${OUTLINE.width}" stroke-linejoin="round"`);

function shapeSvg(shape: Shape, silhouette: boolean, depth: number): string {
  if (silhouette && (shape.k === 'hl' || shape.k === 'ink')) return '';
  const fill = (paint: string) => esc(resolvePaint(silhouette ? SILHOUETTE : paint));
  const body = !shape.k || shape.k === 'body';
  const common = `opacity="${shape.o ?? 1}"${shape.rot ? ` transform="rotate(${shape.rot[0]} ${shape.rot[1] ?? 50} ${shape.rot[2] ?? 50})"` : ''}`;
  if ('u' in shape) {
    if (depth > 4) return '';
    return `<g transform="translate(${shape.x} ${shape.y}) scale(${shape.scale})" opacity="${shape.o ?? 1}">${shapesSvg(shape.u, silhouette || !!shape.silhouette, depth + 1)}</g>`;
  }
  const line = body ? ` ${outline()}` : '';
  if ('c' in shape) return `<circle cx="${shape.c[0]}" cy="${shape.c[1]}" r="${shape.c[2]}" fill="${fill(shape.f)}" ${common}${line}/>`;
  if ('e' in shape) return `<ellipse cx="${shape.e[0]}" cy="${shape.e[1]}" rx="${shape.e[2]}" ry="${shape.e[3]}" fill="${fill(shape.f)}" ${common}${line}/>`;
  if ('r' in shape) return `<rect x="${shape.r[0]}" y="${shape.r[1]}" width="${shape.r[2]}" height="${shape.r[3]}" rx="${shape.r[4] ?? 0}" fill="${fill(shape.f)}" ${common}${line}/>`;
  if ('p' in shape) {
    const stroke = shape.s ? ` stroke="${fill(shape.s)}" stroke-width="${shape.sw ?? 2}" stroke-linejoin="round"` : line;
    return `<path d="${esc(shape.p)}" fill="${fill(shape.f)}" ${common}${stroke}/>`;
  }
  return `<path d="${esc(shape.l)}" fill="none" stroke="${fill(shape.s)}" stroke-width="${shape.sw}" stroke-linecap="${shape.cap ?? 'round'}" stroke-linejoin="round" ${common}/>`;
}

function shapesSvg(art: string, silhouette: boolean, depth: number): string {
  const { count } = parseArtKey(art);
  const shapes = getArt(art).shapes.map((s) => shapeSvg(s, silhouette, depth)).join('');
  if (count <= 1) return shapes;
  return countLayout(count)
    .map((slot) => `<g transform="translate(${slot.x} ${slot.y}) scale(${slot.scale})">${shapes}</g>`)
    .join('');
}
