import type { Locale } from '@/i18n/locales';
import { localizePath } from '@/i18n/routing';

const USERNAME_RE = /^[a-z0-9_]+$/;

function withLocale(path: string, locale?: Locale): string {
  return locale ? localizePath(path, locale) : path;
}

export function cleanRouteUsername(value: string | null | undefined): string {
  try {
    return decodeURIComponent(value || '').trim().replace(/^@/, '').toLowerCase();
  } catch {
    return '';
  }
}

export function isValidRouteUsername(value: string | null | undefined): value is string {
  return !!value && USERNAME_RE.test(value);
}

export function resultPath(username: string | null | undefined, locale?: Locale): string {
  const clean = cleanRouteUsername(username);
  return withLocale(isValidRouteUsername(clean) ? `/results?u=${encodeURIComponent(clean)}` : '/results', locale);
}

export function storyPath(username: string | null | undefined, locale?: Locale): string {
  const clean = cleanRouteUsername(username);
  return withLocale(isValidRouteUsername(clean) ? `/story?u=${encodeURIComponent(clean)}` : '/story', locale);
}

export function watchlistPath(first: string, second: string, locale?: Locale): string {
  const a = cleanRouteUsername(first);
  const b = cleanRouteUsername(second);
  if (!isValidRouteUsername(a) || !isValidRouteUsername(b) || a === b) return withLocale('/watchlist', locale);
  return withLocale(`/watchlist?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`, locale);
}

export function findFilmPath(users: string[], locale?: Locale): string {
  const clean = [] as string[];
  for (const user of users.map(cleanRouteUsername)) {
    if (isValidRouteUsername(user) && !clean.includes(user)) clean.push(user);
  }
  if (clean.length < 2) return withLocale('/findfilm', locale);
  return withLocale(`/findfilm?users=${encodeURIComponent(clean.slice(0, 6).join(','))}`, locale);
}

export function readFindFilmUsersFromLocation(): string[] {
  if (typeof window === 'undefined') return [];
  const params = new URLSearchParams(window.location.search);
  const raw = (params.get('users') || '').split(',');
  const users: string[] = [];
  for (const value of raw.map(cleanRouteUsername)) {
    if (isValidRouteUsername(value) && !users.includes(value)) users.push(value);
  }
  return users.length >= 2 ? users.slice(0, 6) : [];
}

export function readResultUsernameFromLocation(): string {
  if (typeof window === 'undefined') return '';
  const match = window.location.pathname.match(/^\/(?:en\/|tr\/)?results\/([^/?#]+)/);
  const pathUsername = cleanRouteUsername(match?.[1]);
  if (isValidRouteUsername(pathUsername)) return pathUsername;

  const params = new URLSearchParams(window.location.search);
  const queryUsername = cleanRouteUsername(params.get('u') || params.get('username'));
  return isValidRouteUsername(queryUsername) ? queryUsername : '';
}

export function readWatchlistUsersFromLocation(): [string, string] {
  if (typeof window === 'undefined') return ['', ''];
  const match = window.location.pathname.match(/^\/(?:en\/|tr\/)?watchlist\/([^/?#]+)\/([^/?#]+)/);
  if (match) {
    const first = cleanRouteUsername(match[1]);
    const second = cleanRouteUsername(match[2]);
    if (isValidRouteUsername(first) && isValidRouteUsername(second) && first !== second) {
      return [first, second];
    }
  }

  const params = new URLSearchParams(window.location.search);
  const first = cleanRouteUsername(params.get('a') || params.get('first'));
  const second = cleanRouteUsername(params.get('b') || params.get('second'));
  if (isValidRouteUsername(first) && isValidRouteUsername(second) && first !== second) {
    return [first, second];
  }
  return ['', ''];
}
