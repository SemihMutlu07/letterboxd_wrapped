'use client';

/**
 * PersonFilmsModal — shows the films a director/actor appears in.
 * Opened from the "+" button on a PersonCard in DirectorsGrid / CastGrid.
 * Reuses the ShareModal backdrop pattern (fixed overlay + click-to-close).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTmdbImageUrl } from '@/lib/analytics';
import { PersonAvatarPlaceholder, PosterImage } from '@/components/results/Placeholders';
import type { PersonFilm } from '../types';

interface PersonFilmsModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  films: PersonFilm[];
  profilePath?: string;
}

const INITIAL_POSTER_PAGE = 12;

export default function PersonFilmsModal({ open, onClose, name, films, profilePath }: PersonFilmsModalProps) {
  const profileUrl = profilePath ? getTmdbImageUrl(profilePath, 'h632') : null;
  const [profileFailed, setProfileFailed] = useState(false);
  const [posterPage, setPosterPage] = useState(1);

  useEffect(() => {
    if (open) {
      setProfileFailed(false);
      setPosterPage(1);
    }
  }, [open, profileUrl]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Highest-rated first, then by year desc; unrated films sink to the bottom.
  const sorted = useMemo(() => {
    return [...films].sort((a, b) => {
      const ra = a.user_rating ?? -1;
      const rb = b.user_rating ?? -1;
      if (rb !== ra) return rb - ra;
      return (b.year ?? '').localeCompare(a.year ?? '');
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
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${name} film shelf`}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-[#f5d7a8]/[0.14] bg-[#17120f] shadow-2xl"
          >
            {/* Header */}
            <div className="relative min-h-[168px] overflow-hidden border-b border-[#f5d7a8]/[0.1]">
              {profileUrl && !profileFailed && (
                <div
                  className="absolute inset-0 scale-110 bg-cover bg-center opacity-25 blur-md"
                  style={{ backgroundImage: `url(${profileUrl})` }}
                />
              )}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(100,180,191,0.18),transparent_35%),linear-gradient(90deg,#17120f_0%,rgba(23,18,15,0.94)_52%,rgba(23,18,15,0.68)_100%)]" />
              <div className="absolute inset-y-0 left-0 w-9 border-r border-[#f5d7a8]/[0.09] bg-black/25">
                <div className="grid h-full grid-rows-4 gap-2 px-2 py-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-[2px] border border-[#f5d7a8]/[0.14] bg-[#f5d7a8]/[0.06]" />
                  ))}
                </div>
              </div>
              <div className="relative z-10 flex h-full items-end justify-between gap-4 px-5 py-5">
                <div className="ml-8 flex min-w-0 flex-1 items-end gap-4">
                  <div className="h-28 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-[#241712] ring-1 ring-[#f5d7a8]/15 shadow-2xl">
                    {profileUrl && !profileFailed ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profileUrl}
                        alt={name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onError={() => setProfileFailed(true)}
                      />
                    ) : (
                      <PersonAvatarPlaceholder />
                    )}
                  </div>
                  <div className="min-w-0 pb-1">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d8b56d]">
                      Film shelf
                    </p>
                    <p className="mt-1 text-2xl font-black leading-tight text-[#fff7ed] md:text-3xl">{name}</p>
                    <p className="mt-1 text-sm text-[#b6a99a]">
                      {films.length} film{films.length !== 1 ? 's' : ''} you watched
                    </p>
                  </div>
                </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="mb-auto grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-[#b6a99a] transition-colors hover:bg-white/[0.08] hover:text-[#fff7ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
              >
                ✕
              </button>
              </div>
            </div>

            {/* Film grid */}
            <div className="grid grid-cols-2 gap-4 overflow-y-auto bg-[linear-gradient(90deg,rgba(245,215,168,0.035)_1px,transparent_1px)] bg-[size:42px_42px] p-5 sm:grid-cols-3">
              {visibleFilms.map((f) => {
                const poster = f.poster_path ? getTmdbImageUrl(f.poster_path, 'w342') : null;
                return (
                  <div key={`${f.title}-${f.year}`} className="space-y-1.5">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-[#241712] ring-1 ring-[#f5d7a8]/10 transition-all duration-150 hover:scale-[1.02] hover:ring-[#ff8a3d]/40 hover:shadow-2xl hover:shadow-black/40">
                      <PosterImage src={poster} alt={`${f.title} poster`} />
                      {f.user_rating != null && (
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-bold text-[#f4cf75]">
                          ★ {f.user_rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-[11px] leading-tight text-[#d6c6b4]">
                      {f.title}
                      {f.year ? <span className="text-[#8d7f70]"> ({f.year})</span> : null}
                    </p>
                  </div>
                );
              })}
              {hasMoreFilms && (
                <button
                  type="button"
                  onClick={() => setPosterPage((p) => p + 1)}
                  className="col-span-full rounded-lg bg-[#241712]/80 py-2.5 text-xs font-bold text-[#d6c6b4] transition-colors hover:bg-[#2d1d16] focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
                >
                  Show more films
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
