import type { VideoCredit } from '@kidzo/shared';

/** One credit line: the attribution text, plus author and license only when it does not already name them. */
export function creditLine(c: Pick<VideoCredit, 'author' | 'attribution' | 'license'>): string {
  const attribution = c.attribution.trim();
  const has = (v: string | null) => !!v && attribution.toLowerCase().includes(v.trim().toLowerCase());
  return [has(c.author) ? null : c.author, attribution || null, has(c.license) ? null : c.license]
    .filter((v, i, all): v is string => !!v && all.indexOf(v) === i)
    .join(' · ');
}
