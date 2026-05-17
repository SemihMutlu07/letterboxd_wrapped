'use client';

import React from 'react';
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
  const ra = stats.review_analysis;
  if (!ra || ra.reviews_with_text === 0) return null;

  const topWords = (ra.word_frequency ?? []).slice(0, 12);
  const topWordsMax = topWords[0]?.count ?? 0;
  const avgWords = Math.round(ra.avg_review_length_words ?? 0);
  const topLiked = (ra.top_liked_reviews ?? []).filter((r) => r.like_count > 0).slice(0, 3);
  const totalLikes = ra.total_review_likes ?? null;
  const reviewsWithLikesData = ra.reviews_with_likes_data ?? null;

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
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Most used words</p>
            <div className="flex flex-wrap gap-x-3 gap-y-2 items-baseline">
              {topWords.map(({ word, count }, idx) => (
                <span
                  key={word}
                  className={`inline-flex items-baseline gap-1.5 rounded-full px-3 py-1 ${WORD_PALETTE[idx % WORD_PALETTE.length]} ${scaledWordSize(count, topWordsMax)}`}
                >
                  <span>{word}</span>
                  <span className="text-[10px] font-mono opacity-70">×{count}</span>
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Generic review words (film, izledim, güzel…) are filtered so distinctive vocabulary surfaces.
            </p>
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
