/** Small color helpers used to build scales and verify contrast. No dependencies. */

export type Hex = `#${string}`;

function channels(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0').toUpperCase();

/** Linear mix of two colors. amount 0 returns a, 1 returns b. */
export function mix(a: string, b: string, amount: number): Hex {
  const [r1, g1, b1] = channels(a);
  const [r2, g2, b2] = channels(b);
  return `#${toHex(r1 + (r2 - r1) * amount)}${toHex(g1 + (g2 - g1) * amount)}${toHex(b1 + (b2 - b1) * amount)}`;
}

/** rgba() string, used for tinted shadows and translucent overlays. */
export function alpha(hex: string, opacity: number): string {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
