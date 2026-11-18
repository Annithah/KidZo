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
