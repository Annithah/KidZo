import type { VideoSource } from '@kidzo/shared';

/** One video found at a source, before safety checks and download. */
export interface Candidate {
  source: VideoSource;
  originalId: string;
  title: string;
  description: string;
  tags: string[];
  author: string | null;
  license: string;
  attribution: string;
  sourceUrl: string;
  /** File to download (the best rendition at or above 720p when the source lists several). */
  downloadUrl: string;
  /** From the source when known; always confirmed with ffprobe after download. */
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export interface SearchOptions {
  perPage: number;
  fetchImpl?: typeof fetch;
}

export interface VideoSourceAdapter {
  id: VideoSource;
  /** Null when the source can run; otherwise why it is skipped (for example a missing key). */
  unavailable(): string | null;
  search(term: string, options: SearchOptions): Promise<Candidate[]>;
}

const UA = { 'user-agent': 'KIDZO-content-import/1.0' };

async function getJson<T>(url: string, init: RequestInit, f: typeof fetch): Promise<T> {
  const res = await f(url, { ...init, headers: { ...UA, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return (await res.json()) as T;
}

const stripHtml = (v: string) => v.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

/** NASA Image and Video Library. No key. NASA media is generally not copyrighted. */
export const nasa: VideoSourceAdapter = {
  id: 'nasa',
  unavailable: () => null,
  async search(term, { perPage, fetchImpl = fetch }) {
    type Item = { href: string; data: { nasa_id: string; title: string; description?: string; keywords?: string[]; photographer?: string; center?: string; secondary_creator?: string }[] };
    const found = await getJson<{ collection: { items: Item[] } }>(
      `https://images-api.nasa.gov/search?media_type=video&page_size=${Math.min(perPage, 100)}&q=${encodeURIComponent(term)}`,
      {},
      fetchImpl,
    );
    const out: Candidate[] = [];
    for (const item of found.collection.items.slice(0, perPage)) {
      const d = item.data[0];
      if (!d) continue;
      let files: string[];
      try {
        files = await getJson<string[]>(item.href, {}, fetchImpl);
      } catch {
        continue;
      }
      // NASA lists renditions as ~orig, ~large, ~medium, ~mobile. Prefer large (usually 720p+).
      const mp4 = files.filter((f) => f.endsWith('.mp4'));
      const pick = mp4.find((f) => f.includes('~large')) ?? mp4.find((f) => f.includes('~orig')) ?? mp4[0];
      if (!pick) continue;
      out.push({
        source: 'nasa',
        originalId: d.nasa_id,
        title: d.title,
        description: stripHtml(d.description ?? ''),
        tags: d.keywords ?? [],
        author: d.secondary_creator ?? d.photographer ?? d.center ?? 'NASA',
        license: 'Public Domain',
        attribution: `NASA${d.center ? ` ${d.center}` : ''}`,
        sourceUrl: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`,
        downloadUrl: pick.replace(/^http:/, 'https:').replace(/ /g, '%20'),
        width: null,
        height: null,
        durationSeconds: null,
      });
    }
    return out;
  },
};

/** Wikimedia Commons, limited to CC0, public domain and CC BY (no share-alike, NC or ND). */
export const wikimedia: VideoSourceAdapter = {
  id: 'wikimedia',
  unavailable: () => null,
  async search(term, { perPage, fetchImpl = fetch }) {
    type Meta = Record<string, { value?: string } | undefined>;
    type Page = { title: string; pageid: number; imageinfo?: { url: string; descriptionurl: string; width: number; height: number; mime: string; duration?: number; extmetadata?: Meta; derivatives?: { src: string; height: number; type: string }[] }[] };
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      generator: 'search',
      gsrsearch: `filetype:video ${term}`,
      gsrnamespace: '6',
      gsrlimit: String(Math.min(perPage, 50)),
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
    });
    const found = await getJson<{ query?: { pages?: Record<string, Page> } }>(`https://commons.wikimedia.org/w/api.php?${params}`, {}, fetchImpl);
    const out: Candidate[] = [];
    for (const page of Object.values(found.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const m = info.extmetadata ?? {};
      const license = stripHtml(m.LicenseShortName?.value ?? 'unknown');
      const author = stripHtml(m.Artist?.value ?? '') || null;
      const title = page.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ');
      out.push({
        source: 'wikimedia',
        originalId: String(page.pageid),
        title,
        description: stripHtml(m.ImageDescription?.value ?? ''),
        tags: stripHtml(m.Categories?.value ?? '').split('|').filter(Boolean),
        author,
        license,
        attribution: `${author ?? 'Unknown author'}, ${license}, via Wikimedia Commons`,
        sourceUrl: info.descriptionurl,
        downloadUrl: info.url,
        width: info.width || null,
        height: info.height || null,
        durationSeconds: info.duration ? Math.round(info.duration) : null,
      });
    }
    return out;
  },
};

/** Pexels Video API. Needs PEXELS_API_KEY. */
export const pexels: VideoSourceAdapter = {
  id: 'pexels',
  unavailable: () => (process.env.PEXELS_API_KEY ? null : 'PEXELS_API_KEY is not set'),
  async search(term, { perPage, fetchImpl = fetch }) {
    type Video = { id: number; url: string; duration: number; width: number; height: number; user: { name: string; url: string }; tags?: string[]; video_files: { link: string; width: number; height: number; file_type: string }[] };
    const found = await getJson<{ videos: Video[] }>(
      `https://api.pexels.com/videos/search?per_page=${Math.min(perPage, 80)}&query=${encodeURIComponent(term)}`,
      { headers: { authorization: process.env.PEXELS_API_KEY ?? '' } },
      fetchImpl,
    );
    return found.videos.flatMap((v) => {
      const files = v.video_files.filter((f) => f.file_type === 'video/mp4' && Math.min(f.width, f.height) >= 720).sort((a, b) => a.height - b.height);
      const file = files[0];
      if (!file) return [];
      // Pexels pages end with a readable slug, the best "title" the API offers.
      const slug = v.url.split('/').filter(Boolean).pop() ?? '';
      const title = slug.replace(/-\d+$/, '').replace(/-/g, ' ');
      return [{
        source: 'pexels' as const,
        originalId: String(v.id),
        title,
        description: '',
        tags: v.tags ?? title.split(' '),
        author: v.user.name,
        license: 'Pexels License',
        attribution: `Video by ${v.user.name} on Pexels`,
        sourceUrl: v.url,
        downloadUrl: file.link,
        width: file.width,
        height: file.height,
        durationSeconds: v.duration,
      }];
    });
  },
};

/** Pixabay Video API. Needs PIXABAY_API_KEY. SafeSearch is always on. */
export const pixabay: VideoSourceAdapter = {
  id: 'pixabay',
  unavailable: () => (process.env.PIXABAY_API_KEY ? null : 'PIXABAY_API_KEY is not set'),
  async search(term, { perPage, fetchImpl = fetch }) {
    type Rendition = { url: string; width: number; height: number };
    type Hit = { id: number; pageURL: string; tags: string; duration: number; user: string; videos: { large?: Rendition; medium?: Rendition } };
    const found = await getJson<{ hits: Hit[] }>(
      `https://pixabay.com/api/videos/?safesearch=true&per_page=${Math.max(3, Math.min(perPage, 200))}&key=${encodeURIComponent(process.env.PIXABAY_API_KEY ?? '')}&q=${encodeURIComponent(term)}`,
      {},
      fetchImpl,
    );
    return found.hits.flatMap((h) => {
      const file = [h.videos.medium, h.videos.large].find((r) => r?.url && Math.min(r.width, r.height) >= 720);
      if (!file) return [];
      const tags = h.tags.split(',').map((t) => t.trim()).filter(Boolean);
      return [{
        source: 'pixabay' as const,
        originalId: String(h.id),
        title: tags.slice(0, 3).join(' '),
        description: '',
        tags,
        author: h.user,
        license: 'Pixabay Content License',
        attribution: `Video by ${h.user} on Pixabay`,
        sourceUrl: h.pageURL,
        downloadUrl: file.url,
        width: file.width,
        height: file.height,
        durationSeconds: h.duration,
      }];
    });
  },
};

export const ADAPTERS: Record<string, VideoSourceAdapter> = { nasa, wikimedia, pexels, pixabay };
