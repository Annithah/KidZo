/** Drawing helpers that keep the illustrations short and consistent in style. */
import type { Paint, Shape } from './types';

const r1 = (n: number) => Math.round(n * 10) / 10;

export const C = (cx: number, cy: number, r: number, f: Paint, x: Partial<Shape> = {}): Shape => ({ c: [cx, cy, r], f, ...x }) as Shape;
export const E = (cx: number, cy: number, rx: number, ry: number, f: Paint, x: Partial<Shape> = {}): Shape => ({ e: [cx, cy, rx, ry], f, ...x }) as Shape;
export const R = (x0: number, y0: number, w: number, h: number, rx: number, f: Paint, x: Partial<Shape> = {}): Shape => ({ r: [x0, y0, w, h, rx], f, ...x }) as Shape;
export const P = (d: string, f: Paint, x: Partial<Shape> = {}): Shape => ({ p: d, f, ...x }) as Shape;
export const L = (d: string, s: Paint, sw = 3, x: Partial<Shape> = {}): Shape => ({ l: d, s, sw, cap: 'round', ...x }) as Shape;
export const U = (key: string, x0 = 0, y0 = 0, scale = 1, x: Partial<Shape> = {}): Shape => ({ u: key, x: x0, y: y0, scale, ...x }) as Shape;

/** Soft inner highlight. */
export const HL = (cx: number, cy: number, rx: number, ry: number, rot = -25): Shape => ({ e: [cx, cy, rx, ry], f: 'paper', o: 0.5, k: 'hl', rot: [rot, cx, cy] });

/** Points of an n-pointed star. */
export function starPoints(cx: number, cy: number, outer: number, inner: number, n = 5, rotDeg = -90): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i += 1) {
    const rad = ((rotDeg + (i * 180) / n) * Math.PI) / 180;
    const rr = i % 2 === 0 ? outer : inner;
    pts.push([r1(cx + rr * Math.cos(rad)), r1(cy + rr * Math.sin(rad))]);
  }
  return pts;
}
export const polygon = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${x} ${y}`).join(' L')} Z`;

/**
 * Chunky rounded star: the polygon is stroked in its own color with round joins, which gives
 * soft tips. An outline ring sits underneath for the friendly Navy Ink edge.
 */
export function roundStar(cx: number, cy: number, outer: number, inner: number, f: Paint, edge: Paint, n = 5, round = 7): Shape[] {
  const d = polygon(starPoints(cx, cy, outer, inner, n));
  return [
    { p: d, f: 'navy', s: 'navy', sw: round + 4, o: 0.18, k: 'sh' },
    { p: d, f: edge, s: edge, sw: round, k: 'sh' },
    { p: d, f, s: f, sw: round - 3, k: 'sh' },
  ];
}

/** Petals around a center. */
export function ring(cx: number, cy: number, dist: number, r: number, n: number, f: Paint, startDeg = -90): Shape[] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((startDeg + (360 / n) * i) * Math.PI) / 180;
    return C(r1(cx + dist * Math.cos(a)), r1(cy + dist * Math.sin(a)), r, f);
  });
}

export type Mood = 'happy' | 'sleepy' | 'cheer' | 'think' | 'calm';

/** Friendly face: glinting eyes, rosy cheeks, smile. s scales the face. */
export function face(cx: number, cy: number, s = 1, mood: Mood = 'happy', gap = 11): Shape[] {
  const ex = gap * s;
  const out: Shape[] = [];
  if (mood === 'sleepy' || mood === 'calm') {
    out.push(L(`M${cx - ex - 4 * s} ${cy} q${4 * s} ${3.5 * s} ${8 * s} 0`, 'navy', 2.6 * s, { k: 'ink' }));
    out.push(L(`M${cx + ex - 4 * s} ${cy} q${4 * s} ${3.5 * s} ${8 * s} 0`, 'navy', 2.6 * s, { k: 'ink' }));
  } else {
    const lookUp = mood === 'think' ? -1.6 * s : 0;
    for (const x of [cx - ex, cx + ex]) {
      out.push(E(x, cy + lookUp, 3.4 * s, 4.2 * s, 'navy', { k: 'ink' }));
      out.push(C(x + 1.2 * s, cy - 1.4 * s + lookUp, 1.3 * s, 'paper', { k: 'hl' }));
    }
  }
  out.push(E(cx - ex - 4 * s, cy + 7 * s, 4 * s, 2.6 * s, 'bubblegum.300', { o: 0.75, k: 'sh' }));
  out.push(E(cx + ex + 4 * s, cy + 7 * s, 4 * s, 2.6 * s, 'bubblegum.300', { o: 0.75, k: 'sh' }));
  if (mood === 'cheer') {
    out.push(P(`M${cx - 6 * s} ${cy + 6 * s} q${6 * s} ${11 * s} ${12 * s} 0 z`, 'coral.700', { k: 'ink' }));
    out.push(E(cx, cy + 10.5 * s, 3 * s, 1.6 * s, 'bubblegum.300', { k: 'sh' }));
  } else if (mood === 'think') {
    out.push(L(`M${cx - 3 * s} ${cy + 8 * s} h${6 * s}`, 'navy', 2.6 * s, { k: 'ink' }));
  } else if (mood === 'sleepy') {
    out.push(E(cx, cy + 8 * s, 2.4 * s, 2 * s, 'navy', { k: 'ink', o: 0.85 }));
  } else {
    out.push(L(`M${cx - 5 * s} ${cy + 6.5 * s} q${5 * s} ${5.5 * s} ${10 * s} 0`, 'navy', 2.6 * s, { k: 'ink' }));
  }
  return out;
}

/** Small four point sparkle. */
export const sparkle = (cx: number, cy: number, s: number, f: Paint = 'star.400'): Shape =>
  P(`M${cx} ${cy - s} Q${cx + s * 0.18} ${cy - s * 0.18} ${cx + s} ${cy} Q${cx + s * 0.18} ${cy + s * 0.18} ${cx} ${cy + s} Q${cx - s * 0.18} ${cy + s * 0.18} ${cx - s} ${cy} Q${cx - s * 0.18} ${cy - s * 0.18} ${cx} ${cy - s} Z`, f, { k: 'sh' });

/** Heart path centered on cx, cy with half width w. */
export const heartPath = (cx: number, cy: number, w: number) =>
  `M${cx} ${cy + w * 0.85} C${cx - w * 1.5} ${cy - w * 0.1} ${cx - w * 0.75} ${cy - w * 1.05} ${cx} ${cy - w * 0.4} C${cx + w * 0.75} ${cy - w * 1.05} ${cx + w * 1.5} ${cy - w * 0.1} ${cx} ${cy + w * 0.85} Z`;

/** Fluffy cloud from overlapping circles. */
export const cloud = (cx: number, cy: number, s: number, f: Paint = 'paper', shade: Paint = 'sky.100'): Shape[] => [
  E(cx, cy + 8 * s, 30 * s, 12 * s, shade, { k: 'body' }),
  C(cx - 16 * s, cy + 2 * s, 12 * s, f),
  C(cx + 2 * s, cy - 6 * s, 16 * s, f),
  C(cx + 18 * s, cy + 3 * s, 11 * s, f),
  E(cx, cy + 7 * s, 28 * s, 10 * s, f, { k: 'sh' }),
  HL(cx - 2 * s, cy - 12 * s, 7 * s, 3 * s),
];
