const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '10.0.2.2']);

/**
 * Media uploaded in local development is saved with the API's own address, usually
 * http://localhost:4000/media/... On a phone "localhost" is the phone itself, so such a link
 * never loads. This points loopback media links at the API address the app really uses.
 * Real (non-loopback) URLs, local files and bundled assets are returned unchanged.
 */
export function resolveMediaUrl(url: string, apiUrl: string): string;
export function resolveMediaUrl(url: string | null | undefined, apiUrl: string): string | null;
export function resolveMediaUrl(url: string | null | undefined, apiUrl: string): string | null {
  if (!url) return null;
  let media: URL;
  let api: URL;
  try {
    media = new URL(url);
    api = new URL(apiUrl);
  } catch {
    return url;
  }
  if (media.protocol !== 'http:' && media.protocol !== 'https:') return url;
  if (!LOOPBACK.has(media.hostname) || media.host === api.host) return url;
  return `${api.origin}${media.pathname}${media.search}`;
}
