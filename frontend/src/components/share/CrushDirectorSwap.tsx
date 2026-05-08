'use client';

import type { SharePersonStat } from './types';

type Props = {
  topActors?: SharePersonStat[];
  topDirectors?: SharePersonStat[];
  crushIndex: number | null;
  directorIndex: number | null;
  onCrushChange: (index: number | null) => void;
  onDirectorChange: (index: number | null) => void;
};

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

export default function CrushDirectorSwap({
  topActors,
  topDirectors,
  crushIndex,
  directorIndex,
  onCrushChange,
  onDirectorChange,
}: Props) {
  const showActors = (topActors?.length ?? 0) > 1;
  const showDirectors = (topDirectors?.length ?? 0) > 1;
  if (!showActors && !showDirectors) return null;

  return (
    <div className="flex justify-center mt-3">
      <div className="flex flex-wrap justify-center gap-4 rounded-xl border border-slate-700/50 bg-slate-800/60 px-4 py-2.5 text-xs">
        {showActors && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Actor:</span>
            <div className="flex gap-1">
              {topActors!.map((a, i) => {
                const active = (crushIndex === null && i === 0) || crushIndex === i;
                return (
                  <button
                    key={a.name}
                    type="button"
                    onClick={() => onCrushChange(crushIndex === i ? null : i)}
                    className={`px-2 py-1 rounded-md font-medium transition-colors truncate max-w-[100px] ${
                      active
                        ? 'bg-pink-500/25 text-pink-300 border border-pink-500/40'
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                    title={`${a.name} (${a.count} films)`}
                  >
                    {lastName(a.name)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {showDirectors && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Director:</span>
            <div className="flex gap-1">
              {topDirectors!.map((d, i) => {
                const active = (directorIndex === null && i === 0) || directorIndex === i;
                return (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => onDirectorChange(directorIndex === i ? null : i)}
                    className={`px-2 py-1 rounded-md font-medium transition-colors truncate max-w-[100px] ${
                      active
                        ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                    title={`${d.name} (${d.count} films)`}
                  >
                    {lastName(d.name)}
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
