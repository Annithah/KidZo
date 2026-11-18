/* eslint-disable import/no-named-as-default-member -- i18next is used through its default instance on purpose */
import i18next from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { LOCALES, type Locale } from '@kidzo/shared';
import { en, type TranslationKey } from './en';
import { fr } from './fr';
import { rw } from './rw';
import { sw } from './sw';

export const resources = {
  en: { translation: en },
  fr: { translation: fr },
  rw: { translation: rw },
  sw: { translation: sw },
} as const;

export function deviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return (LOCALES as readonly string[]).includes(code) ? (code as Locale) : 'en';
}

void i18next.use(initReactI18next).init({
  resources,
  lng: deviceLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function setAppLocale(locale: Locale): void {
  if (i18next.language !== locale) void i18next.changeLanguage(locale);
}

/** Typed translate hook: only known keys compile. */
export function useT() {
  const { t, i18n } = useTranslation();
  const translate = (key: TranslationKey, params?: Record<string, string | number>) => t(key, params ?? {});
  return { t: translate, locale: (i18n.language as Locale) ?? 'en' };
}

export type { TranslationKey };
export default i18next;
