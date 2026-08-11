'use client';

import { useI18n } from '@/i18n/I18nProvider';

type StoryPauseButtonProps = {
  isPaused: boolean;
  isLast: boolean;
  onToggle: () => void;
};

export function StoryPauseButton({ isPaused, isLast, onToggle }: StoryPauseButtonProps) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      aria-label={isPaused ? t('story.resumeAria') : t('story.pauseAria')}
      onClick={onToggle}
      disabled={isLast}
      className="absolute right-4 top-8 z-50 rounded-full border border-white/15 bg-black/55 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-stone-200 shadow-xl backdrop-blur transition-colors hover:border-amber-300 hover:text-amber-200 disabled:cursor-default disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
    >
      {isPaused ? t('story.resume') : t('story.pause')}
    </button>
  );
}
