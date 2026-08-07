export const locales = ['en', 'tr'] as const;

export type Locale = (typeof locales)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'mw_locale';

export function isLocale(value: string | null | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export function localeFromLanguage(value: string | null | undefined): Locale {
  return value?.toLowerCase().startsWith('tr') ? 'tr' : DEFAULT_LOCALE;
}

export function localeFromPathname(pathname: string): Locale | null {
  const segment = pathname.split('/').filter(Boolean)[0];
  return isLocale(segment) ? segment : null;
}

