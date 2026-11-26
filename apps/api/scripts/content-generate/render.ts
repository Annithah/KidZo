import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { artToSvg } from '@kidzo/art';
import { palette, type ColorName } from '@kidzo/ui-tokens';
import { probe, runFfmpeg, transcode, thumbnail } from '../lib/media-tools';
import type { TtsEngine } from '../lib/tts';
import type { GeneratedVideo } from './data';

const require = createRequire(import.meta.url);
const FONTS = [
  require.resolve('@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.ttf'),
  require.resolve('@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf'),
];

const W = 1280;
const H = 720;
const FPS = 25;

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy word wrap by character count, good enough for short captions. */
export function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}

interface FrameStyle {
  world: ColorName;
  calm: boolean;
}

/** Nested art: artToSvg gives a full SVG; place it at x, y by swapping its root attributes. */
const placeArt = (art: string, x: number, y: number, size: number) =>
  artToSvg(art, size).replace('<svg xmlns="http://www.w3.org/2000/svg" ', `<svg x="${x}" y="${y}" `);

/** One scene as an SVG frame: background, hills or stars, the art, big text and a caption bar. */
export function frameSvg(scene: GeneratedVideo['scenes'][number], style: FrameStyle): string {
  const bg = style.calm ? palette.night[500] : palette[style.world][50];
  const hill = style.calm ? palette.dusk[500] : palette[style.world][200];
  const ink = style.calm ? palette.moon[100] : palette.navy[500];
  const decor = style.calm
    ? Array.from({ length: 24 }, (_, i) => `<circle cx="${(i * 197) % W}" cy="${(i * 89) % 380 + 20}" r="${2 + (i % 3)}" fill="${palette.moon[300]}" opacity="0.7"/>`).join('')
    : `<circle cx="${W - 120}" cy="110" r="70" fill="${palette.star[200]}"/>`;
  const big = scene.big ?? null;
  const art = big ? placeArt(scene.art, 90, 70, 430) : placeArt(scene.art, (W - 440) / 2, 40, 440);
  const bigText = big
    ? (() => {
        const size = big.length <= 3 ? 220 : big.length <= 8 ? 130 : 84;
        return `<text x="${W * 0.71}" y="${300 + size * 0.35}" text-anchor="middle" font-family="Fredoka" font-weight="600" font-size="${size}" fill="${ink}">${esc(big)}</text>`;
      })()
    : '';
  const label = scene.show && !big ? `<text x="${W / 2}" y="505" text-anchor="middle" font-family="Fredoka" font-weight="600" font-size="52" fill="${ink}">${esc(scene.show)}</text>` : '';
  const lines = wrap(scene.say, 46).slice(0, 3);
  const lineH = 48;
  const barH = 36 + lines.length * lineH;
  const barTop = H - barH - 18;
  const barFill = style.calm ? palette.dusk[400] : palette.paper[500];
  const captionInk = style.calm ? palette.moon[100] : palette.navy[500];
  // Baselines centered in the bar: 38 px font sits about 13 px above its baseline's center.
  const captions = lines
    .map((l, i) => `<text x="${W / 2}" y="${barTop + 18 + lineH * i + 36}" text-anchor="middle" font-family="Nunito" font-weight="700" font-size="38" fill="${captionInk}">${esc(l)}</text>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${bg}"/>${decor}
<path d="M0 ${H - 170} Q ${W * 0.25} ${H - 260} ${W * 0.5} ${H - 190} T ${W} ${H - 200} V ${H} H 0 Z" fill="${hill}"/>
${art}${bigText}${label}
<rect x="60" y="${barTop}" width="${W - 120}" height="${barH}" rx="28" fill="${barFill}" opacity="0.94"/>${captions}
</svg>`;
}

export function renderPng(svg: string): Buffer {
  const r = new Resvg(svg, { font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Nunito' }, fitTo: { mode: 'width', value: W } });
  return r.render().asPng();
}

export interface RenderedVideo {
  p720: string;
  p480: string;
  thumb: string;
  durationSeconds: number;
}

/**
 * Renders one generated video: a narrated clip per scene, joined, then the 480p variant and a
 * thumbnail. Calm videos read slower, add a soft low hum (generated here, owned by KIDZO) and
 * fade out gently.
 */
export async function renderVideo(video: GeneratedVideo, style: FrameStyle, tts: TtsEngine, workDir: string): Promise<RenderedVideo> {
  const base = path.join(workDir, video.id);
  const parts: string[] = [];
  const wavs = video.scenes.map((_, i) => `${base}-${i}.wav`);
  // One call for all lines: starting a speech engine per line is the slow part.
  if (tts.synthesizeMany) await tts.synthesizeMany(video.scenes.map((s, i) => ({ text: s.say, outWav: wavs[i] as string })), { calm: style.calm });
  else for (const [i, s] of video.scenes.entries()) await tts.synthesize(s.say, wavs[i] as string, { calm: style.calm });
  for (const [i, scene] of video.scenes.entries()) {
    const png = `${base}-${i}.png`;
    const wav = wavs[i] as string;
    const mp4 = `${base}-${i}.mp4`;
    await writeFile(png, renderPng(frameSvg(scene, style)));
    const speech = await probe(wav).catch(() => ({ durationSeconds: 0 }));
    const seconds = Math.max(2.5, speech.durationSeconds + (style.calm ? 1.6 : 0.9));
    const zoom = style.calm ? '' : `,zoompan=z='min(1+0.0007*on,1.05)':d=1:s=${W}x${H}:fps=${FPS}`;
    await runFfmpeg([
      '-loop', '1', '-framerate', String(FPS), '-t', seconds.toFixed(2), '-i', png,
      '-i', wav,
      '-filter_complex',
      `[0:v]scale=${W}:${H}${zoom},fade=t=in:st=0:d=0.35,fade=t=out:st=${(seconds - 0.35).toFixed(2)}:d=0.35,format=yuv420p[v];` +
        `[1:a]aformat=sample_rates=44100:channel_layouts=stereo,apad,atrim=0:${seconds.toFixed(2)}[a]`,
      '-map', '[v]', '-map', '[a]',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '128k', '-shortest',
      mp4,
    ]);
    parts.push(mp4);
  }
  const list = `${base}-parts.txt`;
  await writeFile(list, parts.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  const joined = `${base}-joined.mp4`;
  await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined]);
  const p720 = `${base}-720.mp4`;
  const total = (await probe(joined)).durationSeconds;
  if (style.calm) {
    // Soft hum under the narration and a slow fade at the end.
    const fadeStart = Math.max(0, total - 2.5).toFixed(2);
    await runFfmpeg([
      '-i', joined,
      '-f', 'lavfi', '-i', `sine=frequency=196:sample_rate=44100:duration=${total + 1}`,
      '-f', 'lavfi', '-i', `sine=frequency=294:sample_rate=44100:duration=${total + 1}`,
      '-filter_complex',
      `[1:a][2:a]amix=inputs=2,volume=0.05,tremolo=f=0.2:d=0.6,aformat=channel_layouts=stereo[pad];` +
        `[0:a][pad]amix=inputs=2:duration=first:weights=1 1,afade=t=out:st=${fadeStart}:d=2.5[a];` +
        `[0:v]fade=t=out:st=${fadeStart}:d=2.5[v]`,
      '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
      p720,
    ]);
  } else {
    await runFfmpeg(['-i', joined, '-c', 'copy', '-movflags', '+faststart', p720]);
  }
  const p480 = `${base}-480.mp4`;
  await transcode(p720, p480, 480, true);
  const thumb = `${base}.jpg`;
  const info = await probe(p720);
  await thumbnail(p720, thumb, info.durationSeconds * 0.3);
  return { p720, p480, thumb, durationSeconds: info.durationSeconds };
}
