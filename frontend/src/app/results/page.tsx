'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { CalendarDays, Clapperboard, Clock3, Gauge, Share2, Star, UserRound, UsersRound } from 'lucide-react';
import type { ShareCardData } from '@/components/share/types';
import LanguagesLeaderboard from '@/containers/results/LanguagesLeaderboard';

const ShareModal = dynamic(() => import('@/components/ShareModal'), { ssr: false, loading: () => null });

import RatingDeviation from '@/containers/results/experimental/sections/RatingDeviation';
import ReviewAnalysisSection from '@/containers/results/experimental/sections/ReviewAnalysisSection';
import CastGrid from '@/containers/results/experimental/sections/CastGrid';
import DirectorsGrid from '@/containers/results/experimental/sections/DirectorsGrid';
import type { StatsData, PersonFilm } from '@/containers/results/experimental/types';
import PersonFilmsModal from '@/containers/results/experimental/sections/PersonFilmsModal';

import { ThemeProvider, useTheme } from '@/lib/theme';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import ThemeWrapper from '@/components/ThemeWrapper';
import FeedbackFab, { FeedbackFabRef } from '@/components/FeedbackFab';
import { searchPerson } from '@/lib/api';
import { getTmdbImageUrl, trackEvent, trackConsentedEvent } from '@/lib/analytics';
import { getUsername } from '@/lib/session-id';
import { readResultUsernameFromLocation, resultPath } from '@/lib/routes';
import { initPostHog, flushQueue } from '@/lib/posthog';
import { saveConsentDecisionToDb } from '@/lib/consentFlow';
import { useRafThrottle } from '@/hooks/useRafThrottle';
import { useLazyMount } from '@/hooks/useIntersectionObserver';

// Import all the section components
import { FilmHistory, RatingsBar } from '@/containers/results/FilmAndRatings';
import QuickFacts from '@/containers/results/QuickFacts';
import RewatchChampions from '@/containers/results/RewatchChampions';
import CinemaScale from '@/containers/results/CinemaScale';

// Note: StatsData is imported from @/containers/results/experimental/types

/**
 * Client-side fallback when backend sinefil_meter is missing.
 * Mirrors the cine_v2 model with the data available in LetterboxdStats.
 * Shannon entropy computed from the top-N counts the backend provides.
 */
const calcCinephileScore = (s?: StatsData | null) => {
  if (!s) return 45;

  const log2 = Math.log2;

  const entropy = (counts: number[]): number => {
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;
    return -counts.filter(c => c > 0).reduce((h, c) => {
      const p = c / total;
      return h + p * log2(p);
    }, 0);
  };

  const normEntropy = (counts: number[]): number => {
    const n = counts.filter(c => c > 0).length;
    if (n <= 1) return 0;
    const maxH = log2(n);
    return maxH > 0 ? entropy(counts) / maxH : 0;
  };

  const topShare = (counts: number[], n = 1) => {
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;
    return counts.sort((a, b) => b - a).slice(0, n).reduce((a, b) => a + b, 0) / total;
  };

  const countries = (s.top_countries || []).map(c => c.count);
  const decades = (s.decades || []).filter(d => d.decade !== 'Unknown').map(d => d.count);
  const languages = (s.top_languages || []).map(l => l.count);
  const genres = (s.top_genres || []).map(g => g.count);
  const directors = (s.top_directors || []).map(d => d.count);
  const total = s.total_films || 1;

  // Geography (0-25)
  const geoNorm = normEntropy(countries);
  const geoDom = topShare([...countries]) > 0.80 ? 0.6 : 1.0;
  const geo = Math.min(25, Math.round(geoNorm * geoDom * 25));

  // Temporal (0-20): decade entropy (12) + age bonus (8)
  const decNorm = normEntropy(decades);
  const decPts = Math.min(12, Math.round(decNorm * 12));
  // Rough median-year estimate from decade midpoints
  const decadeEntries = (s.decades || []).filter(d => d.decade !== 'Unknown');
  let agePts = 0;
  if (decadeEntries.length > 0) {
    const totalD = decadeEntries.reduce((a, d) => a + d.count, 0);
    const weightedYear = decadeEntries.reduce((a, d) => {
      const y = parseInt(String(d.decade).replace('s', ''));
      return a + (isNaN(y) ? 0 : (y + 5) * d.count);
    }, 0) / (totalD || 1);
    const yearsBack = Math.max(0, 2026 - weightedYear);
    agePts = Math.min(8, Math.round((yearsBack / 40) * 8));
  }
  const temporal = Math.min(20, decPts + agePts);

  // Languages (0-15)
  const langNorm = normEntropy(languages);
  const langDom = topShare([...languages]) > 0.85 ? 0.5 : 1.0;
  const lang = Math.min(15, Math.round(langNorm * langDom * 15));

  // Volume (0-15)
  const vol = Math.min(15, Math.round(Math.log10(Math.max(1, total)) * 6));

  // Genres (0-15)
  const genreNorm = normEntropy(genres);
  const genre = Math.min(15, Math.round(genreNorm * 15));

  // Directors (0-10)
  const top3Dir = topShare([...directors], 3);
  const dir = Math.min(10, Math.round((1 - top3Dir) * 12));

  return Math.max(0, Math.min(100, geo + temporal + lang + vol + genre + dir));
};

export default function ResultsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  // consent — anonymous-only stats are kept by default; no permission prompt
  const [sessionId, setSessionId] = useState<string>('');

  // share
  const [showShareModal, setShowShareModal] = useState(false);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('vertical');
  const [directorImageUrl, setDirectorImageUrl] = useState<string>('');

  // feedback
  const feedbackRef = useRef<FeedbackFabRef>(null);
  const [hasTriggeredFeedback, setHasTriggeredFeedback] = useState(false);


  // session helpers
  const getSessionId = () => {
    if (typeof window === 'undefined') return '00000000-0000-4000-8000-000000000000';
    let id = sessionStorage.getItem('session_id');
    if (!id) { id = (crypto?.randomUUID?.() ?? `session_${Date.now()}`); sessionStorage.setItem('session_id', id); }
    return id;
  };

  // Throttled resize handler
  const handleResize = useCallback(() => {
    setIsMobile(window.innerWidth < 480);
  }, []);

  const throttledResize = useRafThrottle(handleResize, []);

  useEffect(() => {
    throttledResize();
    window.addEventListener('resize', throttledResize);
    return () => window.removeEventListener('resize', throttledResize);
  }, [throttledResize]);

  useEffect(() => {
    const routedUsername = readResultUsernameFromLocation();
    let nextUsername = routedUsername;
    const saved = sessionStorage.getItem('letterboxdStats');
    if (saved) {
      try {
        const parsedStats = JSON.parse(saved);
        const storedUsername = getUsername();
        const statsUsername = String(parsedStats?.scraped_username || storedUsername || '').toLowerCase();
        const routeMatchesStats = !routedUsername || (!!statsUsername && routedUsername === statsUsername);

        if (routeMatchesStats) {
          setStats(parsedStats);
          nextUsername = routedUsername || statsUsername;
          if (!routedUsername && nextUsername) {
            window.history.replaceState(null, '', resultPath(nextUsername));
          }
          // Track that results were successfully loaded
          trackEvent('results_viewed', {
            total_films: parsedStats.total_films,
            average_rating: parsedStats.average_rating,
          });
          trackConsentedEvent('results_viewed_detailed', {
            total_countries: parsedStats.total_countries,
            average_runtime: parsedStats.average_runtime,
          });
        }
      } catch (err) {
        // Stale/corrupt sessionStorage data — log so a blank results page is diagnosable.
        console.error('[results] failed to parse stored stats:', err);
      }
    }
    setLoading(false);

    // Get username from shared session helper
    const storedUsername = nextUsername || getUsername();
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  useEffect(() => {
    const id = getSessionId();
    setSessionId(id);
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('consent_decision') === 'accept') return;
    sessionStorage.setItem('consent_decision', 'accept');
    initPostHog();
    flushQueue();
    void saveConsentDecisionToDb(true);
  }, []);

  // Derived data - maintain hook order
  const decadeData = useMemo(() => {
    const src = stats?.decades ?? [];
    return src
      .filter(d => d.decade && d.decade !== 'Unknown')
      .sort((a,b) => parseInt(String(a.decade).replace('s','')) - parseInt(String(b.decade).replace('s','')))
      .map(d => ({ ...d, decade: String(d.decade).includes('s') ? d.decade : `${d.decade}s` }));
  }, [stats?.decades]);
  const decadeMax = useMemo(() => Math.max(0, ...decadeData.map(d=>d.count)), [decadeData]);

  const ratingsArr = useMemo(() => {
    const dist = stats?.rating_distribution ?? {};
    return Object.entries(dist)
      .map(([r,c]) => ({ ratingNum: parseFloat(r), label: `${r}★`, count: c as number }))
      .sort((a,b)=> a.ratingNum - b.ratingNum);
  }, [stats?.rating_distribution]);
  const ratingMax = useMemo(() => Math.max(0, ...ratingsArr.map(d=>d.count)), [ratingsArr]);

  // Date range calculation
  const { actualRangeDays, dateRangeText } = useMemo(() => {
    // Use data_timeline if available
    if (stats?.data_timeline?.earliest_date && stats?.data_timeline?.latest_date) {
      try {
        const startDate = new Date(stats.data_timeline.earliest_date);
        const endDate = new Date(stats.data_timeline.latest_date);

        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          const daysDiff = Math.max(1, stats.data_timeline.total_days || 1);

          const startText = startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          const endText = endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

          return {
            actualRangeDays: daysDiff,
            dateRangeText: startText === endText ? `Analysed on ${startText}` : `Analysed from ${startText} to ${endText}`
          };
        }
      } catch {
        // Silent error handling
      }
    }

    // Fallback to monthly habits
    const monthlyHabits = stats?.monthly_viewing_habits;
    if (monthlyHabits && monthlyHabits.length > 0) {
      try {
        const sortedMonths = [...monthlyHabits].sort((a, b) => a.month.localeCompare(b.month));
        const firstMonth = sortedMonths[0].month;
        const lastMonth = sortedMonths[sortedMonths.length - 1].month;

        // Parse month formats
        let startDate, endDate;

        if (firstMonth.includes('-') && firstMonth.length >= 7) {
          startDate = new Date(firstMonth + (firstMonth.length === 7 ? '-01' : ''));
          endDate = new Date(lastMonth + (lastMonth.length === 7 ? '-01' : ''));
        } else if (firstMonth.includes('/')) {
          const [month, year] = firstMonth.split('/');
          startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
          const [endMonth, endYear] = lastMonth.split('/');
          endDate = new Date(parseInt(endYear), parseInt(endMonth) - 1, 1);
        } else if (/^\d{4}-\d{2}$/.test(firstMonth)) {
          startDate = new Date(firstMonth + '-01');
          endDate = new Date(lastMonth + '-01');
        } else {
          startDate = new Date(firstMonth);
          endDate = new Date(lastMonth);
        }

        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
          let daysDiff = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

          if (firstMonth === lastMonth) {
            daysDiff = 30;
          }

          const startText = startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
          const endText = endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

          return {
            actualRangeDays: daysDiff,
            dateRangeText: startText === endText ? `Analysed in ${startText}` : `Analysed from ${startText} to ${endText}`
          };
        }
      } catch {
        // Silent error handling
      }
    }

    // Default fallback
    return {
      actualRangeDays: 365,
      dateRangeText: 'Analysed over the past year'
    };
  }, [stats?.data_timeline, stats?.monthly_viewing_habits]);

  const runtimeHours = useMemo(() => {
    if (stats?.total_runtime && Number.isFinite(stats.total_runtime)) {
      return stats.total_runtime / 60;
    }
    if (stats?.hours_watched && Number.isFinite(stats.hours_watched)) {
      return stats.hours_watched;
    }
    if (stats?.days_watched && Number.isFinite(stats.days_watched)) {
      return stats.days_watched * 24;
    }
    return 0;
  }, [stats?.total_runtime, stats?.hours_watched, stats?.days_watched]);

  const timePct = useMemo(() => {
    const safeRangeDays = Math.max(1, actualRangeDays);

    // Calculate based on waking hours
    const wakingHoursPerDay = 16;
    const totalWakingHours = safeRangeDays * wakingHoursPerDay;

    let percentage = Math.round((runtimeHours / totalWakingHours) * 100);

    // Adjust for short periods
    if (safeRangeDays <= 30) {
      const totalAvailableHours = safeRangeDays * 24;
      percentage = Math.round((runtimeHours / totalAvailableHours) * 100);
    }

    return `${Math.min(percentage, 100)}%`;
  }, [runtimeHours, actualRangeDays]);

  const cineScore = useMemo(() => Math.max(0, Math.min(100, stats?.sinefil_meter?.score ?? calcCinephileScore(stats))), [stats]);
  const quickMetrics = useMemo(() => {
    const safeRange = Math.max(1, actualRangeDays);
    // Pace honesty: when the user has a Letterboxd diary window, count only films
    // actually logged in that window — total_films also includes pre-Letterboxd
    // backfill (e.g. movies the user watched years before joining and ticked off
    // retroactively), which would deflate pace if used as the numerator.
    const diaryCount = stats?.diary_film_count ?? 0;
    const lifetimeCount = stats?.total_films ?? 0;
    const paceNumerator = diaryCount > 0 ? diaryCount : lifetimeCount;
    const filmsPerWeek = (paceNumerator / safeRange) * 7;
    const languageCount = stats?.top_languages?.length ?? 0;
    const decadeSpan = (stats?.decades ?? []).filter((d) => d.count > 0).length;

    // 'diary' when backend gave us an actual earliest_date from the diary CSV
    // (so the window is real); 'fallback' when we defaulted to 365 days.
    const paceWindowSource: 'diary' | 'fallback' =
      stats?.data_timeline?.earliest_date && stats?.data_timeline?.latest_date
        ? 'diary'
        : 'fallback';

    return {
      filmsPerWeek,
      languageCount,
      decadeSpan,
      paceWindowDays: safeRange,
      paceWindowSource,
      diaryFilmCount: diaryCount,
      lifetimeFilmCount: lifetimeCount,
    };
  }, [stats?.total_films, stats?.diary_film_count, stats?.top_languages, stats?.decades, stats?.data_timeline, actualRangeDays]);

  // Build top actors & directors list, ensuring no duplicate person across both roles
  const topActors = useMemo(() => {
    return (stats?.top_actors || []).slice(0, 5).map((a) => ({
      name: a.name,
      headshotUrl: getTmdbImageUrl(a.profile_path) || '',
      count: a.count,
    }));
  }, [stats]);

  const topDirectors = useMemo(() => {
    const actorsSet = new Set((stats?.top_actors || []).slice(0, 5).map((a) => a.name));
    return (stats?.top_directors || [])
      .filter((d) => !actorsSet.has(d.name))
      .slice(0, 5)
      .map((d) => ({
        name: d.name,
        headshotUrl: getTmdbImageUrl(d.profile_path) || '',
        count: d.count,
      }));
  }, [stats]);

  const shareCardData = useMemo<ShareCardData>(() => {
    // Avoid crush being same person as director
    const actorIdx = 0;
    let directorIdx = 0;

    // If first actor === first director, try next director
    if (
      topActors.length > 0 &&
      topDirectors.length > 0 &&
      topActors[0].name === topDirectors[0].name
    ) {
      directorIdx = topDirectors.length > 1 ? 1 : 0;
    }

    const filmSource = stats?.favorite_films?.length
      ? stats.favorite_films
      : (stats?.rated_films ?? []);
    const topFilms = filmSource
      .slice(0, 4)
      .map((f) => ({
        title: f.title,
        year: f.year ? String(f.year) : '',
        posterPath: f.poster_path && f.poster_path.length > 0 ? f.poster_path : null,
      }));

    const topReviewWords = (stats?.review_analysis?.word_frequency ?? [])
      .filter(({ word }) => word && word.trim().length > 0)
      .slice(0, 3)
      .map(({ word, count }) => ({ word, count }));

    const outlier = stats?.rating_outlier_film;
    const ratingOutlierFilm = outlier
      ? {
          title: outlier.title,
          year: outlier.year != null ? String(outlier.year) : '',
          posterPath: outlier.poster_path && outlier.poster_path.length > 0 ? outlier.poster_path : null,
          userRating: outlier.user_rating,
          avgRating: outlier.avg_rating,
          delta: outlier.delta,
        }
      : undefined;

    return {
      onScreenCrush: topActors[actorIdx] || { name: 'Unknown Actor', headshotUrl: '', count: 0 },
      favoriteDirector: topDirectors[directorIdx] || { name: 'Unknown Director', headshotUrl: '', count: 0 },
      watchedFilms: stats?.total_films || 0,
      spentDays: Math.round(runtimeHours / 24),
      spentHours: Math.round(runtimeHours),
      timePercent: Number.parseInt(timePct, 10) || 0,
      cinemaScale: cineScore,
      personaLabel: stats?.cinematic_persona?.persona || '',
      minutesAverage: Math.round(stats?.average_runtime || 0),
      mostCommonRating: stats?.most_common_rating || 3.5,
      peakDecade: stats?.favorite_decade?.name || '2020s',
      peakDecadeCount: stats?.favorite_decade?.count || 0,
      topActors,
      topDirectors,
      topFilms,
      topReviewWords,
      ratingOutlierFilm,
      username: username || undefined,
    };
  }, [stats, topActors, topDirectors, cineScore, timePct, username, runtimeHours]);

  // Load director headshot with lazy loading
  const loadDirectorImage = useCallback(async () => {
    const nm = stats?.most_watched_director?.name;
    if (!nm) return;

    if (process.env.NEXT_PUBLIC_API_BASE) {
      try {
        const data = await searchPerson(nm, 'director');
        if (data.found && data.url) {
          const imageUrl = getTmdbImageUrl(data.url);
          if (imageUrl && !directorImageUrl) {
            setDirectorImageUrl(imageUrl);
          }
        }
      } catch {
        // Silent
      }
    }
  }, [stats?.most_watched_director?.name, directorImageUrl]);

  useEffect(() => {
    loadDirectorImage();
  }, [loadDirectorImage]);

  useEffect(() => {
    // Analytics for results viewed
    if (stats) {
      trackEvent('results_viewed_unified', {
        total_films: stats.total_films,
        cine_score: cineScore
      });
    }
  }, [stats, cineScore]);

  if (loading) return (
    <main className="results-experience min-h-screen px-4 py-12" aria-busy="true" aria-label="Loading your results">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="h-[56vh] min-h-[420px] animate-pulse rounded-[32px] bg-[var(--results-surface)]" />
        <div className="grid gap-6 md:grid-cols-2"><div className="h-64 animate-pulse rounded-3xl bg-[var(--results-surface)]" /><div className="h-64 animate-pulse rounded-3xl bg-[var(--results-surface)]" /></div>
      </div>
    </main>
  );
  if (!stats || (typeof stats === 'object' && Object.keys(stats).length === 0)) {
    return (
      <main className="results-experience flex min-h-screen items-center justify-center px-6 text-[var(--results-text)]">
        <div className="max-w-md text-center">
          <p className="mb-3 text-sm font-semibold text-[var(--results-accent)]">Your year in film</p>
          <h1 className="mb-4 text-4xl font-semibold tracking-[-0.03em]">No result data yet</h1>
          <p className="text-[var(--results-muted)]">
            {username ? `No local result data found for @${username}.` : 'Please upload your Letterboxd data first.'}
          </p>
          <Link href="/" className="mt-8 inline-flex min-h-11 items-center rounded-full bg-[var(--results-accent)] px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--results-accent)]">Return home</Link>
        </div>
      </main>
    );
  }

  return (
    <ThemeProvider>
      <ThemeWrapper>
        <ResultsContent
          stats={stats}
          sessionId={sessionId}
          username={username}
          dateRangeText={dateRangeText}
          timePct={timePct}
          runtimeHours={runtimeHours}
          decadeData={decadeData}
          decadeMax={decadeMax}
          isMobile={isMobile}
          ratingsArr={ratingsArr}
          ratingMax={ratingMax}
          quickMetrics={quickMetrics}
          cineScore={cineScore}
          showShareModal={showShareModal}
          setShowShareModal={setShowShareModal}
          shareCardData={shareCardData}
          orientation={orientation}
          setOrientation={setOrientation}
          hasTriggeredFeedback={hasTriggeredFeedback}
          setHasTriggeredFeedback={setHasTriggeredFeedback}
          feedbackRef={feedbackRef}
        />
      </ThemeWrapper>
    </ThemeProvider>
  );
}

/* ===================== RESULTS CONTENT (theme-aware) ===================== */

function ResultsContent({
  stats,
  sessionId,
  username,
  dateRangeText,
  timePct,
  runtimeHours,
  decadeData,
  decadeMax,
  isMobile,
  ratingsArr,
  ratingMax,
  quickMetrics,
  cineScore,
  showShareModal,
  setShowShareModal,
  shareCardData,
  orientation,
  setOrientation,
  hasTriggeredFeedback,
  setHasTriggeredFeedback,
  feedbackRef,
}: any) {
  const { theme, config } = useTheme();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalFilms, setModalFilms] = useState<PersonFilm[]>([]);

  const handleFilmsClick = () => {
    if (!stats?.all_films) return;
    setModalTitle('All Watched Films');
    setModalFilms(
      stats.all_films.map((f: any) => ({
        title: f.title,
        year: f.year ? String(f.year) : undefined,
        poster_path: f.poster_path,
        user_rating: f.rating ?? null,
      }))
    );
    setModalOpen(true);
  };

  const handlePersonClick = (name: string, isDirector: boolean) => {
    if (!stats?.all_films) return;
    setModalTitle(isDirector ? `Films by ${name}` : `Films starring ${name}`);
    const filteredFilms = stats.all_films
      .filter((f: any) => {
        if (isDirector) {
          return f.director && f.director.toLowerCase() === name.toLowerCase();
        } else {
          return f.cast && f.cast.some((actor: string) => actor.toLowerCase() === name.toLowerCase());
        }
      })
      .map((f: any) => ({
        title: f.title,
        year: f.year ? String(f.year) : undefined,
        poster_path: f.poster_path,
        user_rating: f.rating ?? null,
      }));
    setModalFilms(filteredFilms);
    setModalOpen(true);
  };

  const handleAvgRatingClick = () => {
    if (!stats?.all_films) return;
    setModalTitle('Your Rated Films');
    setModalFilms(
      stats.all_films
        .filter((f: any) => f.rating != null)
        .map((f: any) => ({
          title: f.title,
          year: f.year ? String(f.year) : undefined,
          poster_path: f.poster_path,
          user_rating: f.rating,
        }))
    );
    setModalOpen(true);
  };

  const handleGenreClick = () => {
    const genre = stats?.top_genres?.[0]?.name;
    if (!genre || !stats?.all_films) return;
    setModalTitle(`${genre} Films`);
    setModalFilms(
      stats.all_films
        .filter((f: any) => f.genres && f.genres.includes(genre))
        .map((f: any) => ({
          title: f.title,
          year: f.year ? String(f.year) : undefined,
          poster_path: f.poster_path,
          user_rating: f.rating ?? null,
        }))
    );
    setModalOpen(true);
  };

  const handleDirectorClick = () => {
    const director = stats?.top_directors?.[0]?.name || stats?.most_watched_director?.name;
    if (!director || !stats?.all_films) return;
    setModalTitle(`Films by ${director}`);
    setModalFilms(
      stats.all_films
        .filter((f: any) => f.director && f.director.toLowerCase() === director.toLowerCase())
        .map((f: any) => ({
          title: f.title,
          year: f.year ? String(f.year) : undefined,
          poster_path: f.poster_path,
          user_rating: f.rating ?? null,
      }))
    );
    setModalOpen(true);
  };

  const handleDecadeClick = () => {
    const decade = stats?.favorite_decade?.name;
    if (!decade || !stats?.all_films) return;
    const startYear = parseInt(decade);
    if (isNaN(startYear)) return;
    const endYear = startYear + 9;
    setModalTitle(`Films from the ${decade}`);
    setModalFilms(
      stats.all_films
        .filter((f: any) => {
          const year = parseInt(String(f.year));
          return !isNaN(year) && year >= startYear && year <= endYear;
        })
        .map((f: any) => ({
          title: f.title,
          year: f.year ? String(f.year) : undefined,
          poster_path: f.poster_path,
          user_rating: f.rating ?? null,
        }))
    );
    setModalOpen(true);
  };

  return (
    <>
      <main className={`results-experience ${theme === 'apple' ? 'results-light' : ''} relative z-10 mx-auto max-w-[1200px] space-y-8 px-4 pb-28 pt-4 text-[var(--results-text)] md:space-y-12 md:px-8 md:pb-32 md:pt-8`}>
        <DossierHero
          theme={theme}
          accent={config.cssVars['--theme-accent']}
          accent2={config.cssVars['--theme-accent-2']}
          username={username}
          dateRangeText={dateRangeText}
          totalFilms={stats.total_films}
          avgRating={stats.average_rating}
          runtimeHours={runtimeHours}
          topGenre={stats.top_genres?.[0]?.name || 'Unknown'}
          timePct={timePct}
          favoriteDirector={stats.top_directors?.[0] || { name: 'Unknown', count: 0 }}
          favoriteDecade={stats.favorite_decade || { name: 'Unknown', count: 0 }}
          cineScore={cineScore}
          onClickFilms={handleFilmsClick}
          onClickAvgRating={handleAvgRatingClick}
          onClickGenre={handleGenreClick}
          onClickDirector={handleDirectorClick}
          onClickDecade={handleDecadeClick}
          onShare={() => {
            setShowShareModal(true);
            trackEvent('share_export_started');
          }}
        />

        <div className="flex justify-center py-2">
          <ThemeSwitcher />
        </div>

        {/* 1. Directors & Cast */}
        <div className="grid grid-cols-1 gap-6">
          <DirectorsGrid stats={stats} onDirectorClick={(name) => handlePersonClick(name, true)} />
          <CastGrid stats={stats} onActorClick={(name) => handlePersonClick(name, false)} />
        </div>

        {/* Share teaser — visible after directors/cast while users are engaged */}
        <div className="results-scene flex flex-col justify-between gap-6 border-y py-8 sm:flex-row sm:items-center">
          <div className="hidden">
            <div className="grid h-full grid-rows-5 gap-2 px-2 py-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-[2px] border border-[#f5d7a8]/[0.12] bg-[#f5d7a8]/[0.06]" />
              ))}
            </div>
          </div>
          <div className="contents">
          <div>
            <p className="text-xl font-semibold tracking-[-0.02em]">Share your year in film</p>
            <p className="mt-1 text-sm text-[var(--results-muted)]">Choose a card, preview it, and save it in one step.</p>
          </div>
          <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setShowShareModal(true); trackEvent('share_export_started'); }}
            className="results-primary-action inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--results-accent)]"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
          <Link
            href="/watchlist"
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#f5d7a8]/[0.14] bg-black/20 px-4 py-2 text-sm font-bold text-[#fff7ed] transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
          >
            <UsersRound className="h-4 w-4 text-[#64b4bf]" />
            Compare
          </Link>
          </div>
          </div>
        </div>

        {/* 3. Rating Outliers */}
        <RatingDeviation stats={stats} />

        {/* 4. Your Reviews — promoted: it's the most personal section */}
        {stats.review_analysis ? (
          <ReviewAnalysisSection stats={stats} />
        ) : (
          <div className="rounded-[22px] border border-[#f5d7a8]/[0.1] bg-[#17120f]/70 p-6 text-center text-sm text-[#b6a99a]">
            This dossier has no written reviews yet.
          </div>
        )}

        {/* Film History */}
        <LazyFilmHistory data={decadeData} max={decadeMax} isMobile={isMobile} allFilms={stats.all_films ?? []} userAvg={stats.average_rating} />

        {/* Ratings Bar */}
        <LazyRatingsBar
          data={ratingsArr}
          max={ratingMax}
          isMobile={isMobile}
          mostCommonRating={stats.most_common_rating}
          allFilms={stats.all_films ?? []}
          userAvg={stats.average_rating}
        />

        {/* Quick Facts */}
        <LazyQuickFacts
          avgMinutes={stats.average_runtime || 0}
          totalCountries={stats.total_countries || 0}
          filmsPerWeek={quickMetrics.filmsPerWeek}
          languageCount={quickMetrics.languageCount}
          decadeSpan={quickMetrics.decadeSpan}
          topCountry={stats.top_countries?.[0]?.name}
          rewatchedCount={stats.rewatched_count}
          totalFilms={stats.total_films}
          paceWindowDays={quickMetrics.paceWindowDays}
          paceWindowSource={quickMetrics.paceWindowSource}
          diaryFilmCount={quickMetrics.diaryFilmCount}
          lifetimeFilmCount={quickMetrics.lifetimeFilmCount}
        />

        {/* Rewatch Champions — only when user has films watched 2+ times */}
        {stats.rewatch_champions && stats.rewatch_champions.length > 0 && (
          <RewatchChampions films={stats.rewatch_champions} />
        )}

        {/* Languages — moved lower; supporting info, not headline */}
        <LazyLanguages data={stats.top_languages ?? []} allFilms={stats.all_films ?? []} />

        {/* Cinema Scale */}
        <SectionContainer theme={theme}>
          <LazyCinemaScale
            type={stats.sinefil_meter?.type || 'Independent Cinephile'}
            description={stats.sinefil_meter?.description}
            score={cineScore || 50}
            breakdown={stats.sinefil_meter?.breakdown}
          />
        </SectionContainer>

        {/* Share button */}
        <div className="my-12 flex flex-col items-center gap-4 border-y border-[var(--results-border)] px-5 py-12 text-center">
          <button
            onClick={() => {
              setShowShareModal(true);
              trackEvent('share_export_started');
            }}
            className="results-primary-action flex min-h-12 items-center gap-2 rounded-full px-8 py-4 text-base font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--results-accent)]"
          >
            <Share2 className="h-5 w-5" />
            Share Your Wrapped
          </button>
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href="/watchlist"
              className="inline-flex items-center gap-2 rounded-full border border-[#f5d7a8]/[0.12] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#b6a99a] transition-colors hover:text-[#fff7ed]"
            >
              <UsersRound className="h-4 w-4 text-[#64b4bf]" />
              Watchlist compare
            </Link>
            <Link
              href="/watchlist"
              className="inline-flex items-center gap-2 rounded-full border border-[#f5d7a8]/[0.12] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#b6a99a] transition-colors hover:text-[#fff7ed]"
            >
              <UsersRound className="h-4 w-4 text-[#7bbf86]" />
              Date night
            </Link>
          </div>
          <p
            className="max-w-xl text-center text-xs"
            style={{
              color: theme === 'current' ? '#9b8d7d' : theme === 'vhs' ? '#d4955a' : '#6a6a6a',
            }}
          >
            Your raw files are never stored. Only anonymous, aggregated usage stats are kept to improve the product.
          </p>
        </div>

        {/* Beta credits + contact */}
        <div className="mt-12 space-y-3 border-t border-[#f5d7a8]/[0.08] pt-8 text-center">
          <p className="text-xs text-[#8d7f70]">
            Thanks to our beta testers — Mete, Mehlika Ceylin Aydoğan, Salih Emre Padır,
            Mert Efe Şentürk, Deniz and Ayberk — for the invaluable feedback.
          </p>
          <p className="text-xs text-[#8d7f70]">
            Questions or feedback?{' '}
            <a
              href="mailto:semihmutlu220@gmail.com"
              className="underline underline-offset-2 transition-colors hover:text-[#fff7ed]"
            >
              Get in touch
            </a>
          </p>
        </div>
      </main>

      <button
        type="button"
        onClick={() => { setShowShareModal(true); trackEvent('share_export_started'); }}
        className="results-primary-action fixed bottom-5 right-5 z-40 inline-flex min-h-12 items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--results-accent)] motion-reduce:transform-none md:bottom-8 md:right-8"
      >
        <Share2 className="h-4 w-4" /> Share result
      </button>

      <ShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        orientation={orientation}
        setOrientation={setOrientation}
        cardProps={shareCardData}
        onDownloadSuccess={() => {
          trackEvent('share_export_succeeded');
          if (!hasTriggeredFeedback) {
            setHasTriggeredFeedback(true);
            feedbackRef.current?.open();
          }
        }}
      />

      <FeedbackFab ref={feedbackRef} sessionId={sessionId} />

      <PersonFilmsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        name={modalTitle}
        films={modalFilms}
      />
    </>
  );
}

function DossierHero({
  theme,
  accent,
  accent2,
  username,
  dateRangeText,
  totalFilms,
  avgRating,
  runtimeHours,
  topGenre,
  timePct,
  favoriteDirector,
  favoriteDecade,
  cineScore,
  onClickFilms,
  onClickAvgRating,
  onClickGenre,
  onClickDirector,
  onClickDecade,
  onShare,
}: {
  theme: string;
  accent: string;
  accent2: string;
  username?: string | null;
  dateRangeText: string;
  totalFilms: number;
  avgRating?: number | null;
  runtimeHours: number;
  topGenre: string;
  timePct: string;
  favoriteDirector: { name: string; count: number };
  favoriteDecade: { name: string; count: number };
  cineScore: number;
  onClickFilms?: () => void;
  onClickAvgRating?: () => void;
  onClickGenre?: () => void;
  onClickDirector?: () => void;
  onClickDecade?: () => void;
  onShare: () => void;
}) {
  const heroAccent = theme === 'current' ? '#ff7a1a' : accent;
  const heroAccent2 = theme === 'current' ? '#64b4bf' : accent2;
  const textColor = 'var(--results-text)';
  const mutedColor = 'var(--results-muted)';
  const panelBg = 'transparent';
  const borderColor = 'var(--results-border)';
  const hoursLabel = `${Math.round(Math.max(0, runtimeHours)).toLocaleString()}h`;
  const avgRatingLabel = typeof avgRating === 'number' && Number.isFinite(avgRating)
    ? `${avgRating.toFixed(1)}★`
    : 'N/A';

  const heroStats = [
    {
      label: 'Films',
      value: totalFilms.toLocaleString(),
      detail: 'watched archive',
      icon: Clapperboard,
      onClick: onClickFilms,
    },
    {
      label: 'Avg rating',
      value: avgRatingLabel,
      detail: 'personal signal',
      icon: Star,
      onClick: onClickAvgRating,
    },
    {
      label: 'Screen time',
      value: hoursLabel,
      detail: `${timePct} of waking time`,
      icon: Clock3,
    },
    {
      label: 'Top genre',
      value: topGenre,
      detail: 'dominant shelf',
      icon: Gauge,
      onClick: onClickGenre,
    },
  ];

  return (
    <section className="relative isolate overflow-hidden border-b border-[var(--results-border)] px-0 py-12 md:py-16">
      <div
        className="absolute inset-0 -z-20"
        style={{
          background:
            'transparent',
        }}
      />
      <div className="hidden" />
      <div className="hidden">
        <div className="grid h-full grid-rows-12 gap-3 px-3 py-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-[2px] border border-orange-100/15 bg-orange-50/10" />
          ))}
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-end lg:gap-16">
        <div className="px-0 py-4" style={{ background: panelBg, borderColor }}>
          <div className="mb-6 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] md:text-xs md:tracking-[0.22em]" style={{ color: mutedColor }}>
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5" style={{ borderColor }}>
              <CalendarDays className="h-3.5 w-3.5" />
              {dateRangeText}
            </span>
            {username && (
              <span className="inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 normal-case tracking-normal" style={{ borderColor, color: textColor }}>
                <UserRound className="h-3.5 w-3.5" />
                @{username}
              </span>
            )}
          </div>

          <div className="max-w-3xl">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] md:tracking-[0.34em]" style={{ color: heroAccent }}>
              Personal cinema dossier
            </p>
            <h1 className="text-[clamp(48px,8vw,104px)] font-semibold leading-[0.88] tracking-[-0.055em]" style={{ color: textColor }}>
              Letterboxd
              <span className="block" style={{ color: heroAccent }}>
                Wrapped
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 md:text-base" style={{ color: mutedColor }}>
              Your year in film, cut as an editorial dossier: pace, taste, obsessions, outliers, and the people who kept showing up in the credits.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-end gap-3">
            <button
              type="button"
              onClick={onShare}
              className="inline-flex min-h-12 items-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold uppercase tracking-[0.14em] transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${heroAccent}, ${heroAccent2})`, color: theme === 'apple' ? '#fff' : '#1b120e' }}
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
            <Link
              href="/watchlist"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border px-5 py-3 text-sm font-bold text-left transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
              style={{ borderColor, color: textColor }}
            >
              <UsersRound className="h-4 w-4" style={{ color: heroAccent2 }} />
              Compare lists
            </Link>
            <button
              type="button"
              onClick={onClickDecade}
              className="min-h-12 rounded-full border px-5 py-3 text-left text-sm font-bold transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
              style={{ borderColor, color: textColor }}
            >
              <span className="block text-[10px] uppercase tracking-[0.2em]" style={{ color: mutedColor }}>Peak decade</span>
              {favoriteDecade.name} · {favoriteDecade.count.toLocaleString()} films
            </button>
            <button
              type="button"
              onClick={onClickDirector}
              className="min-h-12 rounded-full border px-5 py-3 text-left text-sm font-bold transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
              style={{ borderColor, color: textColor }}
            >
              <span className="block text-[10px] uppercase tracking-[0.2em]" style={{ color: mutedColor }}>Director pull</span>
              {favoriteDirector.name}
            </button>
          </div>
        </div>

        <div className="grid gap-px overflow-hidden rounded-3xl border sm:grid-cols-2" style={{ borderColor, background: borderColor }}>
          <div className="bg-[var(--results-surface)] p-5 sm:col-span-2 md:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em]" style={{ color: mutedColor }}>Cinema scale</p>
                <p className="mt-1 text-sm" style={{ color: mutedColor }}>Breadth of taste across countries, eras, languages, genres, and directors.</p>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-[clamp(44px,6vw,76px)] font-black leading-none tabular-nums" style={{ color: textColor }}>
                  {cineScore}
                </div>
                <div className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: heroAccent }}>out of 100</div>
              </div>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-black/25">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, cineScore))}%`, background: `linear-gradient(90deg, ${heroAccent}, #d8b56d, ${heroAccent2})` }}
              />
            </div>
          </div>

          {heroStats.map(({ label, value, detail, icon: Icon, onClick }) => {
            const className = "group min-h-[148px] bg-[var(--results-surface)] p-5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--results-surface)_92%,var(--results-text))] focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--results-accent)]";
            const style = { color: textColor };
            const content = (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: mutedColor }}>{label}</span>
                  <Icon className="h-4 w-4" style={{ color: heroAccent }} />
                </div>
                <div className="mt-5 text-[clamp(28px,4vw,46px)] font-black leading-none tabular-nums break-words">{value}</div>
                <div className="mt-3 text-xs font-bold uppercase tracking-[0.16em]" style={{ color: mutedColor }}>{detail}</div>
              </>
            );
            return onClick ? (
              <button key={label} type="button" onClick={onClick} className={className} style={style}>
                {content}
              </button>
            ) : (
              <div key={label} className={className} style={style}>
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Small helper: theme-aware section wrapper */
function SectionContainer({ theme, children }: { theme: string; children: React.ReactNode }) {
  if (theme === 'current') return <>{children}</>;
  return (
    <div className="rounded-2xl overflow-hidden" style={{
      border: theme === 'vhs' ? '1px solid rgba(212,149,90,0.2)' : '1px solid rgba(255,255,255,0.06)',
    }}>
      {children}
    </div>
  );
}

// ===================== LAZY LOADING COMPONENTS =====================

// Lazy wrapper for Languages
function LazyLanguages({
  data,
  allFilms,
}: {
  data: any[];
  allFilms: any[];
}) {
  const { ref, shouldMount } = useLazyMount(100);

  return (
    <div ref={ref}>
      {shouldMount ? (
        <LanguagesLeaderboard data={data.slice(0,7)} allFilms={allFilms} />
      ) : (
        <div className="h-64 bg-slate-800/30 rounded-2xl animate-pulse" />
      )}
    </div>
  );
}

// Lazy wrapper for Film History
function LazyFilmHistory({ data, max, isMobile, allFilms, userAvg }: { data: any[]; max: number; isMobile: boolean; allFilms: any[]; userAvg?: number | null }) {
  const { ref, shouldMount } = useLazyMount(150);

  return (
    <div ref={ref}>
      {shouldMount ? (
        <FilmHistory data={data} max={max} isMobile={isMobile} allFilms={allFilms} userAvg={userAvg} />
      ) : (
        <div className="h-48 bg-slate-800/30 rounded-2xl animate-pulse" />
      )}
    </div>
  );
}

// Lazy wrapper for Ratings Bar
function LazyRatingsBar({
  data,
  max,
  isMobile,
  mostCommonRating,
  allFilms,
  userAvg,
}: {
  data: any[];
  max: number;
  isMobile: boolean;
  mostCommonRating?: number;
  allFilms: any[];
  userAvg?: number | null;
}) {
  const { ref, shouldMount } = useLazyMount(200);

  return (
    <div ref={ref}>
      {shouldMount ? (
        <RatingsBar
          data={data}
          max={max}
          isMobile={isMobile}
          mostCommonRating={mostCommonRating}
          allFilms={allFilms}
          userAvg={userAvg}
        />
      ) : (
        <div className="h-32 bg-slate-800/30 rounded-2xl animate-pulse" />
      )}
    </div>
  );
}

// Lazy wrapper for Quick Facts
function LazyQuickFacts({
  avgMinutes,
  totalCountries,
  filmsPerWeek,
  languageCount,
  decadeSpan,
  topCountry,
  rewatchedCount,
  totalFilms,
  paceWindowDays,
  paceWindowSource,
  diaryFilmCount,
  lifetimeFilmCount,
}: {
  avgMinutes: number;
  totalCountries: number;
  filmsPerWeek: number;
  languageCount: number;
  decadeSpan: number;
  topCountry?: string;
  rewatchedCount?: number;
  totalFilms?: number;
  paceWindowDays?: number;
  paceWindowSource?: 'diary' | 'fallback';
  diaryFilmCount?: number;
  lifetimeFilmCount?: number;
}) {
  const { ref, shouldMount } = useLazyMount(250);

  return (
    <div ref={ref}>
      {shouldMount ? (
        <QuickFacts
          avgMinutes={avgMinutes}
          totalCountries={totalCountries}
          filmsPerWeek={filmsPerWeek}
          languageCount={languageCount}
          decadeSpan={decadeSpan}
          topCountry={topCountry}
          rewatchedCount={rewatchedCount}
          totalFilms={totalFilms}
          paceWindowDays={paceWindowDays}
          paceWindowSource={paceWindowSource}
          diaryFilmCount={diaryFilmCount}
          lifetimeFilmCount={lifetimeFilmCount}
        />
      ) : (
        <div className="h-40 bg-slate-800/30 rounded-2xl animate-pulse" />
      )}
    </div>
  );
}

// Lazy wrapper for Cinema Scale
function LazyCinemaScale({
  type,
  description,
  score,
  breakdown,
}: {
  type: string;
  description?: string;
  score: number;
  breakdown?: {
    geography: number;
    temporal: number;
    languages: number;
    volume: number;
    genres: number;
    directors: number;
  };
}) {
  const { ref, shouldMount } = useLazyMount(300);

  return (
    <div ref={ref}>
      {shouldMount ? (
        <CinemaScale type={type} description={description} score={score} breakdown={breakdown} />
      ) : (
        <div className="h-32 bg-slate-800/30 rounded-2xl animate-pulse" />
      )}
    </div>
  );
}
