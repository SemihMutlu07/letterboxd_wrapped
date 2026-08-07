import { DEFAULT_LOCALE, isLocale, type Locale } from './locales';

export function localizePath(path: string, locale: Locale): string {
  const url = new URL(path, 'https://movieswrapped.local');
  const segments = url.pathname.split('/').filter(Boolean);
  if (isLocale(segments[0])) segments.shift();
  url.pathname = `/${locale}${segments.length ? `/${segments.join('/')}` : ''}`;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function localePathname(pathname: string, locale: Locale = DEFAULT_LOCALE): string {
  return localizePath(pathname, locale).split(/[?#]/, 1)[0];
}

