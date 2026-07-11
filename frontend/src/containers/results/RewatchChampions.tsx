'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Repeat } from 'lucide-react';
import Section from '@/components/results/Section';
import { getTmdbImageUrl } from '@/lib/analytics';

interface ChampionFilm {
  title: string;
  year?: number | null;
  poster_path?: string;
  watch_count: number;
}

interface RewatchChampionsProps {
  films: ChampionFilm[];
}

const COLLAPSED = 1;
const EXPANDED_MAX = 3;

export default function RewatchChampions({ films }: RewatchChampionsProps) {
  const [expanded, setExpanded] = useState(false);
  if (!films || films.length === 0) return null;

  const visible = expanded ? Math.min(films.length, EXPANDED_MAX) : Math.min(films.length, COLLAPSED);
  const shown = films.slice(0, visible);
  const canExpand = !expanded && films.length > COLLAPSED;

  return (
    <Section title="Rewatch Champions" subtitle="Films you couldn't watch just once" animateMode="mount">
      <div className="grid gap-3">
        {shown.map((f) => {
          const posterUrl = f.poster_path ? getTmdbImageUrl(f.poster_path, 'w342') : null;
          return (
            <div
              key={`${f.title}-${f.year ?? ''}`}
              className="flex items-center gap-4 rounded-xl border border-slate-700/40 bg-slate-800/40 p-3"
            >
              <div className="relative h-[96px] w-[64px] shrink-0 overflow-hidden rounded-lg bg-slate-900/60">
                {posterUrl ? (
                  <Image
                    src={posterUrl}
                    alt={f.title}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-[10px] font-semibold text-slate-500 text-center px-1">
                    {f.title.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-white truncate">
                  {f.title}
                  {f.year ? <span className="ml-1.5 text-sm font-medium text-slate-400">{f.year}</span> : null}
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <Repeat className="size-3.5" />
                  Watched {f.watch_count}× times
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {canExpand && (
        <div className="flex justify-center pt-3">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-full border border-slate-700/50 px-4 py-2 text-xs font-semibold text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
          >
            Show {Math.min(films.length, EXPANDED_MAX) - COLLAPSED} more
          </button>
        </div>
      )}
    </Section>
  );
}
