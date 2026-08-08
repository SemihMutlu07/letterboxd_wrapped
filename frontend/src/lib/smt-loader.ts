import { resultPath } from '@/lib/routes';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isLocale, localeFromLanguage, type Locale } from '@/i18n/locales';

type FixtureResponse = {
  username?: string;
  summary?: { details?: unknown };
  error?: string;
};

export function resolveFixtureLocale(
  storage: Storage = globalThis.localStorage,
  navigatorLike: { languages?: readonly string[]; language?: string } = globalThis.navigator,
): Locale {
  try {
    const stored = storage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // storage unavailable (privacy mode) — fall through to system language
  }
  return localeFromLanguage(navigatorLike.languages?.[0] ?? navigatorLike.language);
}

export async function loadSmtFixture(
  fetchFixture: typeof fetch = fetch,
  storage: Storage = globalThis.localStorage,
  navigate: (url: string) => void = (url) => window.location.replace(url),
  locale: Locale = resolveFixtureLocale(storage),
) {
  const response = await fetchFixture('/.dev/smt-fixture.json', { cache: 'no-store' });
  const payload = (await response.json()) as FixtureResponse;
  const stats = payload.summary?.details;
  if (!response.ok || !stats || !payload.username) {
    throw new Error(payload.error || 'The local fixture response was incomplete.');
  }
  storage.setItem('letterboxdStats', JSON.stringify(stats));
  storage.setItem('username', payload.username);
  storage.setItem('lb_username', payload.username);
  navigate(resultPath(payload.username, locale));
}
