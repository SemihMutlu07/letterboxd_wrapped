'use client';

import type { SharePersonStat } from './types';

type Props = {
  topActors?: SharePersonStat[];
  topDirectors?: SharePersonStat[];
  actorIdx: number;
  directorIdx: number;
  onActorIdxChange: (index: number) => void;
  onDirectorIdxChange: (index: number) => void;
};

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

export default function CrushDirectorSwap({
  topActors,
  topDirectors,
  actorIdx,
  directorIdx,
  onActorIdxChange,
  onDirectorIdxChange,
}: Props) {
  const hasActors = (topActors?.length ?? 0) >= 1;
  const hasDirectors = (topDirectors?.length ?? 0) >= 1;
  if (!hasActors && !hasDirectors) return null;

  return (
    <div className="flex justify-center mt-3">
      <div className="flex flex-wrap justify-center gap-4 rounded-xl border border-slate-700/50 bg-slate-800/60 px-4 py-2.5 text-xs">
        {hasActors && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium shrink-0">Actor:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {topActors!.map((a, i) => {
                const active = actorIdx === i;
                const label = `${i + 1}. ${lastName(a.name)}`;
                return (
                  <button
                    key={a.name}
                    type="button"
                    onClick={() => onActorIdxChange(i)}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-pink-500/25 text-pink-300 border border-pink-500/40'
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                    title={`${i + 1}. ${a.name} (${a.count} films)`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {hasDirectors && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium shrink-0">Director:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {topDirectors!.map((d, i) => {
                const active = directorIdx === i;
                const label = `${i + 1}. ${lastName(d.name)}`;
                return (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => onDirectorIdxChange(i)}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                    title={`${i + 1}. ${d.name} (${d.count} films)`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
