'use client';

import type { ShareCardInput } from '@/components/share/types';
import { useI18n } from '@/i18n/I18nProvider';

import { lastName } from './lastName';

type SwapDrawerProps = {
  cardProps: ShareCardInput;
  hasActors: boolean;
  hasDirectors: boolean;
  actorIdx: number;
  directorIdx: number;
  isSaving: boolean;
  onActorIdxChange: (idx: number) => void;
  onDirectorIdxChange: (idx: number) => void;
};

export function SwapDrawer({
  cardProps,
  hasActors,
  hasDirectors,
  actorIdx,
  directorIdx,
  isSaving,
  onActorIdxChange,
  onDirectorIdxChange,
}: SwapDrawerProps) {
  const { t } = useI18n();

  return (
    <div className="absolute left-0 right-0 bottom-full mx-5 mb-2 md:bottom-auto md:top-full md:mb-0 md:mt-2 z-20 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur px-4 py-3 space-y-2 text-xs">
      {hasActors && (
        <div className="flex items-center gap-2">
          <span className="text-slate-400 w-16 shrink-0">{t('share.actor')}</span>
          <div className="flex items-center gap-1 flex-wrap">
            {cardProps.topActors!.slice(0, 3).map((a, i) => (
              <button
                key={a.name}
                onClick={() => onActorIdxChange(i)}
                disabled={isSaving}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  actorIdx === i
                    ? 'text-pink-300 bg-pink-500/15'
                    : 'text-slate-400 hover:text-slate-200 bg-white/5'
                }`}
              >
                {lastName(a.name)}
              </button>
            ))}
          </div>
        </div>
      )}
      {hasDirectors && (
        <div className="flex items-center gap-2">
          <span className="text-slate-400 w-16 shrink-0">{t('share.director')}</span>
          <div className="flex items-center gap-1 flex-wrap">
            {cardProps.topDirectors!.slice(0, 3).map((d, i) => (
              <button
                key={d.name}
                onClick={() => onDirectorIdxChange(i)}
                disabled={isSaving}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  directorIdx === i
                    ? 'text-cyan-300 bg-cyan-500/15'
                    : 'text-slate-400 hover:text-slate-200 bg-white/5'
                }`}
              >
                {lastName(d.name)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
