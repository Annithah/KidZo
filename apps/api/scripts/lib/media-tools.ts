import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

/**
 * Thin wrapper around the FFmpeg and ffprobe binaries from the ffmpeg-static and
 * ffprobe-static packages (FFMPEG_PATH / FFPROBE_PATH override them). Used by the content
 * import and generation scripts only; the API server never runs FFmpeg.
 */

const require = createRequire(import.meta.url);

function binary(envVar: string, pkg: string, pick: (mod: unknown) => string | null): string {
  const fromEnv = process.env[envVar];
  if (fromEnv) return fromEnv;
  try {
    const found = pick(require(pkg));
    if (found) return found;
  } catch {
    // Fall through to the error below.
  }
  throw new Error(`${pkg} is not installed. Run pnpm install, or set ${envVar} to an FFmpeg binary.`);
}

export const ffmpegPath = () => binary('FFMPEG_PATH', 'ffmpeg-static', (m) => m as string | null);
export const ffprobePath = () => binary('FFPROBE_PATH', 'ffprobe-static', (m) => (m as { path: string }).path);

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function run(bin: string, args: string[], options: { timeoutMs?: number } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
      // Keep only the tail; FFmpeg progress output can be large.
      if (stderr.length > 20_000) stderr = stderr.slice(-10_000);
    });
    const timer = options.timeoutMs ? setTimeout(() => child.kill('SIGKILL'), options.timeoutMs) : null;
    child.on('error', reject);
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

async function ffmpeg(args: string[], timeoutMs = 15 * 60_000): Promise<void> {
  const res = await run(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-y', ...args], { timeoutMs });
  if (res.code !== 0) throw new Error(`ffmpeg failed (${res.code}): ${res.stderr.trim().split('\n').slice(-3).join(' | ')}`);
}

export interface ProbeInfo {
  durationSeconds: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

/** Reads duration, size and whether there is an audio track. Works on files and http(s) URLs. */
export async function probe(input: string): Promise<ProbeInfo> {
  const res = await run(ffprobePath(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input], { timeoutMs: 120_000 });
  if (res.code !== 0) throw new Error(`ffprobe failed: ${res.stderr.trim().slice(0, 300)}`);
  const data = JSON.parse(res.stdout) as {
    format?: { duration?: string };
    streams?: { codec_type?: string; width?: number; height?: number; duration?: string }[];
  };
  const video = data.streams?.find((s) => s.codec_type === 'video');
  const duration = Number(data.format?.duration ?? video?.duration ?? 0);
  return {
    durationSeconds: Math.round(duration),
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    hasAudio: !!data.streams?.some((s) => s.codec_type === 'audio'),
  };
}

/**
 * H.264 + AAC MP4 at a given height, fast start for streaming. Audio is dropped when
 * `keepAudio` is false (music with unclear rights).
 */
export async function transcode(input: string, output: string, height: 480 | 720, keepAudio: boolean, maxSeconds?: number): Promise<void> {
  await ffmpeg([
    '-i', input,
    ...(maxSeconds ? ['-t', String(maxSeconds)] : []),
    '-vf', `scale=-2:${height}:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', height === 720 ? '23' : '26', '-profile:v', 'main',
    ...(keepAudio ? ['-c:a', 'aac', '-b:a', '128k', '-ac', '2'] : ['-an']),
    '-movflags', '+faststart',
    '-threads', '2',
    output,
  ]);
}

/** One JPG frame at `atSeconds`, 720 pixels tall at most. */
export async function thumbnail(input: string, output: string, atSeconds: number): Promise<void> {
  await ffmpeg(['-ss', String(Math.max(0, atSeconds)), '-i', input, '-frames:v', '1', '-vf', 'scale=-2:min(720\\,ih)', '-q:v', '3', output]);
}

export { ffmpeg as runFfmpeg };
