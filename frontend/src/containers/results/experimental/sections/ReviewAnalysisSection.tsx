'use client';

import React, { useMemo, useState } from 'react';
import Section from '@/components/results/Section';
import { getPosterUrl } from '@/lib/analytics';
import { PosterImage } from '@/components/results/Placeholders';
import type { StatsData, ReviewLiker } from '../types';

/** char length used for the "Longest" sort; falls back to raw text length. */
function charLen(r: { char_length?: number; text?: string }): number {
  return r.char_length ?? r.text?.length ?? 0;
}

type Props = { stats: StatsData };
type ReviewSort = 'likes' | 'length';

const WORD_PALETTE = [
  'bg-orange-500/25 text-orange-200',
  'bg-emerald-500/20 text-emerald-200',
  'bg-sky-500/20 text-sky-200',
  'bg-fuchsia-500/20 text-fuchsia-200',
  'bg-amber-500/20 text-amber-200',
  'bg-rose-500/20 text-rose-200',
];

const INITIAL_REVIEW_PAGE = 9;

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
  const [reviewSort, setReviewSort] = useState<ReviewSort>('likes');
  const [reviewPage, setReviewPage] = useState(1);

  const ra = stats.review_analysis;

  const topWords = useMemo(() => (ra?.word_frequency ?? []).slice(0, 12), [ra?.word_frequency]);
  const topWordsMax = topWords[0]?.count ?? 0;
  const avgWords = Math.round(ra?.avg_review_length_words ?? 0);
  const topLiked = useMemo(
    () => (ra?.top_liked_reviews ?? []).filter((r) => r.like_count > 0).slice(0, 3),
    [ra?.top_liked_reviews]
  );
  const totalLikes = ra?.total_review_likes ?? null;
  const reviewsWithLikesData = ra?.reviews_with_likes_data ?? null;

  const allReviews = useMemo(() => ra?.reviews ?? [], [ra?.reviews]);
  const sortedReviews = useMemo(() => {
    return [...allReviews].sort((a, b) => {
      if (reviewSort === 'likes') {
        // Most liked, then longer review as the tie-break.
        return ((b.likes ?? 0) - (a.likes ?? 0)) || (charLen(b) - charLen(a));
      }
      // Longest, strictly by char length, then title for a stable order.
      return (charLen(b) - charLen(a)) || (a.title ?? '').localeCompare(b.title ?? '');
    });
  }, [allReviews, reviewSort]);
  const filteredReviews = useMemo(() => {
    if (!selectedWord) return [];
    return allReviews.filter((r) => r.text?.toLowerCase().includes(selectedWord.toLowerCase()));
  }, [allReviews, selectedWord]);

  const visibleReviewCount = reviewPage * INITIAL_REVIEW_PAGE;
  const paginatedSortedReviews = sortedReviews.slice(0, visibleReviewCount);
  const hasMoreReviews = sortedReviews.length > paginatedSortedReviews.length;
  const subtitleParts = ra ? [`${ra.reviews_with_text} reviews with text`] : [];
  if (totalLikes !== null && totalLikes > 0) {
    subtitleParts.push(`${totalLikes} total likes`);
  }

  if (!ra || ra.reviews_with_text === 0) return null;

  return (
    <Section title="Your Reviews" subtitle={subtitleParts.join(' · ')} animateMode="mount">
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
              <button
                onClick={() => setSelectedWord(null)}
                className="text-xs font-bold px-3 py-1 rounded-full bg-orange-400 text-slate-900 hover:bg-orange-300 transition-colors"
              >
                Clear
              </button>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredReviews.slice(0, 6).map((review, idx) => (
                <FilteredReviewCard key={`${review.title}-${review.year}-${idx}`} review={review} />
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
                return (
                  <li key={`${review.title}-${review.year}-${review.slug ?? ''}`}>
                    <article className="flex h-full gap-3 rounded-xl bg-slate-900/60 p-3 transition-colors duration-150 ease-out hover:bg-slate-900/90">
                      <ReviewPoster posterPath={review.poster_path} title={review.title} />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <header className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block truncate font-semibold text-slate-100 hover:text-orange-200"
                              >
                                {review.title}
                              </a>
                            ) : (
                              <p className="truncate font-semibold text-slate-100">{review.title}</p>
                            )}
                            <p className="text-xs text-slate-500">
                              {review.year || '—'}
                              {review.rating != null ? ` · ★ ${review.rating.toFixed(1)}` : ''}
                              {review.review_date ? ` · ${review.review_date.slice(0, 10)}` : ''}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-bold text-orange-300">
                            ♥ {review.like_count}
                          </span>
                        </header>
                        {review.text_preview && (
                          <p className="mt-1.5 line-clamp-3 text-sm text-slate-300">{review.text_preview}</p>
                        )}
                        <div className="mt-auto pt-2">
                          <LikerRow
                            likeCount={review.like_count}
                            likers={review.likers}
                            complete={review.likers_complete}
                          />
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </details>
        )}

        {sortedReviews.length > 0 && (
          <div className="w-full rounded-xl bg-slate-800/35 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-orange-300">All written reviews</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Sort without extra scraping — likes come from the review listing page.
                </p>
              </div>
              <div className="flex rounded-full border border-slate-700/60 bg-slate-900/60 p-0.5">
                <ReviewSortButton
                  active={reviewSort === 'likes'}
                  onClick={() => { setReviewSort('likes'); setReviewPage(1); }}
                >
                  Most liked
                </ReviewSortButton>
                <ReviewSortButton
                  active={reviewSort === 'length'}
                  onClick={() => { setReviewSort('length'); setReviewPage(1); }}
                >
                  Longest
                </ReviewSortButton>
              </div>
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-3">
              {paginatedSortedReviews.map((review, idx) => (
                <FullReviewCard key={`${review.title}-${review.year}-${idx}`} review={review} />
              ))}
            </ul>
            {hasMoreReviews && (
              <button
                type="button"
                onClick={() => setReviewPage((p) => p + 1)}
                className="mt-4 w-full rounded-lg bg-slate-800/70 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Show more reviews
              </button>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

type ReviewItem = NonNullable<NonNullable<StatsData['review_analysis']>['reviews']>[number];

/** Small poster to the left of a review card; falls back to a placeholder. */
function ReviewPoster({ posterPath, title }: { posterPath?: string; title: string }) {
  const url = posterPath ? getPosterUrl(posterPath, 'grid') : null;
  return (
    <div className="w-14 shrink-0 sm:w-16">
      <div className="aspect-[2/3] overflow-hidden rounded-lg ring-1 ring-white/10">
        <PosterImage src={url} alt={`${title} poster`} />
      </div>
    </div>
  );
}

/** One liker's avatar (image if on the Letterboxd CDN, else initials). */
function LikerAvatar({ liker }: { liker: ReviewLiker }) {
  const label = liker.display_name || liker.username;
  if (liker.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={liker.avatar_url}
        alt={label}
        title={label}
        loading="lazy"
        className="h-6 w-6 rounded-full object-cover ring-2 ring-slate-900"
      />
    );
  }
  return (
    <span
      title={label}
      className="grid h-6 w-6 place-items-center rounded-full bg-slate-700 text-[9px] font-bold text-slate-200 ring-2 ring-slate-900"
    >
      {(label || '?').charAt(0).toUpperCase()}
    </span>
  );
}

/** Liker summary for a review: avatars + expandable name list.
 * Zero likes → "Not yet liked". Likes but no crawled identities →
 * "♥ N · names unavailable" when the crawl was partial. */
function LikerRow({
  likeCount,
  likers,
  complete,
}: {
  likeCount: number;
  likers?: ReviewLiker[];
  complete?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (likeCount <= 0) {
    return <span className="text-[11px] text-slate-500">Not yet liked</span>;
  }

  const list = likers ?? [];
  if (list.length === 0) {
    return (
      <span className="text-[11px] text-slate-400">
        ♥ {likeCount}
        {complete === false ? ' · names unavailable' : ''}
      </span>
    );
  }

  const preview = list.slice(0, 5);
  const extra = likeCount - preview.length;

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group/likers flex items-center gap-2 text-left"
      >
        <span className="flex -space-x-2">
          {preview.map((l) => (
            <LikerAvatar key={l.username} liker={l} />
          ))}
        </span>
        <span className="text-[11px] font-medium text-slate-400 transition-colors group-hover/likers:text-slate-200">
          {extra > 0 ? `+${extra} · ` : ''}Liked by {open ? '↑' : '↓'}
        </span>
      </button>
      {open && (
        <ul className="flex flex-wrap gap-x-2 gap-y-0.5">
          {list.map((l) => (
            <li key={l.username}>
              <a
                href={`https://letterboxd.com/${l.username}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-orange-300 hover:text-orange-200"
              >
                {l.display_name || l.username}
              </a>
            </li>
          ))}
          {complete === false && (
            <li className="text-[11px] text-slate-500">· some names unavailable</li>
          )}
        </ul>
      )}
    </div>
  );
}

/** A single word-filtered review. Long text collapses to 3 lines with a Read more toggle. */
function FilteredReviewCard({ review }: { review: ReviewItem }) {
  const [expanded, setExpanded] = useState(false);
  const text = review.text ?? '';
  // ponytail: char-length proxy for "needs a toggle"; line-clamp-3 ≈ ~200 chars
  const isLong = text.length > 200;

  return (
    <li className="rounded-lg bg-slate-800/50 p-3 hover:bg-slate-800/80 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="font-semibold text-orange-100 text-sm truncate">{review.title}</p>
        <span className="shrink-0 text-xs font-mono text-slate-400">♥ {review.likes || 0}</span>
      </div>
      <p className="text-xs text-slate-400 mb-2">{review.year || '—'}</p>
      <p className={`text-xs text-slate-300 leading-relaxed ${expanded ? 'whitespace-pre-line' : 'line-clamp-3'}`}>
        {text}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-[11px] font-bold text-orange-300 hover:text-orange-200 transition-colors"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </li>
  );
}

function ReviewSortButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
        active
          ? 'bg-orange-400 text-slate-950'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function FullReviewCard({ review }: { review: ReviewItem }) {
  const [expanded, setExpanded] = useState(false);
  const text = review.text ?? '';
  const likes = review.likes ?? 0;
  const wordCount = review.word_count ?? (text.trim() ? text.trim().split(/\s+/).length : 0);
  const isLong = text.length > 260;

  return (
    <li className="flex gap-3 rounded-xl border border-white/[0.04] bg-slate-900/45 p-4 transition-colors hover:bg-slate-900/70">
      <ReviewPoster posterPath={review.poster_path} title={review.title} />
      <div className="min-w-0 flex-1">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">{review.title}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {review.year || '—'}
              {review.rating != null ? ` · ★ ${review.rating.toFixed(1)}` : ''}
              {wordCount > 0 ? ` · ${wordCount} words` : ''}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            likes > 0 ? 'bg-orange-500/20 text-orange-300' : 'bg-slate-800 text-slate-500'
          }`}>
            {likes > 0 ? `♥ ${likes}` : 'Not yet liked'}
          </span>
        </header>
        <p className={`mt-3 text-sm leading-relaxed text-slate-300 ${expanded ? 'whitespace-pre-line' : 'line-clamp-4'}`}>
          {text}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 text-[11px] font-bold text-orange-300 transition-colors hover:text-orange-200"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>
    </li>
  );
}
