'use client';

import { usePathname, useSearchParams } from 'next/navigation';

import { useI18n } from '@/i18n/I18nProvider';
import { LOCALE_STORAGE_KEY, type Locale } from '@/i18n/locales';
import { localizePath } from '@/i18n/routing';

export default function LanguageSwitcher() {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const { locale, t } = useI18n();

  const selectLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    const query = searchParams.toString();
    const hash = window.location.hash;
    window.location.assign(localizePath(`${pathname}${query ? `?${query}` : ''}${hash}`, nextLocale));
  };

  return (
    <div className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[90] rounded-full border border-white/10 bg-[#111820]/90 p-1 shadow-lg backdrop-blur-md">
      <span className="sr-only">{t('language.label')}</span>
      {(['en', 'tr'] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => selectLocale(item)}
          aria-pressed={locale === item}
          aria-label={item === 'en' ? t('language.english') : t('language.turkish')}
          className={`min-h-9 min-w-11 rounded-full px-3 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
            locale === item ? 'bg-white text-[#17202a]' : 'text-white/65 hover:text-white'
          }`}
        >
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

