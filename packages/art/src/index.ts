import { base, palette, type ColorName, type ScaleStep } from '@kidzo/ui-tokens';
import { characterArt } from './library/characters';
import { objects } from './library/objects';
import type { ArtDef, ArtGroup } from './types';

export * from './icons';
export * from './legacy';
export type { ArtDef, ArtGroup, Paint, Shape } from './types';
export { STICKERS, AVATAR_WORLD } from './library/characters';
export { ANIMAL_HEADS } from './library/objects';

const ALL: ArtDef[] = [...objects, ...characterArt];

/** Every art piece by key, for example "sticker.ocean-pearl" or "zo.sleepy". */
export const ART: ReadonlyMap<string, ArtDef> = new Map(ALL.map((a) => [a.key, a]));
export const ART_KEYS: readonly string[] = ALL.map((a) => a.key);
export const artKeysIn = (group: ArtGroup): string[] => ALL.filter((a) => a.group === group).map((a) => a.key);

export const FALLBACK_ART = 'object.sparkles';

/** "object.apple*3" means three apples. Returns the base key and the count. */
export function parseArtKey(value: string): { key: string; count: number } {
  const [key = value, n] = value.split('*');
  const count = Math.max(1, Math.min(9, Number(n) || 1));
  return { key, count };
}

/** Art definition for a key, or the fallback sparkle when the key is unknown. */
export function getArt(value: string): ArtDef {
  const { key } = parseArtKey(value);
  return ART.get(key) ?? (ART.get(FALLBACK_ART) as ArtDef);
}

export const artLabel = (value: string): string => {
  const { count } = parseArtKey(value);
  const label = getArt(value).label;
  return count > 1 ? `${count} ${label.toLowerCase()}` : label;
};

/** Resolves an art paint reference ("coral.500", "paper", "navy") to a token color. */
export function resolvePaint(paint: string): string {
  if (paint === 'none') return 'none';
  const [name, step] = paint.split('.') as [ColorName, string | undefined];
  const scale = palette[name];
  if (!scale) return base.navy;
  return step ? (scale[Number(step) as ScaleStep] ?? scale[500]) : scale[500];
}

/** Where each copy goes when a key asks for several ("object.apple*3"), on the 100 x 100 canvas. */
export function countLayout(count: number): { x: number; y: number; scale: number }[] {
  if (count <= 1) return [{ x: 0, y: 0, scale: 1 }];
  const cols = count <= 3 ? count : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const cell = 100 / Math.max(cols, rows);
  const offsetY = (100 - rows * cell) / 2;
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? count - row * cols : cols;
    const offsetX = (100 - inRow * cell) / 2;
    return { x: offsetX + (i % cols) * cell, y: offsetY + row * cell, scale: cell / 100 };
  });
}

/** Grey used for locked sticker silhouettes. */
export const SILHOUETTE = 'navy.100';
export const OUTLINE = { paint: 'navy', opacity: 0.22, width: 2.4 } as const;
export { artToSvg } from './svg';
