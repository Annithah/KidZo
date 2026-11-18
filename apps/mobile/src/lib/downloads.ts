/**
 * Offline content packages. Each download stores the full content JSON (story graph, quiz or
 * lyrics) plus any media files, rewritten to point at local copies.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { contentDetailSchema, type ContentDetail } from '@kidzo/shared';
import { api } from './api';
import { readJson, writeJson } from './kv';
import { appStore } from './storage';

export const downloadsSupported = Platform.OS !== 'web';

const INDEX_KEY = 'kidzo.downloads.v1';

export interface DownloadEntry {
  id: string;
  version: number;
  title: string;
  coverEmoji: string;
  coverColor: string;
  sizeBytes: number;
  downloadedAt: string;
  mediaFiles: string[];
}

type DownloadIndex = Record<string, DownloadEntry>;

const contentDir = () => {
  const dir = new Directory(Paths.document, 'kidzo-content');
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
  return dir;
};

const packageFile = (id: string) => new File(contentDir(), `${id}.json`);

export async function listDownloads(): Promise<DownloadIndex> {
  if (!downloadsSupported) return {};
  return readJson<DownloadIndex>(appStore, INDEX_KEY, {});
}

export async function readLocalContent(id: string): Promise<ContentDetail | null> {
  if (!downloadsSupported) return null;
  try {
    const file = packageFile(id);
    if (!file.exists) return null;
    const parsed = contentDetailSchema.safeParse(JSON.parse(await file.text()));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Downloads a content package. `onProgress` receives 0..1. */
export async function downloadContent(id: string, onProgress?: (p: number) => void): Promise<DownloadEntry> {
  if (!downloadsSupported) throw new Error('Downloads are not available on web');
  onProgress?.(0.05);
  const detail = await api.content(id);
  onProgress?.(0.3);

  const mediaFiles: string[] = [];
  let mediaBytes = 0;
  let body = detail.body;
  if (body.kind === 'song' && body.audioUrl) {
    const ext = body.audioUrl.split('.').pop()?.split('?')[0] ?? 'mp3';
    const target = new File(contentDir(), `${id}-audio.${ext}`);
    if (target.exists) target.delete();
    const task = File.createDownloadTask(body.audioUrl, target, {
      onProgress: ({ bytesWritten, totalBytes }) => {
        if (totalBytes > 0) onProgress?.(0.3 + 0.65 * (bytesWritten / totalBytes));
      },
    });
    const file = await task.downloadAsync();
    if (file) {
      mediaFiles.push(file.uri);
      mediaBytes += file.size;
      body = { ...body, audioUrl: file.uri };
    }
  }

  const pkg: ContentDetail = { ...detail, body };
  const file = packageFile(id);
  if (!file.exists) file.create();
  file.write(JSON.stringify(pkg));

  const entry: DownloadEntry = {
    id,
    version: detail.version,
    title: detail.title.en,
    coverEmoji: detail.coverEmoji,
    coverColor: detail.coverColor,
    sizeBytes: file.size + mediaBytes,
    downloadedAt: new Date().toISOString(),
    mediaFiles,
  };
  const index = await listDownloads();
  index[id] = entry;
  await writeJson(appStore, INDEX_KEY, index);
  onProgress?.(1);
  return entry;
}

export async function removeDownload(id: string): Promise<void> {
  const index = await listDownloads();
  const entry = index[id];
  const pkg = packageFile(id);
  if (pkg.exists) pkg.delete();
  for (const uri of entry?.mediaFiles ?? []) {
    const media = new File(uri);
    if (media.exists) media.delete();
  }
  delete index[id];
  await writeJson(appStore, INDEX_KEY, index);
}

export async function removeAllDownloads(): Promise<void> {
  const dir = new Directory(Paths.document, 'kidzo-content');
  if (dir.exists) dir.delete();
  await writeJson(appStore, INDEX_KEY, {});
}

export const downloadsQueryKey = ['downloads'] as const;

export function useDownloads() {
  return useQuery({ queryKey: downloadsQueryKey, queryFn: listDownloads, staleTime: Infinity });
}

/** Download state for one content item, with progress. */
export function useDownloadAction(id: string) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    setProgress(0);
    try {
      await downloadContent(id, setProgress);
      await queryClient.invalidateQueries({ queryKey: downloadsQueryKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setProgress(null);
    }
  }, [id, queryClient]);

  const remove = useCallback(async () => {
    await removeDownload(id);
    await queryClient.invalidateQueries({ queryKey: downloadsQueryKey });
  }, [id, queryClient]);

  return { start, remove, progress, error };
}
