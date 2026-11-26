import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { run, runFfmpeg } from './media-tools';

/**
 * Text to speech behind one interface, so the generator does not care which engine speaks.
 * - windows: the speech voices built into Windows (System.Speech), English only.
 * - espeak: espeak-ng when installed (many languages, robotic).
 * - piper: a piper binary and voice model (natural voices), set PIPER_BIN and PIPER_MODEL.
 * - none: silence of a reading-speed length, for machines without any voice.
 * Choose with KIDZO_TTS=windows|espeak|piper|none; the default picks the first available.
 */
export interface TtsEngine {
  id: 'windows' | 'espeak' | 'piper' | 'none';
  /** Writes a WAV file. `calm` reads slower and softer for bedtime. */
  synthesize(text: string, outWav: string, options: { calm?: boolean }): Promise<void>;
  /** Optional faster path for engines with a slow start: many lines in one call. */
  synthesizeMany?(items: { text: string; outWav: string }[], options: { calm?: boolean }): Promise<void>;
}

const psQuote = (v: string) => `'${v.replace(/'/g, "''")}'`;

const windows: TtsEngine = {
  id: 'windows',
  async synthesize(text, outWav, options) {
    await windows.synthesizeMany?.([{ text, outWav }], options);
  },
  async synthesizeMany(items, { calm }) {
    const script = [
      'Add-Type -AssemblyName System.Speech',
      '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
      // Zira is the softer of the two built-in voices; fall back to the default voice.
      "try { $s.SelectVoice('Microsoft Zira Desktop') } catch {}",
      `$s.Rate = ${calm ? -3 : -1}`,
      `$s.Volume = ${calm ? 80 : 100}`,
      ...items.flatMap((it) => [`$s.SetOutputToWaveFile(${psQuote(it.outWav)})`, `$s.Speak(${psQuote(it.text)})`]),
      '$s.SetOutputToNull()',
      '$s.Dispose()',
    ].join('; ');
    const res = await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { timeoutMs: 120_000 });
    const missing = items.find((it) => !existsSync(it.outWav));
    if (res.code !== 0 || missing) throw new Error(`Windows speech failed: ${res.stderr.slice(0, 200)}`);
  },
};

const espeak: TtsEngine = {
  id: 'espeak',
  async synthesize(text, outWav, { calm }) {
    const res = await run(process.env.ESPEAK_BIN ?? 'espeak-ng', ['-v', 'en-us+f3', '-s', calm ? '120' : '145', '-w', outWav, text], { timeoutMs: 60_000 });
    if (res.code !== 0) throw new Error(`espeak-ng failed: ${res.stderr.slice(0, 200)}`);
  },
};

const piper: TtsEngine = {
  id: 'piper',
  async synthesize(text, outWav, { calm }) {
    const bin = process.env.PIPER_BIN;
    const model = process.env.PIPER_MODEL;
    if (!bin || !model) throw new Error('Set PIPER_BIN and PIPER_MODEL to use piper');
    const txt = `${outWav}.txt`;
    await writeFile(txt, text);
    const res = await run(bin, ['--model', model, '--output_file', outWav, '--length_scale', calm ? '1.25' : '1.05', '--input_file', txt], { timeoutMs: 120_000 });
    if (res.code !== 0) throw new Error(`piper failed: ${res.stderr.slice(0, 200)}`);
  },
};

const none: TtsEngine = {
  id: 'none',
  async synthesize(text, outWav, { calm }) {
    // About 2.5 words a second (slower when calm), so on-screen text stays up long enough to read.
    const seconds = Math.max(2, text.split(/\s+/).length / (calm ? 2 : 2.5));
    await runFfmpeg(['-f', 'lavfi', '-i', `anullsrc=r=22050:cl=mono`, '-t', seconds.toFixed(2), outWav]);
  },
};

async function available(engine: TtsEngine['id']): Promise<boolean> {
  if (engine === 'windows') return process.platform === 'win32';
  if (engine === 'espeak') return (await run(process.env.ESPEAK_BIN ?? 'espeak-ng', ['--version']).catch(() => ({ code: 1 }))).code === 0;
  if (engine === 'piper') return !!process.env.PIPER_BIN && !!process.env.PIPER_MODEL;
  return true;
}

export async function pickTts(preferred = process.env.KIDZO_TTS): Promise<TtsEngine> {
  const engines = { windows, espeak, piper, none };
  if (preferred) {
    const engine = engines[preferred as TtsEngine['id']];
    if (!engine) throw new Error(`KIDZO_TTS must be windows, espeak, piper or none (got "${preferred}")`);
    if (!(await available(engine.id))) throw new Error(`KIDZO_TTS=${preferred} is not available on this machine`);
    return engine;
  }
  for (const id of ['piper', 'windows', 'espeak'] as const) if (await available(id)) return engines[id];
  return none;
}
