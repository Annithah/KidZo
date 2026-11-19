import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Where uploaded media (cover art, narration audio) is stored. The local disk implementation
 * is for development and single server deployments. A cloud bucket (S3, R2, GCS) implementation
 * needs credentials, see PROGRESS.md "Needs Jay".
 */
export interface MediaStorage {
  put(data: Buffer, contentType: string): Promise<{ key: string; url: string }>;
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'video/mp4': 'mp4',
};

export class LocalDiskStorage implements MediaStorage {
  constructor(
    private readonly dir: string,
    private readonly publicBaseUrl: string,
  ) {}

  async put(data: Buffer, contentType: string): Promise<{ key: string; url: string }> {
    const ext = EXTENSIONS[contentType] ?? 'bin';
    const key = `${randomUUID()}.${ext}`;
    await mkdir(this.dir, { recursive: true });
    await writeFile(path.join(this.dir, key), data);
    return { key, url: `${this.publicBaseUrl.replace(/\/$/, '')}/media/${key}` };
  }
}

/**
 * Checks the file's leading bytes so a renamed file cannot pass as another type.
 * Returns the detected media type or null.
 */
export function sniffMediaType(buf: Buffer): string | null {
  const startsWith = (bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (startsWith([0x49, 0x44, 0x33]) || (buf[0] === 0xff && ((buf[1] ?? 0) & 0xe0) === 0xe0 && ((buf[1] ?? 0) & 0x06) !== 0)) {
    return 'audio/mpeg';
  }
  if (buf[0] === 0xff && ((buf[1] ?? 0) & 0xf6) === 0xf0) return 'audio/aac';
  if (startsWith([0x66, 0x74, 0x79, 0x70], 4)) {
    const audioBrands = new Set(['M4A ', 'M4B ', 'M4P ', 'F4A ', 'F4B ']);
    return audioBrands.has(buf.toString('ascii', 8, 12)) ? 'audio/mp4' : 'video/mp4';
  }
  return null;
}
