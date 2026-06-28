'use client';

import React, { useState } from 'react';
import Section from '@/components/results/Section';
import type { StatsData } from '../types';

type Props = { stats: StatsData };

const WORD_PALETTE = [
  'bg-orange-500/25 text-orange-200',
  'bg-emerald-500/20 text-emerald-200',
  'bg-sky-500/20 text-sky-200',
  'bg-fuchsia-500/20 text-fuchsia-200',
  'bg-amber-500/20 text-amber-200',
  'bg-rose-500/20 text-rose-200',
];

function scaledWordSize(count: number, max: number): string {
  if (max <= 0) return 'text-sm';
  const ratio = count / max;
  if (ratio > 0.85) return 'text-2xl font-black';
  if (ratio > 0.6) return 'text-xl font-bold';
  if (ratio > 0.35) return 'text-lg font-semibold';
  if (ratio > 0.15) return 'text-base font-medium';
  return 'text-sm font-medium';
}

export default function ReviewAnalysisSection({ stats }: Props) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const ra = stats.review_analysis;
  if (!ra || ra.reviews_with_text === 0) return null;

  const topWords = (ra.word_frequency ?? []).slice(0, 12);
  const topWordsMax = topWords[0]?.count ?? 0;
  const avgWords = Math.round(ra.avg_review_length_words ?? 0);
  const topLiked = (ra.top_liked_reviews ?? []).filter((r) => r.like_count > 0).slice(0, 3);
  const totalLikes = ra.total_review_likes ?? null;
  const reviewsWithLikesData = ra.reviews_with_likes_data ?? null;

  const allReviews = (ra.reviews ?? []);
  const filteredReviews = selectedWord
    ? allReviews.filter((r) => r.text?.toLowerCase().includes(selectedWord.toLowerCase()))
    : [];

  const subtitleParts = [`${ra.reviews_with_text} reviews with text`];
  if (totalLikes !== null && totalLikes > 0) {
    subtitleParts.push(`${totalLikes} total likes`);
  }

  return (
    <Section title="Your Reviews" subtitle={subtitleParts.join(' · ')}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 items-start w-full">
        <div className="bg-slate-800/50 rounded-xl p-3 sm:p-4 min-w-0">
          <p className="text-2xl sm:text-3xl font-bold text-orange-400 tabular-nums">{ra.reviews_with_text}</p>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">reviews written</p>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-3 sm:p-4 min-w-0">
          <p className="text-2xl sm:text-3xl font-bold text-orange-400 tabular-nums">{avgWords}</p>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">avg words / review</p>
        </div>

        {totalLikes !== null && totalLikes > 0 && (
          <div className="col-span-2 sm:col-span-1 bg-slate-800/50 rounded-xl p-3 sm:p-4 min-w-0">
            <p className="text-2xl sm:text-3xl font-bold text-orange-400 tabular-nums">{totalLikes}</p>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">likes on your reviews</p>
            {reviewsWithLikesData !== null && reviewsWithLikesData > 0 && (
              <p className="mt-2 text-[10px] sm:text-[11px] text-slate-500 leading-snug">
                Sum across {reviewsWithLikesData} reviews
                {' · '}
                avg {(totalLikes / reviewsWithLikesData).toFixed(1)} per review.
                Counts likes <em>received</em>, never likes you gave.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-3 items-start mt-4 w-full">

        {topWords.length > 0 && (
          <div className="w-full">
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Most used words · tap to filter</p>
            <div className="flex flex-wrap gap-x-3 gap-y-2 items-baseline">
              {topWords.map(({ word, count }, idx) => {
                const isSelected = selectedWord === word;
                return (
                  <button
                    key={word}
                    onClick={() => setSelectedWord(isSelected ? null : word)}
                    className={`inline-flex items-baseline gap-1.5 rounded-full px-3 py-1 transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-orange-400 bg-orange-500/40 text-orange-100 font-bold'
                        : `${WORD_PALETTE[idx % WORD_PALETTE.length]} hover:opacity-80`
                    } ${scaledWordSize(count, topWordsMax)}`}
                  >
                    <span>{word}</span>
                    <span className="text-[10px] font-mono opacity-70">×{count}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Generic review words (film, izledim, güzel…) are filtered so distinctive vocabulary surfaces.
            </p>
          </div>
        )}

        {selectedWord && filteredReviews.length > 0 && (
          <div className="w-full mt-4">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-orange-500/20 px-4 py-3 mb-3">
              <p className="text-sm font-semibold text-orange-200">
                Filtering: "<span className="font-mono">{selectedWord}</span>" · {filteredReviews.length} review{filteredReviews.length === 1 ? '' : 's'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRevealed(!revealed)}
                  className="text-xs font-bold px-3 py-1 rounded-full bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                >
                  {revealed ? 'HIDE' : 'REVEAL'}
                </button>
                <button
                  onClick={() => setSelectedWord(null)}
                  className="text-xs font-bold px-3 py-1 rounded-full bg-orange-400 text-slate-900 hover:bg-orange-300 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredReviews.slice(0, 6).map((review, idx) => (
                <li
                  key={`${review.title}-${review.year}-${idx}`}
                  className="rounded-lg bg-slate-800/50 p-3 hover:bg-slate-800/80 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="font-semibold text-orange-100 text-sm truncate">{review.title}</p>
                    <span className="shrink-0 text-xs font-mono text-slate-400">♥ {review.likes || 0}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{review.year || '—'}</p>
                  <p
                    className="text-xs text-slate-300 line-clamp-3 leading-relaxed"
                    style={{ filter: revealed ? 'none' : 'blur(4px)', transition: 'filter 200ms' }}
                  >
                    {review.text}
                  </p>
                  {!revealed && (
                    <p className="text-[10px] text-slate-500 mt-1">Review text hidden · hit REVEAL to show it</p>
                  )}
                </li>
              ))}
            </ul>
            {filteredReviews.length > 6 && (
              <p className="mt-2 text-[11px] text-slate-500">
                Showing 6 of {filteredReviews.length} reviews
              </p>
            )}
          </div>
        )}

        {selectedWord && filteredReviews.length === 0 && (
          <div className="w-full mt-4 text-center py-4">
            <p className="text-sm text-slate-400">
              No reviews found containing "<span className="font-mono">{selectedWord}</span>"
            </p>
            <button
              onClick={() => setSelectedWord(null)}
              className="mt-2 text-xs font-bold px-3 py-1 rounded-full bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
            >
              Clear filter
            </button>
          </div>
        )}

        {topLiked.length > 0 && (
          <details className="group w-full rounded-xl bg-slate-800/40 open:bg-slate-800/60">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors duration-150 ease-out hover:bg-slate-800/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400">
              <div className="flex items-baseline gap-3">
                <p className="text-xs uppercase tracking-widest text-orange-300">Top 3 most-liked reviews</p>
                <p className="text-[11px] text-slate-500">tap to expand</p>
              </div>
              <svg
                aria-hidden="true"
                viewBox="0 0 12 12"
                width="14"
                height="14"
                className="shrink-0 text-slate-400 transition-transform duration-150 ease-out group-open:rotate-180"
              >
                <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <ul className="grid gap-3 px-4 pb-4 pt-2 sm:grid-cols-2">
              {topLiked.map((review) => {
                const slug = review.slug?.replace(/^\/film\/|\/$/g, '');
                const href = slug && stats.scraped_username
                  ? `https://letterboxd.com/${stats.scraped_username}/film/${slug}/`
                  : slug
                  ? `https://letterboxd.com/film/${slug}/`
                  : null;
                const card = (
                  <article className="h-full rounded-xl bg-slate-900/60 p-4 transition-colors duration-150 ease-out hover:bg-slate-900/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400">
                    <header className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-100">{review.title}</p>
                        <p className="text-xs text-slate-500">
                          {review.year || '—'}
                          {review.review_date ? ` · ${review.review_date.slice(0, 10)}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-bold text-orange-300">
                        ♥ {review.like_count}
                      </span>
                    </header>
                    {review.text_preview && (
                      <p className="mt-2 line-clamp-3 text-sm text-slate-300">{review.text_preview}</p>
                    )}
                  </article>
                );
                return (
                  <li key={`${review.title}-${review.year}-${review.slug ?? ''}`}>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">
                        {card}
                      </a>
                    ) : (
                      card
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </div>
    </Section>
  );
}
