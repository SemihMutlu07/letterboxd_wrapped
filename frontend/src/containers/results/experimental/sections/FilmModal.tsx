'use client';

import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface FilmModalProps {
  open: boolean;
  onClose: () => void;
  film: {
    title: string;
    year?: number;
    rating: number;
    communityRating: number;
    director?: string;
    runtime?: number;
    language?: string;
    review_text?: string;
  };
  userAvg: number;
}

export default function FilmModal({ open, onClose, film, userAvg }: FilmModalProps) {
  const diff = ((film.rating ?? 0) - (film.communityRating ?? 0)).toFixed(1);
  const diffSign = parseFloat(diff) > 0 ? '+' : '';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            key="modal"
            role="dialog"
            aria-modal="true"
            aria-label={film.title}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-6 rounded-[28px] border border-white/10 bg-[#111113] p-6 shadow-2xl"
          >
            {/* Header */}
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white leading-tight">{film.title}</h2>
              <p className="text-sm text-slate-400">
                {film.year || '—'} · {film.director || 'Unknown director'}
              </p>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-[#1c1c1e] p-3">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Runtime</p>
                <p className="text-sm font-semibold text-white">{film.runtime ? `${film.runtime} min` : '—'}</p>
              </div>
              <div className="rounded-2xl bg-[#1c1c1e] p-3">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Language</p>
                <p className="text-sm font-semibold text-white">{film.language || '—'}</p>
              </div>
              <div className="rounded-2xl bg-[#1c1c1e] p-3">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Your rating</p>
                <p className="text-sm font-semibold text-orange-400">★ {(film.rating ?? 0).toFixed(1)}</p>
              </div>
            </div>

            {/* Rating comparison */}
            <div className="rounded-2xl border border-white/10 bg-[#1c1c1e] p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Community avg</p>
                  <p className="text-2xl font-bold text-white">★ {(film.communityRating ?? 0).toFixed(1)}</p>
                </div>
                <div className="h-12 w-px bg-white/10" />
                <div className="flex-1 text-right">
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">vs your avg</p>
                  <p className={`text-2xl font-bold ${parseFloat(diff) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {diffSign}{diff}
                  </p>
                </div>
              </div>
            </div>

            {/* Review */}
            {film.review_text && (
              <div className="bg-slate-800/20 rounded-lg p-4 border-l-2 border-orange-400">
                <p className="text-sm text-slate-200 italic">"{film.review_text}"</p>
              </div>
            )}
            {!film.review_text && (
              <div className="bg-slate-800/20 rounded-lg p-4 text-center">
                <p className="text-xs text-slate-500 italic">No written review</p>
              </div>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="mt-4 min-h-11 w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
