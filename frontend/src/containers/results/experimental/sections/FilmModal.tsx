'use client';

import React from 'react';
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
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1a1a1a] border border-white/8 rounded-2xl p-6 max-w-md w-full space-y-4"
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
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Runtime</p>
                <p className="text-sm font-semibold text-white">{film.runtime ? `${film.runtime} min` : '—'}</p>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Language</p>
                <p className="text-sm font-semibold text-white">{film.language || '—'}</p>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Your rating</p>
                <p className="text-sm font-semibold text-orange-400">★ {(film.rating ?? 0).toFixed(1)}</p>
              </div>
            </div>

            {/* Rating comparison */}
            <div className="bg-slate-800/40 rounded-lg p-4 border border-white/4">
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
              className="w-full mt-4 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
