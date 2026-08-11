'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { resultPath } from '@/lib/routes';

type StoryNavigationProps = {
  isLast: boolean;
  username?: string;
  locale: 'en' | 'tr';
  onPrevious: () => void;
  onNext: () => void;
  onReplay: () => void;
};

export function StoryNavigation({
  isLast,
  username,
  locale,
  onPrevious,
  onNext,
  onReplay,
}: StoryNavigationProps) {
  const { t } = useI18n();

  return (
    <>
      <button
        type="button"
        aria-label={t('story.previous')}
        onClick={onPrevious}
        className={`absolute inset-y-0 left-0 w-1/3 cursor-w-resize focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 ${isLast ? 'z-20' : 'z-30'}`}
      />
      <button
        type="button"
        aria-label={t('story.next')}
        onClick={onNext}
        className={`absolute inset-y-0 right-0 w-2/3 cursor-e-resize focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 ${isLast ? 'z-20' : 'z-30'}`}
      />

      {isLast && (
        <div className="absolute inset-x-4 bottom-6 z-50 mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onPrevious}
            className="rounded-full border border-stone-600 bg-black/65 px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-stone-200 backdrop-blur transition-colors hover:border-amber-300 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            {t('story.back')}
          </button>
          <button
            type="button"
            onClick={onReplay}
            className="rounded-full border border-stone-600 bg-black/65 px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-stone-200 backdrop-blur transition-colors hover:border-amber-300 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            {t('story.replay')}
          </button>
          <a
            href={resultPath(username, locale)}
            className="rounded-full bg-amber-300 px-7 py-3 font-mono text-xs font-black uppercase tracking-[0.14em] text-stone-950 shadow-xl shadow-amber-950/20 transition-colors hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
          >
            {t('story.openResults')}
          </a>
        </div>
      )}
    </>
  );
}
