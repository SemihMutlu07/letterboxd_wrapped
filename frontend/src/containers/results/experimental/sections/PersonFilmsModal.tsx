'use client';

/**
 * PersonFilmsModal — shows the films a director/actor appears in.
 * Opened from the "+" button on a PersonCard in DirectorsGrid / CastGrid.
 * Reuses the ShareModal backdrop pattern (fixed overlay + click-to-close).
 */

import React, { useEffect, useState } from 'react';
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

export default function PersonFilmsModal({ open, onClose, name, films, profilePath }: PersonFilmsModalProps) {
  const profileUrl = profilePath ? getTmdbImageUrl(profilePath, 'h632') : null;
  const [profileFailed, setProfileFailed] = useState(false);

  useEffect(() => {
    if (open) setProfileFailed(false);
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
  const sorted = [...films].sort((a, b) => {
    const ra = a.user_rating ?? -1;
    const rb = b.user_rating ?? -1;
    if (rb !== ra) return rb - ra;
    return (b.year ?? '').localeCompare(a.year ?? '');
  });

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
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="relative min-h-[168px] overflow-hidden border-b border-white/[0.06]">
              {profileUrl && !profileFailed && (
                <div
                  className="absolute inset-0 scale-110 bg-cover bg-center opacity-25 blur-md"
                  style={{ backgroundImage: `url(${profileUrl})` }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/90 to-[#141414]/55" />
              <div className="relative z-10 flex h-full items-end justify-between gap-4 px-5 py-5">
                <div className="flex min-w-0 flex-1 items-end gap-4">
                  <div className="h-28 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-800 ring-1 ring-white/10 shadow-2xl">
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
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-300/70">
                      Film shelf
                    </p>
                    <p className="mt-1 text-2xl font-black leading-tight text-white md:text-3xl">{name}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {films.length} film{films.length !== 1 ? 's' : ''} you watched
                    </p>
                  </div>
                </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="mb-auto w-8 h-8 grid place-items-center rounded-full text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors flex-shrink-0"
              >
                ✕
              </button>
              </div>
            </div>

            {/* Film grid */}
            <div className="overflow-y-auto p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {sorted.map((f) => {
                const poster = f.poster_path ? getTmdbImageUrl(f.poster_path, 'w342') : null;
                return (
                  <div key={`${f.title}-${f.year}`} className="space-y-1.5">
                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800 ring-1 ring-white/10 transition-all duration-150 hover:scale-[1.02] hover:ring-orange-400/30 hover:shadow-2xl hover:shadow-black/40">
                      <PosterImage src={poster} alt={`${f.title} poster`} />
                      {f.user_rating != null && (
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-bold text-yellow-400">
                          ★ {f.user_rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 leading-tight line-clamp-2">
                      {f.title}
                      {f.year ? <span className="text-slate-500"> ({f.year})</span> : null}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
