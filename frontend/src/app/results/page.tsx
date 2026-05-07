'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import ShareModal from '@/components/ShareModal';
import type { ShareCardData } from '@/components/share/types';
import LanguagesLeaderboard from '@/containers/results/LanguagesLeaderboard';
import CountriesList from '@/containers/results/CountriesList';
import PreResultsConsentModal from '@/components/PreResultsConsentModal';
import FeedbackFab, { FeedbackFabRef } from '@/components/FeedbackFab';
import { searchPerson } from '@/lib/api';
import { getTmdbImageUrl, trackEvent, trackConsentedEvent } from '@/lib/analytics';
import { getUsername } from '@/lib/session-id';
import { useRafThrottle } from '@/hooks/useRafThrottle';
import { useLazyMount } from '@/hooks/useIntersectionObserver';
import ExperimentalScreen from '@/containers/results/experimental/ExperimentalScreen';

// Import all the section components
import HeroStats from '@/containers/results/HeroStats';
import CrushAndDirectors from '@/containers/results/CrushAndDirectors';
import Genres from '@/containers/results/Genres';
import { FilmHistory, RatingsBar } from '@/containers/results/FilmAndRatings';
import QuickFacts from '@/containers/results/QuickFacts';
import CinemaScale from '@/containers/results/CinemaScale';

type Count = { name: string; count: number; profile_path?: string };
type LanguageItem = { language: string; count: number };
type CountryRow = { name: string; count: number };

interface LetterboxdStats {
  total_films: number;
  average_rating: number;
  days_watched: number;
  top_genres: { name: string; count: number }[];
  favorite_genre: { name: string; count: number };
  most_watched_director: { name: string; count: number };
  favorite_decade: { name: string; count: number };
  top_directors: Count[];
  top_actors: Count[];
  top_countries: CountryRow[];
  total_countries: number;
  top_languages: LanguageItem[];
  decades: { decade: string; count: number }[];
  average_runtime: number;
  movie_crush?: { name: string; profile_path: string; count: number };
  analysis_date: string;
  longest_film: { title: string; runtime: number };
  rating_distribution: Record<string, number>;
  most_common_rating?: number;
  monthly_viewing_habits?: { month: string; count: number }[];
  day_of_week_pattern?: { weekday: number; weekend: number };
  cinematic_persona?: { persona: string; description: string };
  director_deep_analysis?: { director_name: string; average_rating_given: number; total_films: number; relationship: string };
  sinefil_meter?: {
    type: string;
    score: number;
    description: string;
    breakdown?: {
      geography: number;
      temporal: number;
      languages: number;
      volume: number;
      genres: number;
      directors: number;
    };
    model_version?: string;
  };
  signature_combo?: { director: string; actor: string; count: number };
  data_timeline?: { earliest_date?: string; latest_date?: string; total_days?: number; period_description?: string };
}

/**
 * Client-side fallback when backend sinefil_meter is missing.
 * Mirrors the cine_v2 model with the data available in LetterboxdStats.
 * Shannon entropy computed from the top-N counts the backend provides.
 */
const calcCinephileScore = (s?: LetterboxdStats | null) => {
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
  const [stats, setStats] = useState<LetterboxdStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [mode, setMode] = useState<'stable' | 'test'>('stable');

  // consent
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');

  // share
  const [showShareModal, setShowShareModal] = useState(false);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
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
  const hasModal = () => typeof window !== 'undefined' && sessionStorage.getItem('consent_modal_shown') === 'true';
  const setModalShown = () => typeof window !== 'undefined' && sessionStorage.setItem('consent_modal_shown', 'true');
  const saveConsent = (d: 'accept' | 'decline') => typeof window !== 'undefined' && sessionStorage.setItem('consent_decision', d);

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
    const saved = localStorage.getItem('letterboxdStats'); 
    if (saved) { 
      try { 
        const parsedStats = JSON.parse(saved);
        setStats(parsedStats); 
        // Track that results were successfully loaded
        trackEvent('results_viewed', {
          total_films: parsedStats.total_films,
          average_rating: parsedStats.average_rating,
        });
        trackConsentedEvent('results_viewed_detailed', {
          total_countries: parsedStats.total_countries,
          average_runtime: parsedStats.average_runtime,
        });
      } catch (error) {
      } 
    } else {
    }
    setLoading(false); 
    
    // Get username from shared session helper
    const storedUsername = getUsername();
    if (storedUsername) {
      setUsername(storedUsername);
    } else {
    }
  }, []);

  useEffect(() => { const id = getSessionId(); setSessionId(id); const t = setTimeout(() => { if (!hasModal()) setShowConsentModal(true); }, 500); return () => clearTimeout(t); }, []);

  const handleConsentAccept = useCallback(() => { 
    setModalShown(); 
    saveConsent('accept'); 
    setShowConsentModal(false); 
  }, []);
  
  const handleConsentDecline = useCallback(() => { 
    setModalShown(); 
    saveConsent('decline'); 
    setShowConsentModal(false); 
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

  const timePct = useMemo(() => {
    const daysWatched = stats?.days_watched ?? 0;
    const safeRangeDays = Math.max(1, actualRangeDays);
    
    // Calculate based on waking hours
    const wakingHoursPerDay = 16;
    const totalWakingHours = safeRangeDays * wakingHoursPerDay;
    const hoursWatched = daysWatched * 24;
    
    let percentage = Math.round((hoursWatched / totalWakingHours) * 100);
    
    // Adjust for short periods
    if (safeRangeDays <= 30) {
      const totalAvailableHours = safeRangeDays * 24;
      percentage = Math.round((hoursWatched / totalAvailableHours) * 100);
    }
    
    return `${Math.min(percentage, 100)}%`;
  }, [stats?.days_watched, actualRangeDays]);

  const cineScore = useMemo(() => Math.max(0, Math.min(100, stats?.sinefil_meter?.score ?? calcCinephileScore(stats))), [stats]);
  const quickMetrics = useMemo(() => {
    const safeRange = Math.max(1, actualRangeDays);
    const filmsPerWeek = ((stats?.total_films ?? 0) / safeRange) * 7;
    const languageCount = stats?.top_languages?.length ?? 0;
    const decadeSpan = (stats?.decades ?? []).filter((d) => d.count > 0).length;

    return {
      filmsPerWeek,
      languageCount,
      decadeSpan,
    };
  }, [stats?.total_films, stats?.top_languages, stats?.decades, actualRangeDays]);

  // Share card props - must be before early returns to maintain hook order
  const shareCardData = useMemo<ShareCardData>(() => ({
    onScreenCrush: {
      name: stats?.top_actors?.[0]?.name || 'Unknown Actor',
      headshotUrl: getTmdbImageUrl(stats?.top_actors?.[0]?.profile_path) || '',
      count: stats?.top_actors?.[0]?.count || 0,
    },
    favoriteDirector: {
      name: stats?.most_watched_director?.name || 'Unknown Director',
      headshotUrl: directorImageUrl,
      count: stats?.most_watched_director?.count || 0,
    },
    watchedFilms: stats?.total_films || 0,
    spentDays: Math.round(stats?.days_watched || 0),
    timePercent: Number.parseInt(timePct, 10) || 0,
    cinemaScale: cineScore,
    personaLabel: stats?.cinematic_persona?.persona || '',
    minutesAverage: Math.round(stats?.average_runtime || 0),
    mostCommonRating: stats?.most_common_rating || 3.5,
    peakDecade: stats?.favorite_decade?.name || '2020s',
    peakDecadeCount: stats?.favorite_decade?.count || 0,
    topActors: (stats?.top_actors || []).slice(0, 5).map((a) => ({
      name: a.name,
      headshotUrl: getTmdbImageUrl(a.profile_path) || '',
      count: a.count,
    })),
    topDirectors: (stats?.top_directors || []).slice(0, 5).map((d) => ({
      name: d.name,
      headshotUrl: getTmdbImageUrl(d.profile_path) || '',
      count: d.count,
    })),
  }), [stats, directorImageUrl, cineScore, timePct]);

  // Load director headshot with lazy loading
  const loadDirectorImage = useCallback(async () => {
    const nm = stats?.most_watched_director?.name;
    if (!nm) return;
    
    // Only try to load director image if we have a backend API available
    if (process.env.NEXT_PUBLIC_API_BASE) {
      try {
        const data = await searchPerson(nm, 'director');
        if (data.found && data.url) {
          // Use getTmdbImageUrl to handle any URL format consistently
          const imageUrl = getTmdbImageUrl(data.url);
          if (imageUrl) {
            setDirectorImageUrl(imageUrl);
          }
        }
      } catch {
        // Silent error handling - fallback to no image
      }
    }
  }, [stats?.most_watched_director?.name]);

  useEffect(() => {
    loadDirectorImage();
  }, [loadDirectorImage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'test') setMode('test');
  }, []);

  const handleModeSwitch = useCallback((newMode: 'stable' | 'test') => {
    setMode(newMode);
    const url = new URL(window.location.href);
    if (newMode === 'stable') {
      url.searchParams.delete('mode');
    } else {
      url.searchParams.set('mode', newMode);
      trackEvent('results_test_lab_opened');
    }
    window.history.replaceState({}, '', url.toString());
  }, []);

  if (loading) return <div className="min-h-screen bg-slate-900" />;
  if (!stats) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No data found</h2>
          <p className="text-gray-400">Please upload your Letterboxd data first.</p>
          <Link href="/" className="mt-6 inline-block px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold transition-colors">Go Back</Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="font-sans bg-slate-900 text-white overflow-x-hidden relative min-h-screen">
      <PreResultsConsentModal open={showConsentModal} onAccept={handleConsentAccept} onDecline={handleConsentDecline} sessionId={sessionId} />

      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full filter blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full filter blur-[120px]" />
        </div>

      <main className="relative z-10 px-3 md:px-8 py-4 md:py-6 max-w-7xl mx-auto space-y-3 md:space-y-6">
                {/* Header */}
        <header className="text-center py-4 md:py-10">
          <h1 className="text-[clamp(32px,6vw,72px)] font-black text-white mb-4 leading-[0.95] tracking-tighter [font-family:var(--font-display)]">
            Your <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">Letterboxd</span> Wrapped
          </h1>
          <p className="text-xl text-gray-300 mb-2">A comprehensive analysis of your cinematic journey.</p>
          <p className="text-center text-gray-400 text-lg">
            {dateRangeText}
          </p>
          {username && (
            <div className="mt-3">
              <span className="inline-block px-3 py-1 bg-slate-800/60 border border-slate-700/60 rounded-full text-sm text-slate-300">
                @{username}
              </span>
            </div>
          )}

          <div className="flex justify-center mt-5">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-800/60 border border-slate-700/40 rounded-full text-sm">
              <button
                onClick={() => handleModeSwitch('stable')}
                className={`px-4 py-1.5 rounded-full font-medium transition-colors ${
                  mode === 'stable'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Stable
              </button>
              <button
                onClick={() => handleModeSwitch('test')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-medium transition-colors ${
                  mode === 'test'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${mode === 'test' ? 'bg-orange-400' : 'bg-slate-500'}`} />
                Test Lab
              </button>
            </div>
          </div>
        </header>

        {mode === 'test' ? (
          <ExperimentalScreen stats={stats} />
        ) : (
          <>
        {/* Hero Stats */}
        <HeroStats
          totalFilms={stats.total_films}
          avgRating={stats.average_rating}
          days={stats.days_watched}
          topGenre={stats.favorite_genre.name}
          timePct={timePct}
          favoriteDirector={stats.most_watched_director}
          favoriteDecade={stats.favorite_decade}
        />

        {/* Crush and Directors */}
        <CrushAndDirectors topDirectors={stats.top_directors ?? []} topActors={stats.top_actors ?? []} />

        {/* Genres */}
        <Genres genres={(stats.top_genres ?? []).slice(0, 5)} />

        {/* Languages and Countries - Lazy loaded */}
        <LazyLanguagesAndCountries
          languages={stats.top_languages ?? []}
          countries={stats.top_countries ?? []}
          totalCountries={stats.total_countries}
        />

        {/* Film History - Lazy loaded */}
        <LazyFilmHistory data={decadeData} max={decadeMax} isMobile={isMobile} />

        {/* Ratings Bar - Lazy loaded */}
        <LazyRatingsBar data={ratingsArr} max={ratingMax} />

        {/* Quick Facts - Lazy loaded */}
        <LazyQuickFacts
          avgMinutes={stats.average_runtime || 0}
          totalCountries={stats.total_countries || 0}
          mostCommonRating={stats.most_common_rating || 3.5}
          filmsPerWeek={quickMetrics.filmsPerWeek}
          languageCount={quickMetrics.languageCount}
          decadeSpan={quickMetrics.decadeSpan}
        />

        {/* Cinema Scale - Lazy loaded */}
        <LazyCinemaScale
          type={stats.sinefil_meter?.type || 'Independent Cinephile'}
          description={stats.sinefil_meter?.description}
          score={cineScore || 50}
          breakdown={stats.sinefil_meter?.breakdown}
        />
          </>
        )}

        {/* Share button */}
        <div className="flex flex-col items-center my-8 gap-3">
          <button
            onClick={() => {
              setShowShareModal(true);
              trackEvent('share_modal_opened');
            }}
            className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <div className="w-6 h-6 bg-white rounded" />
            Share Your Wrapped
          </button>
          <p className="text-xs text-slate-500 text-center">Your raw files are never stored. With consent, only anonymous viewing stats are kept to improve the product.</p>
        </div>
      </main>

      <ShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        orientation={orientation}
        setOrientation={setOrientation}
        cardProps={shareCardData}
        onDownloadSuccess={() => {
          trackEvent('share_download_success');
          if (!hasTriggeredFeedback) {
            setHasTriggeredFeedback(true);
            feedbackRef.current?.open();
          }
        }}
      />
      
      <FeedbackFab ref={feedbackRef} sessionId={sessionId} />
    </div>
  );
}

// ===================== LAZY LOADING COMPONENTS =====================

// Lazy wrapper for Languages and Countries
function LazyLanguagesAndCountries({ 
  languages, 
  countries, 
  totalCountries 
}: { 
  languages: any[]; 
  countries: any[]; 
  totalCountries: number; 
}) {
  const { ref, shouldMount } = useLazyMount(100);
  
  return (
    <div ref={ref} className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
      {shouldMount ? (
        <>
          <LanguagesLeaderboard key="languages-leaderboard" data={languages.slice(0,7)} />
          <CountriesList countries={countries.slice(0, 10)} total={totalCountries} />
        </>
      ) : (
        <div className="col-span-2 h-64 bg-slate-800/30 rounded-2xl animate-pulse" />
      )}
    </div>
  );
}

// Lazy wrapper for Film History
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

// Lazy wrapper for Ratings Bar
function LazyRatingsBar({ data, max }: { data: any[]; max: number }) {
  const { ref, shouldMount } = useLazyMount(200);
  
  return (
    <div ref={ref}>
      {shouldMount ? (
        <RatingsBar data={data} max={max} />
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
  mostCommonRating,
  filmsPerWeek,
  languageCount,
  decadeSpan,
}: { 
  avgMinutes: number; 
  totalCountries: number; 
  mostCommonRating: number; 
  filmsPerWeek: number;
  languageCount: number;
  decadeSpan: number;
}) {
  const { ref, shouldMount } = useLazyMount(250);
  
  return (
    <div ref={ref}>
      {shouldMount ? (
        <QuickFacts 
          avgMinutes={avgMinutes} 
          totalCountries={totalCountries} 
          mostCommonRating={mostCommonRating} 
          filmsPerWeek={filmsPerWeek}
          languageCount={languageCount}
          decadeSpan={decadeSpan}
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
