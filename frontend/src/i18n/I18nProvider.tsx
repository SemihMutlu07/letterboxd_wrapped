'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { catalogs, type MessageKey } from './catalogs';
import type { Locale } from './locales';

type I18nValue = {
  locale: Locale;
  t: (key: MessageKey) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nValue>(() => ({
    locale,
    t: (key) => catalogs[locale][key],
    formatNumber: (number, options) => new Intl.NumberFormat(locale, options).format(number),
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

