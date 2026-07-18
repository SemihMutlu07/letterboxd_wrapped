'use client';

/**
 * LangModal — shows films in a specific language.
 * Opened from clicking a language row in LanguagesLeaderboard.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDirectTmdbImageUrl } from '@/lib/analytics';
import { PosterImage } from '@/components/results/Placeholders';

interface Film {
  title: string;
  year?: number;
  your_rating?: number | null;
  poster_path?: string;
}

interface LangModalProps {
  open: boolean;
  onClose: () => void;
  language: string;
  languageLabel?: string;
  count: number;
  films: Film[];
}

const INITIAL_POSTER_PAGE = 15;

export default function LangModal({ open, onClose, language, languageLabel, count, films }: LangModalProps) {
  const [posterPage, setPosterPage] = useState(1);

  useEffect(() => {
    if (open) setPosterPage(1);
  }, [open, language]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const sorted = useMemo(() => {
    return [...films].sort((a, b) => {
      const ratingDiff = (b.your_rating ?? -1) - (a.your_rating ?? -1);
      if (ratingDiff !== 0) return ratingDiff;
      return (b.year ?? 0) - (a.year ?? 0);
    });
  }, [films]);
  const visibleCount = posterPage * INITIAL_POSTER_PAGE;
  const visibleFilms = sorted.slice(0, visibleCount);
  const hasMoreFilms = sorted.length > visibleFilms.length;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${languageLabel || language} films`}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative flex max-h-[84vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#111113] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Language</p>
                <p className="text-lg font-bold text-white">{languageLabel || language}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {count} film{count !== 1 ? 's' : ''} watched
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                ✕
              </button>
            </div>

            {/* Film grid */}
            <div className="overflow-y-auto flex-1 p-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {visibleFilms.map((f, idx) => {
                const poster = f.poster_path ? getDirectTmdbImageUrl(f.poster_path, 'w342') : null;
                return (
                  <div
                    key={`${f.title}-${idx}`}
                    className="group min-w-0"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[#1c1c1e] ring-1 ring-white/10 transition-colors group-hover:ring-white/25">
                      <PosterImage src={poster} alt={`${f.title} poster`} />
                      {f.your_rating != null && (
                        <span className="absolute bottom-2 right-2 rounded-full bg-black/75 px-2 py-0.5 text-xs font-bold text-orange-300">
                          ★ {f.your_rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs font-semibold leading-tight text-white">{f.title || '—'}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{f.year || '—'}</p>
                  </div>
                );
              })}
              {hasMoreFilms && (
                <button
                  type="button"
                  onClick={() => setPosterPage((p) => p + 1)}
                  className="col-span-full rounded-lg bg-slate-800/70 py-2.5 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
                >
                  Show more films
                </button>
              )}
              </div>
              {count > films.length && (
                <div className="text-xs text-slate-500 italic pt-2">
                  + {count - films.length} more in your diary
                </div>
              )}
            </div>

            {/* Close button */}
            <div className="border-t border-white/[0.06] px-5 py-3">
              <button
                onClick={onClose}
                className="min-h-11 w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
