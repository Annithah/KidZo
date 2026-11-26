import * as Speech from 'expo-speech';
import type { Locale } from '@kidzo/shared';

const VOICE_LANG: Record<Locale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  sw: 'sw-KE',
  rw: 'rw-RW',
};

/** Reads text aloud with a gentle child friendly pace. Stops anything already playing. */
export async function speak(
  text: string,
  locale: Locale,
  options: { calm?: boolean; onStart?: () => void; onDone?: () => void } = {},
): Promise<void> {
  await Speech.stop();
  options.onStart?.();
  Speech.speak(text, {
    language: VOICE_LANG[locale],
    rate: options.calm ? 0.8 : 0.92,
    pitch: options.calm ? 0.95 : 1.08,
    onDone: options.onDone,
    onStopped: options.onDone,
    onError: () => options.onDone?.(),
  });
}

export function stopSpeaking(): void {
  void Speech.stop();
}

/**
 * Speaks and resolves when the voice has finished (or failed). A safety limit makes sure a
 * missing "done" event from the speech engine can never hold the app forever.
 */
export function speakAndWait(text: string, locale: Locale, options: { calm?: boolean; maxMs?: number } = {}): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(limit);
      resolve();
    };
    const limit = setTimeout(finish, options.maxMs ?? 20_000);
    void speak(text, locale, { calm: options.calm, onDone: finish }).catch(finish);
  });
}
