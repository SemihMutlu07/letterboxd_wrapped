import { describe, expect, it } from 'vitest';

import { en, tr } from './catalogs';
import { localeFromLanguage } from './locales';
import { localizePath } from './routing';

describe('i18n catalogs and routing', () => {
  it('keeps both catalogs in parity', () => {
    expect(Object.keys(tr).sort()).toEqual(Object.keys(en).sort());
  });

  it('uses Turkish only for Turkish browser locales', () => {
    expect(localeFromLanguage('tr-TR')).toBe('tr');
    expect(localeFromLanguage('en-US')).toBe('en');
    expect(localeFromLanguage(undefined)).toBe('en');
  });

  it('replaces the locale while preserving query and hash', () => {
    expect(localizePath('/en/results?u=semih#reviews', 'tr')).toBe('/tr/results?u=semih#reviews');
    expect(localizePath('/results?u=semih', 'en')).toBe('/en/results?u=semih');
  });
});
