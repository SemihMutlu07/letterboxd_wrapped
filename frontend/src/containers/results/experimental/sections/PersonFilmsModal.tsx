'use client';

/**
 * PersonFilmsModal — shows the films a director/actor appears in.
 * Opened from the "+" button on a PersonCard in DirectorsGrid / CastGrid.
 * Reuses the ShareModal backdrop pattern (fixed overlay + click-to-close).
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTmdbImageUrl } from '@/lib/analytics';
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
            className="relative w-full max-w-lg max-h-[80vh] flex flex-col bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                {profileUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileUrl}
                    alt={name}
                    loading="lazy"
                    className="w-16 h-24 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-base font-bold text-white">{name}</p>
                  <p className="text-xs text-slate-500">
                    {films.length} film{films.length !== 1 ? 's' : ''} you watched
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 grid place-items-center rounded-full text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors flex-shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Film grid */}
            <div className="overflow-y-auto p-5 grid grid-cols-3 sm:grid-cols-4 gap-3">
              {sorted.map((f) => {
                const poster = f.poster_path ? getTmdbImageUrl(f.poster_path, 'w342') : null;
                return (
                  <div key={`${f.title}-${f.year}`} className="space-y-1.5">
                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800 ring-1 ring-white/10">
                      {poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={poster}
                          alt={f.title}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-center px-1 text-[10px] font-bold text-slate-500">
                          {f.title}
                        </div>
                      )}
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
