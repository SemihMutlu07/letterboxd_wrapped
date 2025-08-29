'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import PreResultsConsentModal from '../../components/PreResultsConsentModal';
import ShareModal from '../../components/ShareModal';
import HeroStats from '../../containers/results/HeroStats';
import CrushAndDirectors from '../../containers/results/CrushAndDirectors';
import Genres from '../../containers/results/Genres';
import LanguagesChart, { CountriesList } from '../../containers/results/Charts';
import { FilmHistory, RatingsBar } from '../../containers/results/FilmAndRatings';
import QuickFacts from '../../containers/results/QuickFacts';
import CinemaScale from '../../containers/results/CinemaScale';
import { CountItem } from '../../components/results/Cards';
import { searchPerson } from '../../lib/api';

// Types
type Count = CountItem;
interface DecadeItem { decade: string; count: number }
interface LanguageItem { language: string; count: number }
interface InsightItem { title: string; description: string }
interface LetterboxdStats {
  total_films: number;
  metadata_coverage: number;
  average_rating: number;
  most_common_rating: number;
  days_watched: number;
  hours_watched: number;
  favorite_genre: Count;
  top_genres: Count[];
  insights: InsightItem[];
  top_directors: Count[];
  total_directors: number;
  most_watched_director: Count;
  decades: DecadeItem[];
  favorite_decade: Count;
  top_countries: Count[];
  total_countries: number;
  average_runtime: number;
  top_actors: Count[];
  movie_crush?: { name: string; profile_path: string; count: number };
  top_languages: LanguageItem[];
  analysis_date: string;
  longest_film: { title: string; runtime: number };
  rating_distribution: Record<string, number>;
  monthly_viewing_habits?: { month: string; count: number }[];
  day_of_week_pattern?: { weekday: number; weekend: number };
  cinematic_persona?: { persona: string; description: string };
  director_deep_analysis?: { director_name: string; average_rating_given: number; total_films: number; relationship: string };
  sinefil_meter?: { type: string; score: number; description: string };
  signature_combo?: { director: string; actor: string; count: number };
  data_timeline?: { earliest_date?: string; latest_date?: string; total_days?: number; period_description?: string };
}

const calcCinephileScore = (s?: LetterboxdStats | null) => {
  if (!s) return 50;
  const total = s.total_films || 1;
  const us = s.top_countries?.find(c=>c.name.toLowerCase().includes('united states'))?.count ?? 0;
  const nonUS = Math.max(0, 1 - us / Math.max(1, total));
  const pre2000 = (s.decades ?? []).filter(d => /^\d{4}/.test(d.decade) && parseInt(d.decade) < 2000).reduce((a,b)=>a+b.count,0) / total;
  const langSpread = Math.min(1, ((s.top_languages?.length ?? 0) || 1) / 7);
  const ratingBias = Math.abs((s.most_common_rating ?? 3.5) - (s.average_rating ?? 3.5)) / 2;
  const raw = 0.4*nonUS + 0.35*pre2000 + 0.2*langSpread + 0.05*(1 - Math.min(1, ratingBias));
  return Math.round(raw * 100);
};

export default function ResultsPage() {
  // Debug imports
  console.log('ShareModal type:', typeof ShareModal);
  console.log('LanguagesChart type:', typeof LanguagesChart);
  
  const [stats, setStats] = useState<LetterboxdStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  
  // consent
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');

  // share
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [directorImageUrl, setDirectorImageUrl] = useState<string>('');

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

  useEffect(() => { const onResize = () => setIsMobile(window.innerWidth < 480); onResize(); window.addEventListener('resize', onResize); return () => window.removeEventListener('resize', onResize); }, []);

  useEffect(() => { const saved = localStorage.getItem('letterboxdStats'); if (saved) { try { setStats(JSON.parse(saved)); } catch {} } setLoading(false); }, []);

  useEffect(() => { const id = getSessionId(); setSessionId(id); const t = setTimeout(() => { if (!hasModal()) setShowConsentModal(true); }, 500); return () => clearTimeout(t); }, []);

  const handleConsentAccept = () => { setModalShown(); saveConsent('accept'); setShowConsentModal(false); };
  const handleConsentDecline = () => { setModalShown(); saveConsent('decline'); setShowConsentModal(false); };



  // derived - moved before early returns to maintain hook order
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

  const rangeDays = useMemo(() =>
    stats?.data_timeline?.total_days ?? Math.max(1, Math.round((new Date(stats?.data_timeline?.latest_date ?? Date.now()).getTime() - new Date(stats?.data_timeline?.earliest_date ?? Date.now()).getTime()) / 86400000)), [stats?.data_timeline]);
  const timePct = useMemo(() => `${Math.round(((stats?.days_watched ?? 0) / rangeDays) * 100)}%`, [stats?.days_watched, rangeDays]);

  const cineScore = useMemo(() => Math.max(0, Math.min(100, stats?.sinefil_meter?.score ?? calcCinephileScore(stats))), [stats]);

  // share director headshot
  useEffect(() => { (async () => { const nm = stats?.most_watched_director?.name; if (!nm) return; try { const data = await searchPerson(nm, 'director'); if (data.found && data.url) setDirectorImageUrl(data.url); } catch {} })(); }, [stats?.most_watched_director?.name]);

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
  


  // share card props
  const shareProps = {
    onScreenCrush: {
      name: stats.top_actors?.[0]?.name || 'Unknown Actor',
      headshotUrl: stats.top_actors?.[0]?.profile_path ? `https://image.tmdb.org/t/p/w300${stats.top_actors[0].profile_path}` : '',
      count: stats.top_actors?.[0]?.count || 0,
    },
    favoriteDirector: {
      name: stats.most_watched_director?.name || 'Unknown Director',
      headshotUrl: directorImageUrl,
      count: stats.most_watched_director?.count || 0,
    },
    watchedFilms: stats.total_films || 0,
    spentDays: Math.round(stats.days_watched || 0),
    timePercent: Math.round(((stats.days_watched || 0) / 365) * 100),
    cinemaScale: cineScore,
    personaLabel: stats.sinefil_meter?.type || 'Independent Cinephile',
    minutesAverage: Math.round(stats.average_runtime || 0),
    mostCommonRating: stats.most_common_rating || 3.5,
    peakDecade: stats.favorite_decade?.name || '2020s',
    peakDecadeCount: stats.favorite_decade?.count || 0,
  } as const;
  
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
          <h1 className="text-[clamp(32px,6vw,72px)] font-black text-white mb-4 leading-[0.95] tracking-tighter">
            Your <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">Letterboxd</span> Wrapped
          </h1>
          <p className="text-xl text-gray-300 mb-2">A comprehensive analysis of your cinematic journey.</p>
          {stats.data_timeline?.earliest_date && stats.data_timeline?.latest_date && (
            <p className="text-center text-gray-400 text-lg">
              Analysed from {new Date(stats.data_timeline.earliest_date).toLocaleDateString()} to {new Date(stats.data_timeline.latest_date).toLocaleDateString()}
            </p>
          )}
        </header>

        {/* Sections */}
        <HeroStats
          totalFilms={stats.total_films}
          avgRating={stats.average_rating}
          days={stats.days_watched}
          topGenre={stats.favorite_genre.name}
          timePct={timePct}
          favoriteDirector={stats.most_watched_director}
          favoriteDecade={stats.favorite_decade}
        />

        <CrushAndDirectors topDirectors={stats.top_directors ?? []} topActors={stats.top_actors ?? []} />

        <Genres genres={(stats.top_genres ?? []).slice(0, 5)} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
          <LanguagesChart key="languages-chart" data={(stats.top_languages ?? []).slice(0,7)} />
          <CountriesList countries={(stats.top_countries ?? []).slice(0, 10)} total={stats.total_countries} />
        </div>

        <FilmHistory data={decadeData} max={decadeMax} isMobile={isMobile} />
        <RatingsBar data={ratingsArr} max={ratingMax} />

        <QuickFacts avgMinutes={stats.average_runtime} totalCountries={stats.total_countries} mostCommonRating={stats.most_common_rating} />

        <CinemaScale type={stats.sinefil_meter?.type || 'Independent Cinephile'} description={stats.sinefil_meter?.description} score={cineScore} />

        {/* Share button */}
        <div className="flex justify-center my-8">
          <button onClick={() => setShowShareModal(true)} className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
            <div className="w-6 h-6 bg-white rounded" />
            Share Your Wrapped
          </button>
            </div>

        <footer className="text-center py-12">
            <p className="text-gray-400">Thank you for exploring your cinematic journey with us!</p>
        </footer>
      </main>

      {/* Share modal */}
      <ShareModal 
        open={showShareModal} 
        onClose={() => setShowShareModal(false)} 
        orientation={orientation} 
        setOrientation={setOrientation} 
        cardProps={{ ...shareProps, orientation }}
      />
    </div>
  );
}