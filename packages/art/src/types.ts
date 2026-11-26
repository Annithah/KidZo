/**
 * Platform-neutral vector art. Every illustration is a list of shapes on a 100 x 100 canvas.
 * Colors are token references ("coral.500", "paper", "navy"), never raw values, so art follows
 * the design tokens. Mobile renders with react-native-svg, admin with inline SVG.
 */

/** "coral.500", "sky.200", or a base color name ("paper", "navy", "star"). */
export type Paint = string;

interface Common {
  /** Opacity 0 to 1. */
  o?: number;
  /** Rotation in degrees around [cx, cy] (defaults to the canvas center). */
  rot?: [number, number?, number?];
  /**
   * Role: "body" shapes get the soft Navy Ink outline, "hl" are inner highlights (white, no
   * outline), "sh" are shade or detail shapes (no outline), "ink" are dark features.
   */
  k?: 'body' | 'hl' | 'sh' | 'ink';
}

export type Shape =
  | (Common & { c: [cx: number, cy: number, r: number]; f: Paint })
  | (Common & { e: [cx: number, cy: number, rx: number, ry: number]; f: Paint })
  | (Common & { r: [x: number, y: number, w: number, h: number, rx?: number]; f: Paint })
  | (Common & { p: string; f: Paint; s?: Paint; sw?: number })
  /** Stroke-only path: smiles, lines, sparkles. */
  | (Common & { l: string; s: Paint; sw: number; cap?: 'round' | 'butt' })
  /** Another art piece placed at x, y (top left) with a scale (1 = 100 units). */
  | (Common & { u: string; x: number; y: number; scale: number; silhouette?: boolean });

export type ArtGroup = 'object' | 'sticker' | 'category' | 'avatar' | 'wardrobe' | 'zo' | 'scene' | 'motif';

export interface ArtDef {
  key: string;
  label: string;
  group: ArtGroup;
  shapes: Shape[];
  /** Wardrobe only: where the layer stacks on an avatar. */
  layer?: 'back' | 'face' | 'top';
  /** Stickers only: default world color for the die-cut disc. */
  world?: string;
}
