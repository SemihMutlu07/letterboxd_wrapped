'use client';

import React, { useMemo, useState } from 'react';
import Section from '@/components/results/Section';
import type { ReviewLiker, StatsData } from '../types';
import { reviewCharLength, reviewDateLabel, reviewWordCount } from '@/lib/reviews';

type Props = { stats: StatsData };
type ReviewSort = 'likes' | 'length' | 'recent' | 'gems';
type ReviewAnalysisWithLikers = NonNullable<StatsData['review_analysis']> & {
  total_unique_likers?: number;
  top_recurring_likers?: ReviewLiker[];
  socially_active_reviews?: { title?: string; year?: string; review_url?: string | null; like_count?: number; liked_by?: ReviewLiker[] }[];
};
/** Minimum word count for a 0-like review to count as a "hidden gem". */
const GEM_MIN_WORDS = 40;

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

  const ra = stats.review_analysis as ReviewAnalysisWithLikers | undefined;

  const topWords = useMemo(() => (ra?.word_frequency ?? []).slice(0, 12), [ra?.word_frequency]);
  const topWordsMax = topWords[0]?.count ?? 0;
  const avgWords = Math.round(ra?.avg_review_length_words ?? 0);
  const topLiked = useMemo(
    () => (ra?.top_liked_reviews ?? []).filter((r) => r.like_count > 0).slice(0, 3),
    [ra?.top_liked_reviews],
  );
  const totalLikes = ra?.total_review_likes ?? null;
  const reviewsWithLikesData = ra?.reviews_with_likes_data ?? null;

  const allReviews = useMemo(() => ra?.reviews ?? [], [ra?.reviews]);
  const featuredReview = useMemo(
    () => allReviews.reduce<ReviewItem | null>(
      (best, review) => (!best || reviewCharLength(review) > reviewCharLength(best) ? review : best),
      null,
    ),
    [allReviews],
  );
  const hiddenGems = useMemo(
    () => allReviews
      .filter((review) => (review.likes ?? 0) === 0 && reviewWordCount(review) >= GEM_MIN_WORDS)
      .sort((a, b) => reviewWordCount(b) - reviewWordCount(a))
      .slice(0, 3),
    [allReviews],
  );
  const hasDates = allReviews.some((r) => reviewDateLabel(r));
  const sortedReviews = useMemo(() => {
    const isGem = (r: (typeof allReviews)[number]) =>
      (r.likes ?? 0) === 0 && reviewWordCount(r) >= GEM_MIN_WORDS;
    return [...allReviews].sort((a, b) => {
      if (reviewSort === 'likes') {
        return (b.likes ?? 0) - (a.likes ?? 0);
      }
      if (reviewSort === 'recent') {
        return new Date(reviewDateLabel(b) ?? 0).getTime() - new Date(reviewDateLabel(a) ?? 0).getTime();
      }
      if (reviewSort === 'gems') {
        const aGem = isGem(a);
        const bGem = isGem(b);
        if (aGem !== bGem) return aGem ? -1 : 1;
        return reviewWordCount(b) - reviewWordCount(a);
      }
      return reviewCharLength(b) - reviewCharLength(a);
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
    <Section title="Your Reviews" subtitle={subtitleParts.join(' · ')}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 items-start w-full">
        <div className="results-stat min-w-0 rounded-2xl">
          <p className="text-3xl font-semibold tabular-nums text-[var(--results-text)]">{ra.reviews_with_text}</p>
          <p className="mt-1 text-sm text-[var(--results-muted)]">reviews written</p>
        </div>

        <div className="results-stat min-w-0 rounded-2xl">
          <p className="text-3xl font-semibold tabular-nums text-[var(--results-text)]">{avgWords}</p>
          <p className="mt-1 text-sm text-[var(--results-muted)]">avg words / review</p>
        </div>

        {totalLikes !== null && totalLikes > 0 && (
          <div className="results-stat col-span-2 min-w-0 rounded-2xl sm:col-span-1">
            <p className="text-3xl font-semibold tabular-nums text-[var(--results-text)]">{totalLikes}</p>
            <p className="mt-1 text-sm text-[var(--results-muted)]">likes on your reviews</p>
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
              {topWords.map(({ word, count }) => {
                const isSelected = selectedWord === word;
                return (
                  <button
                    key={word}
                    onClick={() => setSelectedWord(isSelected ? null : word)}
                    className={`inline-flex items-baseline gap-1.5 rounded-full px-3 py-1 transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-orange-400 bg-orange-500/40 text-orange-100 font-bold'
                        : 'border border-[var(--results-border)] text-[var(--results-text)] hover:bg-[color-mix(in_srgb,var(--results-text)_7%,transparent)]'
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
          <div className="w-full border-t border-[var(--results-border)] pt-6">
            <div className="flex items-baseline gap-3">
                <p className="text-xs uppercase tracking-widest text-orange-300">Top 3 most-liked reviews</p>
                <p className="text-[11px] text-[var(--results-muted)]">Based on public likes</p>
            </div>
            <ul className="grid gap-3 px-4 pb-4 pt-2 sm:grid-cols-2">
              {topLiked.map((review) => {
                const slug = review.slug?.replace(/^\/film\/|\/$/g, '');
                const href = slug && stats.scraped_username
                  ? `https://letterboxd.com/${stats.scraped_username}/film/${slug}/`
                  : slug
                  ? `https://letterboxd.com/film/${slug}/`
                  : null;
                const card = (
                  <article className="results-surface h-full min-w-0 overflow-hidden p-4 transition-colors hover:bg-[color-mix(in_srgb,var(--results-text)_4%,var(--results-surface))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--results-accent)]">
                    <header className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--results-text)]">{review.title}</p>
                        <p className="text-xs text-[var(--results-muted)]">
                          {review.year || '—'}
                          {review.review_date ? ` · ${review.review_date.slice(0, 10)}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-bold text-orange-300">
                        ♥ {review.like_count}
                      </span>
                    </header>
                    {review.text_preview && (
                      <p className="mt-2 line-clamp-3 break-words text-sm text-[var(--results-muted)]">{review.text_preview}</p>
                    )}
                  </article>
                );
                return (
                  <li key={`${review.title}-${review.year}-${review.slug ?? ''}`} className="min-w-0">
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
          </div>
        )}

        {sortedReviews.length > 0 && (
          <div className="w-full border-t border-[var(--results-border)] pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-orange-300">All written reviews</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Sort without extra scraping — likes come from the review listing page.
                </p>
              </div>
              <div className="results-segmented flex-wrap">
                <ReviewSortButton active={reviewSort === 'likes'} onClick={() => { setReviewSort('likes'); setReviewPage(1); }}>
                  Most liked
                </ReviewSortButton>
                <ReviewSortButton active={reviewSort === 'length'} onClick={() => { setReviewSort('length'); setReviewPage(1); }}>
                  Longest
                </ReviewSortButton>
                <ReviewSortButton active={reviewSort === 'gems'} onClick={() => { setReviewSort('gems'); setReviewPage(1); }}>
                  Hidden gems
                </ReviewSortButton>
                {hasDates && (
                  <ReviewSortButton active={reviewSort === 'recent'} onClick={() => { setReviewSort('recent'); setReviewPage(1); }}>
                    Recent
                  </ReviewSortButton>
                )}
              </div>
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {paginatedSortedReviews.map((review, idx) => (
                <FullReviewCard key={`${review.title}-${review.year}-${idx}`} review={review} />
              ))}
            </ul>
            {hasMoreReviews && (
              <button
                type="button"
                onClick={() => setReviewPage((p) => p + 1)}
                className="mt-4 w-full rounded-lg bg-slate-800/70 py-2.5 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
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

/** A single word-filtered review. Long text collapses to 3 lines with a Read more toggle. */
function FilteredReviewCard({ review }: { review: ReviewItem }) {
  const [expanded, setExpanded] = useState(false);
  const text = review.text ?? '';
  // ponytail: char-length proxy for "needs a toggle"; line-clamp-3 ≈ ~200 chars
  const isLong = text.length > 200;
  const date = reviewDateLabel(review);

  return (
    <li className="rounded-lg bg-slate-800/50 p-3 hover:bg-slate-800/80 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="font-semibold text-orange-100 text-sm truncate">{review.title}</p>
        <span className="shrink-0 text-xs font-mono text-slate-400">♥ {review.likes || 0}</span>
      </div>
      <p className="text-xs text-slate-400 mb-2">
        {review.year || '—'}
        {date ? ` · ${date}` : ''}
      </p>
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
  const wordCount = reviewWordCount(review);
  const charCount = reviewCharLength(review);
  const date = reviewDateLabel(review);
  const isLong = text.length > 260;
  const likedBy = ((review as ReviewItem & { liked_by?: ReviewLiker[] }).liked_by ?? []).slice(0, 5);

  return (
    <li className="results-surface p-4 transition-colors">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--results-text)]">{review.title}</p>
          <p className="mt-0.5 text-xs text-[var(--results-muted)]">
            {review.year || '—'}
            {date ? ` · ${date}` : ''}
            {review.rating != null ? ` · ★ ${review.rating.toFixed(1)}` : ''}
            {wordCount > 0 ? ` · ${wordCount} words` : ''}
            {!date && charCount > 0 ? ` · ${charCount.toLocaleString()} chars` : ''}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
          likes > 0 ? 'bg-orange-500/20 text-orange-300' : 'bg-slate-800 text-slate-500'
        }`}>
          {likes > 0 ? `♥ ${likes}` : 'Not yet liked'}
        </span>
      </header>
<p className={`mt-3 break-words text-sm leading-relaxed text-[var(--results-muted)] ${expanded ? 'whitespace-pre-line' : 'line-clamp-4'}`}>
{text}
</p>
<LikerStrip likers={likedBy} fallbackCount={likes} />
{isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-[11px] font-bold text-orange-300 transition-colors hover:text-orange-200"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </li>
  );
}

function LikerStrip({ likers, fallbackCount }: { likers: ReviewLiker[]; fallbackCount: number }) {
  if (likers.length === 0) {
    return fallbackCount > 0 ? (
      <p className="mt-3 text-[11px] text-slate-500">
        {fallbackCount} public like{fallbackCount === 1 ? '' : 's'}
      </p>
    ) : null;
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="flex -space-x-2">
        {likers.map((liker) => (
          <a
            key={liker.username}
            href={liker.profile_url}
            target="_blank"
            rel="noreferrer"
            title={liker.display_name || liker.username}
            className="grid h-7 w-7 place-items-center overflow-hidden rounded-full border border-slate-950 bg-slate-800 text-[10px] font-black text-orange-200"
          >
            {liker.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={liker.avatar_url} alt={liker.display_name || liker.username} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              (liker.display_name || liker.username).slice(0, 1).toUpperCase()
            )}
          </a>
        ))}
      </div>
      <p className="min-w-0 truncate text-[11px] text-slate-400">
        liked by {likers.map((liker) => liker.display_name || liker.username).join(', ')}
        {fallbackCount > likers.length ? ` +${fallbackCount - likers.length}` : ''}
      </p>
    </div>
  );
}
