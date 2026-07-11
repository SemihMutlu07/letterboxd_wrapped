'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
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
import HeroStats from '@/containers/results/HeroStats';
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

  if (loading) return <div className="min-h-screen bg-slate-900" />;
  if (!stats || (typeof stats === 'object' && Object.keys(stats).length === 0)) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No data found</h2>
          <p className="text-gray-400">
            {username ? `No local result data found for @${username}.` : 'Please upload your Letterboxd data first.'}
          </p>
          <Link href="/" className="mt-6 inline-block px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold transition-colors">Go Back</Link>
        </div>
      </div>
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

export function ResultsContent({
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
      })).sort((a: PersonFilm, b: PersonFilm) => {
        const ratingDiff = (b.user_rating ?? -1) - (a.user_rating ?? -1);
        if (ratingDiff !== 0) return ratingDiff;
        const yearDiff = Number(b.year ?? 0) - Number(a.year ?? 0);
        return yearDiff || a.title.localeCompare(b.title);
      })
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
        .sort((a: PersonFilm, b: PersonFilm) => {
          const ratingDiff = (b.user_rating ?? -1) - (a.user_rating ?? -1);
          if (ratingDiff !== 0) return ratingDiff;
          const yearDiff = Number(b.year ?? 0) - Number(a.year ?? 0);
          return yearDiff || a.title.localeCompare(b.title);
        })
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
        .sort((a: PersonFilm, b: PersonFilm) => {
          const ratingDiff = (b.user_rating ?? -1) - (a.user_rating ?? -1);
          if (ratingDiff !== 0) return ratingDiff;
          const yearDiff = Number(b.year ?? 0) - Number(a.year ?? 0);
          return yearDiff || a.title.localeCompare(b.title);
        })
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
        .sort((a: PersonFilm, b: PersonFilm) => {
          const ratingDiff = (b.user_rating ?? -1) - (a.user_rating ?? -1);
          if (ratingDiff !== 0) return ratingDiff;
          const yearDiff = Number(b.year ?? 0) - Number(a.year ?? 0);
          return yearDiff || a.title.localeCompare(b.title);
        })
    );
    setModalOpen(true);
  };

  const slides = [
    {
      id: 'hero',
      render: () => (
        <div className="space-y-3 md:space-y-6">
          <header className="text-center py-4 md:py-10">
            <h1
              className="text-[clamp(32px,6vw,72px)] font-black mb-4 leading-[0.95] tracking-tighter"
              style={{
                fontFamily: 'var(--theme-font-display)',
                color:
                  theme === 'current' ? '#fff'
                  : theme === 'vhs' ? '#f0e6d8'
                  : theme === 'apple' ? '#1D1D1F'
                  : '#e8e0d8',
              }}
            >
              Your{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${config.cssVars['--theme-accent']}, ${config.cssVars['--theme-accent-2']}${theme === 'current' ? ', #d946ef' : ''})`,
                }}
              >
                Letterboxd
              </span>{' '}
              Wrapped
            </h1>
            <p
              className="text-xl mb-2"
              style={{
                color:
                  theme === 'current' ? '#d1d5db'
                  : theme === 'vhs' ? '#d4955a'
                  : theme === 'apple' ? '#6E6E73'
                  : '#8a8a8a',
              }}
            >
              A comprehensive analysis of your cinematic journey.
            </p>
            <p
              className="text-center text-lg"
              style={{
                color:
                  theme === 'current' ? '#9ca3af'
                  : theme === 'vhs' ? '#d4955a'
                  : theme === 'apple' ? '#86868B'
                  : '#6a6a6a',
              }}
            >
              {dateRangeText}
            </p>
            {username && (
              <div className="mt-3">
                <span
                  className="inline-block px-3 py-1 text-sm rounded-full"
                  style={{
                    background:
                      theme === 'current' ? 'rgba(51,65,85,0.6)'
                      : theme === 'apple' ? '#F2F2F7'
                      : 'rgba(0,0,0,0.06)',
                    border: `1px solid ${
                      theme === 'current' ? 'rgba(51,65,85,0.6)'
                      : theme === 'apple' ? 'rgba(0,0,0,0.08)'
                      : 'rgba(0,0,0,0.1)'
                    }`,
                    color:
                      theme === 'current' ? '#cbd5e1'
                      : theme === 'vhs' ? '#d4955a'
                      : theme === 'apple' ? '#1D1D1F'
                      : '#8a8a8a',
                  }}
                >
                  @{username}
                </span>
              </div>
            )}
          </header>

          <SectionContainer theme={theme}>
            <HeroStats
              totalFilms={stats.total_films}
              avgRating={stats.average_rating}
              hoursWatched={runtimeHours}
              topGenre={stats.top_genres?.[0]?.name || 'Unknown'}
              timePct={timePct}
              favoriteDirector={stats.top_directors?.[0] || { name: 'Unknown', count: 0 }}
              favoriteDecade={stats.favorite_decade || { name: 'Unknown', count: 0 }}
              onClickFilms={handleFilmsClick}
              onClickAvgRating={handleAvgRatingClick}
              onClickGenre={handleGenreClick}
              onClickDirector={handleDirectorClick}
              onClickDecade={handleDecadeClick}
            />
          </SectionContainer>
        </div>
      ),
    },
    {
      id: 'people',
      render: () => (
        <div className="space-y-3 md:space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <DirectorsGrid stats={stats} onDirectorClick={(name) => handlePersonClick(name, true)} />
            <CastGrid stats={stats} onActorClick={(name) => handlePersonClick(name, false)} />
          </div>

          <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border border-white/[0.06] bg-white/[0.03]">
            <div>
              <p className="text-sm font-semibold text-white">Ready to share your year?</p>
              <p className="text-xs text-slate-500 mt-0.5">Turn your stats into a shareable card.</p>
            </div>
            <button
              onClick={() => { setShowShareModal(true); trackEvent('share_export_started'); }}
              className="shrink-0 px-4 py-2 text-sm font-semibold rounded-xl transition-all hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${config.cssVars['--theme-accent']}, ${config.cssVars['--theme-accent-2']})`, color: theme === 'current' || theme === 'vhs' ? '#fff' : '#181614' }}
            >
              Share your Wrapped →
            </button>
          </div>
        </div>
      ),
    },
    {
      id: 'rating-deviation',
      render: () => <RatingDeviation stats={stats} />,
    },
    {
      id: 'reviews',
      render: () =>
        stats.review_analysis ? (
          <ReviewAnalysisSection stats={stats} />
        ) : (
          <div className="rounded-xl bg-white/5 p-8 text-center text-slate-400">
            <p className="text-sm">Bu hesapta yazılı review bulunamadı.</p>
          </div>
        ),
    },
    {
      id: 'film-history',
      render: () => <LazyFilmHistory data={decadeData} max={decadeMax} isMobile={isMobile} />,
    },
    {
      id: 'ratings-bar',
      render: () => (
        <LazyRatingsBar
          data={ratingsArr}
          max={ratingMax}
          isMobile={isMobile}
          mostCommonRating={stats.most_common_rating}
          allFilms={stats.all_films ?? []}
          userAvg={stats.average_rating}
        />
      ),
    },
    {
      id: 'quick-facts',
      render: () => (
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
      ),
    },
    ...(stats.rewatch_champions && stats.rewatch_champions.length > 0
      ? [
          {
            id: 'rewatch-champions',
            render: () => <RewatchChampions films={stats.rewatch_champions} />,
          },
        ]
      : []),
    {
      id: 'languages',
      render: () => <LazyLanguages data={stats.top_languages ?? []} allFilms={stats.all_films ?? []} />,
    },
    {
      id: 'cinema-scale',
      render: () => (
        <SectionContainer theme={theme}>
          <LazyCinemaScale
            type={stats.sinefil_meter?.type || 'Independent Cinephile'}
            description={stats.sinefil_meter?.description}
            score={cineScore || 50}
            breakdown={stats.sinefil_meter?.breakdown}
          />
        </SectionContainer>
      ),
    },
    {
      id: 'share-footer',
      render: () => (
        <div className="space-y-3 md:space-y-6">
          <div className="flex flex-col items-center my-8 gap-3">
            <button
              onClick={() => {
                setShowShareModal(true);
                trackEvent('share_export_started');
              }}
              className="flex items-center gap-2 px-8 py-4 font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 rounded-xl"
              style={{
                background: `linear-gradient(135deg, ${config.cssVars['--theme-accent']}, ${config.cssVars['--theme-accent-2']})`,
                color: theme === 'current' || theme === 'vhs' ? '#fff' : '#181614',
              }}
            >
              <div
                className="w-6 h-6 rounded"
                style={{
                  background: theme === 'current' ? '#fff' : 'var(--theme-bg)',
                }}
              />
              Share Your Wrapped
            </button>
            <p
              className="text-xs text-center"
              style={{
                color: theme === 'current' ? '#64748b' : theme === 'vhs' ? '#d4955a' : '#6a6a6a',
              }}
            >
              Your raw files are never stored. Only anonymous, aggregated usage stats are kept to improve the product.
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-white/[0.06] text-center space-y-3">
            <p className="text-xs text-slate-600">
              Thanks to our beta testers — Mete, Mehlika Ceylin Aydoğan, Salih Emre Padır,
              Mert Efe Şentürk, Deniz and Ayberk — for the invaluable feedback.
            </p>
            <p className="text-xs text-slate-600">
              Questions or feedback?{' '}
              <a
                href="mailto:semihmutlu220@gmail.com"
                className="underline underline-offset-2 hover:text-slate-400 transition-colors"
              >
                Get in touch
              </a>
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <main className="relative z-10 px-3 md:px-8 py-4 md:py-6 max-w-7xl mx-auto space-y-3 md:space-y-6">
        {slides.map((s) => (
          <React.Fragment key={s.id}>{s.render()}</React.Fragment>
        ))}
      </main>

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
        profileImageUrl={modalTitle === 'All Watched Films' ? stats.profile_avatar_url : undefined}
        profilePath={undefined}
      />
    </>
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

function LazyLanguages({ data, allFilms }: { data: any[]; allFilms: any[] }) {
  const { ref, shouldMount } = useLazyMount(100);
  return (
    <div ref={ref}>
      {shouldMount ? (
        <LanguagesLeaderboard data={data.slice(0, 7)} allFilms={allFilms} />
      ) : (
        <div className="h-64 bg-slate-800/30 rounded-2xl animate-pulse" />
      )}
    </div>
  );
}

function LazyFilmHistory({ data, max, isMobile }: { data: any[]; max: number; isMobile: boolean }) {
  const { ref, shouldMount } = useLazyMount(150);
  return (
    <div ref={ref}>
      {shouldMount ? (
        <FilmHistory data={data} max={max} isMobile={isMobile} />
      ) : (
        <div className="h-48 bg-slate-800/30 rounded-2xl animate-pulse" />
      )}
    </div>
  );
}

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

