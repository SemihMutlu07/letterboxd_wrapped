'use client';

import { useEffect, useState } from 'react';
import { motion, Variants } from 'framer-motion';
import { toPng } from 'html-to-image';
import {
  Film, Star, Clock, TrendingUp, Calendar, Award, Globe, Languages, Sparkles, User, Users, Share2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import React from 'react';
import Link from 'next/link';

// --- Interfaces for Stats Data ---
interface CountItem { name: string; count: number; }
interface ActorItem extends CountItem { profile_path?: string; }
interface DecadeItem { decade: string; count: number; }
interface LanguageItem { language: string; count: number; }
interface InsightItem { title: string; description: string; }

interface LanguageTooltipProps {
    active?: boolean;
    payload?: { payload: LanguageItem }[];
}

interface DecadeTooltipProps {
    active?: boolean;
    payload?: { value: number }[];
    label?: string;
}

interface LetterboxdStats {
  total_films: number;
  metadata_coverage: number;
  average_rating: number;
  most_common_rating: number;
  days_watched: number;
  hours_watched: number;
  favorite_genre: CountItem;
  top_genres: CountItem[];
  insights: InsightItem[];
  top_directors: CountItem[];
  total_directors: number;
  most_watched_director: CountItem;
  decades: DecadeItem[];
  favorite_decade: CountItem;
  top_countries: CountItem[];
  total_countries: number;
  average_runtime: number;
  top_actors: ActorItem[];
  movie_crush?: { name: string; profile_path: string; count: number };
  top_languages: LanguageItem[];
  analysis_date: string;
  has_ratings_data: boolean;
  has_diary_data: boolean;
  has_watchlist_data: boolean;
  has_reviews_data: boolean;
  longest_film: { title: string; runtime: number };
  rating_distribution: Record<string, number>;
  top_rewatches?: { name: string; count: number }[];
  top_true_rewatches?: CountItem[];
  most_logged_films?: CountItem[];
  monthly_viewing_habits?: { month: string; count: number }[];
  day_of_week_pattern?: { weekday: number; weekend: number };
  cinematic_persona?: { persona: string; description: string };
  director_deep_analysis?: { director_name: string; average_rating_given: number; total_films: number; relationship: string };
  my_star?: { name: string; count: number };
  sinefil_meter?: { type: string; score: number; description: string };
  fun_statistics?: {
    highest_budget_film?: { title: string; budget: number };
    highest_grossing_film?: { title: string; revenue: number };
    guilty_pleasure?: { title: string; tmdb_rating: number; your_rating: number };
    favorite_genre_combo?: { combination: string; count: number };
    world_tour?: { country: string; flag: string; count: number }[];
    film_age_analysis?: { average_age: number; recent_percentage: number; type: string };
  };
  story_analytics?: {
    time_spent_story?: string;
    most_active_day?: { date: string; films: number; story: string };
    rating_personality?: { type: string; description: string; average: number };
    signature_duo?: { director: string; actor: string; count: number; story: string };
    viewing_season?: { season: string; percentage: number; story: string };
    cinematic_passport?: { countries: number; directors: number; country_story: string; director_story: string };
    cinema_archetype?: { type: string; description: string; popularity_score: number; film_age: number };
  };
  secret_obsession?: string;
  runtime_persona?: string;
  furthest_destination?: string;
}

// --- Reusable Components ---

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  unit: string;
  gradient: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, unit, gradient }) => (
  <motion.div
    variants={itemVariants}
    className={`p-6 md:p-8 rounded-3xl text-white shadow-2xl ${gradient} transition-transform hover:scale-105`}
  >
    <div className="flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-6">
      {icon}
    </div>
            <div className="text-3xl md:text-5xl font-black mb-2">{value} <span className="text-xl md:text-3xl opacity-80">{unit}</span></div>
    <p className="text-lg opacity-90 font-medium">{title}</p>
  </motion.div>
);

interface SectionProps {
    children: React.ReactNode;
    className?: string;
}

const Section: React.FC<SectionProps> = ({ children, className = "" }) => (
  <motion.section
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 0.2 }}
    variants={containerVariants}
    className={`bg-white/5 backdrop-blur-2xl rounded-3xl p-6 md:p-10 border border-white/10 shadow-2xl ${className}`}
  >
    {children}
  </motion.section>
);

interface SectionTitleProps {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
}

const SectionTitle: React.FC<SectionTitleProps> = ({ icon, title, subtitle }) => (
  <div className="flex items-center mb-8">
    <div className="w-16 h-16 bg-gradient-to-br from-white/10 to-white/5 rounded-2xl flex items-center justify-center mr-5 shadow-inner-white">
      {icon}
    </div>
    <div>
              <h3 className="text-2xl md:text-4xl font-bold text-white tracking-tight">{title}</h3>
      <p className="text-md text-gray-400 mt-1">{subtitle}</p>
    </div>
  </div>
);

// Animation Variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};
const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } }
};
const chartVariants: Variants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
};

const languageMap: { [key: string]: string } = {
    en: 'English', fr: 'French', ja: 'Japanese', es: 'Spanish', ko: 'Korean',
    de: 'German', it: 'Italian', ru: 'Russian', pt: 'Portuguese', zh: 'Chinese',
    hi: 'Hindi', sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish'
};

// Custom Tooltip for Recharts
const CustomTooltip: React.FC<LanguageTooltipProps> = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const languageName = languageMap[data.language] || data.language.toUpperCase();
      return (
        <div className="bg-slate-800/80 backdrop-blur-sm p-3 rounded-lg border border-white/20 text-white shadow-lg">
          <p className="font-bold text-base">{`${languageName}: ${data.count} films`}</p>
        </div>
      );
    }
    return null;
};

const DecadeTooltip: React.FC<DecadeTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800/80 backdrop-blur-sm p-3 rounded-lg border border-white/20 text-white shadow-lg">
        <p className="font-bold text-lg mb-1">{label}</p>
        <p className="text-base text-orange-400">{`${payload[0].value} films`}</p>
      </div>
    );
  }
  return null;
};

// --- Main Page Component ---
const ComprehensiveResultsPage = () => {
  const [stats, setStats] = useState<LetterboxdStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareLayout, setShareLayout] = useState<'horizontal' | 'vertical' | 'square'>('horizontal');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const savedStats = localStorage.getItem('letterboxdStats');
    if (savedStats) {
      try {
        setStats(JSON.parse(savedStats));
      } catch (err) {
        console.error('Error parsing stats:', err);
      }
    }
    setLoading(false);
  }, []);

  const handleShare = async () => {
    setIsDownloading(true);
    const shareCard = document.getElementById(`shareable-wrapped-${shareLayout}`);
    if (shareCard && stats) {
        const totalFilms = shareCard.querySelector('.share-total-films');
        if (totalFilms) totalFilms.textContent = stats.total_films.toString();

        const movieCrush = shareCard.querySelector('.share-movie-crush');
        if (movieCrush) movieCrush.textContent = stats.movie_crush?.name || 'N/A';
        
        const director = shareCard.querySelector('.share-signature-director');
        if (director) director.textContent = stats.most_watched_director?.name || 'N/A';

        const genre = shareCard.querySelector('.share-comfort-genre');
        if (genre) genre.textContent = stats.favorite_genre?.name || 'N/A';

        const decade = shareCard.querySelector('.share-time-machine');
        if (decade) decade.textContent = stats.favorite_decade?.name || 'N/A';

        shareCard.style.display = 'block';
        
        // Brief delay to ensure rendering
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const dataUrl = await toPng(shareCard, { cacheBust: true });
            const link = document.createElement('a');
            link.download = `my-letterboxd-wrapped-${shareLayout}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Failed to capture image', err);
        } finally {
            shareCard.style.display = 'none';
            setIsDownloading(false);
        }
    } else {
        setIsDownloading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-900" />;
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No data found</h2>
          <p className="text-gray-400">Please upload your Letterboxd data first.</p>
          <Link href="/" className="mt-6 inline-block px-6 py-2 bg-orange-500 rounded-lg font-bold">
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  // --- Data Transformations for Charts ---
  const decadeData = stats.decades ? [...stats.decades].sort((a, b) => parseInt(a.decade) - parseInt(b.decade)) : [];
  const languageData = stats.top_languages ? stats.top_languages.slice(0, 7) : [];
  const totalLanguageCount = languageData.reduce((acc, lang) => acc + lang.count, 0);
  const COLORS = ['#FF6B6B', '#4D96FF', '#6BCB77', '#FFD93D', '#9D6A74', '#FF8C42', '#A06CD5'];
  
  const genreGradients = [
      'from-pink-900/80 to-orange-800/80',
      'from-cyan-900/80 to-blue-800/80',
      'from-violet-900/80 to-purple-800/80',
      'from-amber-900/80 to-red-800/80',
      'from-lime-900/80 to-green-800/80',
  ];
  
  return (
    <div className={`font-sans bg-slate-900 text-white overflow-x-hidden relative`}>
        {/* Hidden Shareable Cards */}
        <div id="shareable-wrapped-horizontal" style={{ display: 'none', position: 'absolute', left: '-9999px' }} className="p-8 bg-slate-800 text-white rounded-lg shadow-xl w-[1200px] h-[630px]">
            <h2 className="text-5xl font-bold text-center mb-8 text-orange-400">My Letterboxd Wrapped</h2>
            <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="flex justify-between items-baseline"><span className="font-semibold text-3xl">Total Films:</span><span className="share-total-films text-4xl font-bold"></span></div>
                    <div className="flex justify-between items-baseline"><span className="font-semibold text-3xl">Movie Crush:</span><span className="share-movie-crush text-3xl font-bold"></span></div>
                </div>
                <div className="space-y-4">
                    <div className="flex justify-between items-baseline"><span className="font-semibold text-3xl">Signature Director:</span><span className="share-signature-director text-3xl font-bold"></span></div>
                    <div className="flex justify-between items-baseline"><span className="font-semibold text-3xl">Comfort Genre:</span><span className="share-comfort-genre text-3xl font-bold"></span></div>
                    <div className="flex justify-between items-baseline"><span className="font-semibold text-3xl">Time Machine:</span><span className="share-time-machine text-3xl font-bold"></span></div>
                </div>
            </div>
        </div>

        <div id="shareable-wrapped-vertical" style={{ display: 'none', position: 'absolute', left: '-9999px' }} className="p-8 bg-slate-800 text-white rounded-lg shadow-xl w-[1080px] h-[1920px]">
            <h2 className="text-8xl font-bold text-center mb-16 text-orange-400">My Letterboxd Wrapped</h2>
            <div className="space-y-12">
                <div className="text-center"><div className="font-semibold text-5xl mb-4">Total Films</div><div className="share-total-films text-7xl font-bold"></div></div>
                <div className="text-center"><div className="font-semibold text-5xl mb-4">Movie Crush</div><div className="share-movie-crush text-6xl font-bold"></div></div>
                <div className="text-center"><div className="font-semibold text-5xl mb-4">Signature Director</div><div className="share-signature-director text-6xl font-bold"></div></div>
                <div className="text-center"><div className="font-semibold text-5xl mb-4">Comfort Genre</div><div className="share-comfort-genre text-6xl font-bold"></div></div>
                <div className="text-center"><div className="font-semibold text-5xl mb-4">Time Machine</div><div className="share-time-machine text-6xl font-bold"></div></div>
            </div>
        </div>

        <div id="shareable-wrapped-square" style={{ display: 'none', position: 'absolute', left: '-9999px' }} className="p-8 bg-slate-800 text-white rounded-lg shadow-xl w-[1080px] h-[1080px]">
            <h2 className="text-6xl font-bold text-center mb-12 text-orange-400">My Letterboxd Wrapped</h2>
            <div className="space-y-8">
                <div className="flex justify-between items-baseline"><span className="font-semibold text-4xl">Total Films:</span><span className="share-total-films text-5xl font-bold"></span></div>
                <div className="flex justify-between items-baseline"><span className="font-semibold text-4xl">Movie Crush:</span><span className="share-movie-crush text-4xl font-bold"></span></div>
                <div className="flex justify-between items-baseline"><span className="font-semibold text-4xl">Signature Director:</span><span className="share-signature-director text-4xl font-bold"></span></div>
                <div className="flex justify-between items-baseline"><span className="font-semibold text-4xl">Comfort Genre:</span><span className="share-comfort-genre text-4xl font-bold"></span></div>
                <div className="flex justify-between items-baseline"><span className="font-semibold text-4xl">Time Machine:</span><span className="share-time-machine text-4xl font-bold"></span></div>
            </div>
        </div>

        <div className="absolute inset-0 z-0 opacity-40 overflow-x-hidden">
             <div className="absolute top-[-10rem] left-[-10rem] w-[40rem] h-[40rem] bg-purple-600/50 rounded-full filter blur-[150px] animate-blob"></div>
             <div className="absolute top-[-5rem] right-[-10rem] w-[40rem] h-[40rem] bg-orange-600/50 rounded-full filter blur-[150px] animate-blob animation-delay-2000"></div>
             <div className="absolute bottom-[-10rem] left-[15rem] w-[40rem] h-[40rem] bg-blue-600/50 rounded-full filter blur-[150px] animate-blob animation-delay-4000"></div>
        </div>
      <main id="letterboxd-wrapped-results" className="relative z-10 p-4 md:p-8 max-w-7xl mx-auto space-y-8 md:space-y-12">
        {/* Header */}
        <header className="text-center py-8 md:py-16">
          <motion.h1 
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="text-6xl md:text-8xl font-black text-white mb-4 leading-tight tracking-tighter"
          >
            Your <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              Letterboxd
            </span> Wrapped
          </motion.h1>
          <motion.p 
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            transition={{delay: 0.2}}
            className="text-xl text-gray-300"
          >
            A comprehensive analysis of your cinematic journey.
          </motion.p>
        </header>

        {/* Main Stats Grid */}
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8"
        >
          <StatCard icon={<Film size={36} className="text-amber-400"/>} title="Total Films" value={stats.total_films} unit="films" gradient="from-slate-800 to-orange-900" />
          <StatCard icon={<Star size={36} className="text-yellow-400"/>} title="Average Rating" value={stats.average_rating.toFixed(2)} unit="★" gradient="from-slate-800 to-yellow-900" />
          <StatCard icon={<Clock size={36} className="text-sky-400"/>} title="Days Watched" value={stats.days_watched.toFixed(1)} unit="days" gradient="from-slate-800 to-sky-900" />
          <StatCard icon={<TrendingUp size={36} className="text-rose-400"/>} title="Top Genre" value={stats.favorite_genre.name} unit="" gradient="from-slate-800 to-rose-900" />
        </motion.div>

        {/* Cinematic Persona */}
        {stats.cinematic_persona && (
            <Section>
                <div className="text-center">
                    <motion.div 
                        variants={itemVariants}
                        className="bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 p-8 rounded-3xl text-center"
                    >
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-4">🎬 YOUR CINEMATIC DNA</h2>
                        <h3 className="text-2xl md:text-4xl font-bold text-yellow-300 mb-6">{stats.cinematic_persona.persona}</h3>
                        <p className="text-xl text-white/90 max-w-2xl mx-auto">{stats.cinematic_persona.description}</p>
                    </motion.div>
                </div>
            </Section>
        )}

        {/* --- Your Movie Crush --- */}
        {stats.movie_crush && (
            <Section>
                <SectionTitle icon={<Star size={28} className="text-pink-400" />} title="Your On-Screen Crush" subtitle="The actor you couldn't get enough of" />
                <div className="flex flex-col items-center text-center">
                    <motion.div variants={itemVariants} className="relative w-48 h-48 md:w-64 md:h-64 mb-6">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                            src={`https://image.tmdb.org/t/p/w500${stats.movie_crush.profile_path}`} 
                            alt={stats.movie_crush.name}
                            className="rounded-full object-cover w-full h-full shadow-lg border-4 border-pink-500/50"
                        />
                         <div className="absolute -top-2 -right-2 text-3xl animate-pulse">💖</div>
                    </motion.div>
                    <h3 className="text-3xl md:text-4xl font-bold text-white">{stats.movie_crush.name}</h3>
                    <p className="text-xl text-pink-300 font-semibold">{stats.movie_crush.count} films together</p>
                </div>
            </Section>
        )}

        {/* STORY ANALYTICS */}
        {stats.story_analytics && (
            <>
                {stats.most_watched_director && (
                    <Section>
                        <SectionTitle icon={<Award size={28} className="text-orange-300" />} title="Your Signature Director" subtitle="The director whose vision you trust the most." />
                        <div className="text-center">
                            <h3 className="text-3xl md:text-4xl font-bold text-white">{stats.most_watched_director.name}</h3>
                            <p className="text-xl text-orange-400 font-semibold">{stats.most_watched_director.count} films</p>
                        </div>
                    </Section>
                )}
                {stats.favorite_genre && (
                    <Section>
                        <SectionTitle icon={<Film size={28} className="text-rose-400" />} title="Your Cinematic Home" subtitle="When in doubt, this is your go-to genre." />
                        <div className="text-center">
                            <h3 className="text-3xl md:text-4xl font-bold text-white">{stats.favorite_genre.name}</h3>
                            <p className="text-xl text-rose-400 font-semibold">{stats.favorite_genre.count} films</p>
                        </div>
                    </Section>
                )}
                {stats.total_countries > 0 && stats.furthest_destination && (
                    <Section>
                        <SectionTitle icon={<Globe size={28} className="text-emerald-400" />} title="Your Cinematic Passport" subtitle="" />
                        <div className="text-center">
                            <p className="text-xl text-white/90 max-w-2xl mx-auto">Your film journey took you to <span className="font-bold text-emerald-400">{stats.total_countries}</span> different countries this year, with your most frequent exotic destination being <span className="font-bold text-emerald-400">{stats.furthest_destination}</span>.</p>
                        </div>
                    </Section>
                )}
                {stats.favorite_decade && (
                    <Section>
                        <SectionTitle icon={<Calendar size={28} className="text-sky-400" />} title="Your Time Machine Destination" subtitle={`You explored the cinematic treasures of the ${stats.favorite_decade.name} most often.`} />
                        <div className="text-center">
                            <h3 className="text-6xl md:text-8xl font-black text-white">{stats.favorite_decade.name}</h3>
                        </div>
                    </Section>
                )}
                {stats.secret_obsession && (
                    <Section>
                        <SectionTitle icon={<Sparkles size={28} className="text-yellow-400" />} title="Your Secret Obsession" subtitle={`Beyond genres, you have a special interest in movies featuring ${stats.secret_obsession}.`} />
                        <div className="text-center">
                            <h3 className="text-4xl md:text-5xl font-bold text-white capitalize">{stats.secret_obsession}</h3>
                        </div>
                    </Section>
                )}
                {stats.runtime_persona && stats.average_runtime && (
                    <Section>
                        <SectionTitle icon={<Clock size={28} className="text-indigo-400" />} title="The Marathoner vs. The Sprinter" subtitle={`Your average film was ${stats.average_runtime.toFixed(0)} minutes.`} />
                        <div className="text-center">
                            <h3 className="text-4xl md:text-5xl font-bold text-white">{stats.runtime_persona}</h3>
                            <p className="text-xl text-white/90 max-w-2xl mx-auto mt-4">
                                {stats.runtime_persona === 'The Marathoner' && "You love epic stories and aren't afraid of a long runtime."}
                                {stats.runtime_persona === 'The Sprinter' && "You prefer concise stories that get straight to the point."}
                                {stats.runtime_persona === 'The Balanced Viewer' && "You enjoy a mix of both long and short films."}
                            </p>
                        </div>
                    </Section>
                )}

                {/* Time Spent Story */}
                {stats.story_analytics.time_spent_story && (
                    <Section>
                        <div className="text-center">
                            <motion.div 
                                variants={itemVariants}
                                className="bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 p-8 rounded-3xl"
                            >
                                <h2 className="text-2xl md:text-4xl font-black text-white mb-6">⏰ TIME WELL SPENT?</h2>
                                <p className="text-2xl text-white/95 max-w-3xl mx-auto leading-relaxed">
                                    {stats.story_analytics.time_spent_story}
                                </p>
                            </motion.div>
                        </div>
                    </Section>
                )}

                {/* Most Active Day */}
                {stats.story_analytics.most_active_day && (
                    <Section>
                        <div className="text-center">
                            <motion.div 
                                variants={itemVariants}
                                className="bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 p-8 rounded-3xl"
                            >
                                <h2 className="text-2xl md:text-4xl font-black text-white mb-6">🔥 YOUR MARATHON DAY</h2>
                                <div className="text-5xl md:text-8xl mb-4">📅</div>
                                <p className="text-2xl text-white/95 max-w-3xl mx-auto leading-relaxed">
                                    {stats.story_analytics.most_active_day.story}
                                </p>
                            </motion.div>
                        </div>
                    </Section>
                )}
                
                {/* Rating Personality */}
                {stats.story_analytics.rating_personality && (
                    <Section>
                        <SectionTitle icon={<Star size={28} className="text-yellow-400" />} title="Your Rating Personality ⭐" subtitle="How you judge movies" />
                        <div className="text-center bg-gradient-to-br from-yellow-500/20 to-amber-500/20 rounded-2xl p-8">
                            <h3 className="text-2xl md:text-4xl font-bold text-white mb-4">{stats.story_analytics.rating_personality.type}</h3>
                            <div className="text-4xl md:text-6xl font-black text-yellow-400 mb-4">{stats.story_analytics.rating_personality.average}★</div>
                            <p className="text-xl text-white/90 max-w-2xl mx-auto">{stats.story_analytics.rating_personality.description}</p>
                        </div>
                    </Section>
                )}

                {/* Signature Duo */}
                {stats.story_analytics.signature_duo && (
                    <Section>
                        <SectionTitle icon={<Users size={28} className="text-pink-400" />} title="Your Signature Combo 🎭" subtitle="Favorite director-actor pairing" />
                        <div className="text-center bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-2xl p-8">
                            <div className="text-6xl mb-6">🤝</div>
                            <h3 className="text-3xl font-bold text-white mb-2">
                                {stats.story_analytics.signature_duo.director} × {stats.story_analytics.signature_duo.actor}
                            </h3>
                            <p className="text-xl text-pink-400 font-semibold mb-4">{stats.story_analytics.signature_duo.count} films together</p>
                            <p className="text-lg text-white/90 max-w-2xl mx-auto">{stats.story_analytics.signature_duo.story}</p>
                        </div>
                    </Section>
                )}
                
                {/* Viewing Season */}
                {stats.story_analytics.viewing_season && (
                    <Section>
                        <SectionTitle icon={<Calendar size={28} className="text-green-400" />} title="Your Movie Season 🌍" subtitle="When you watch the most" />
                        <div className="text-center bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl p-8">
                            <div className="text-7xl mb-4">
                                {stats.story_analytics.viewing_season.season === 'Winter' && '❄️'}
                                {stats.story_analytics.viewing_season.season === 'Spring' && '🌸'}
                                {stats.story_analytics.viewing_season.season === 'Summer' && '☀️'}
                                {stats.story_analytics.viewing_season.season === 'Fall' && '🍂'}
                            </div>
                            <h3 className="text-2xl md:text-4xl font-bold text-white mb-4">{stats.story_analytics.viewing_season.season}</h3>
                            <p className="text-xl text-white/90 max-w-2xl mx-auto">{stats.story_analytics.viewing_season.story}</p>
                        </div>
                    </Section>
                )}
                
                {/* Cinematic Passport */}
                {stats.story_analytics.cinematic_passport && (
                    <Section>
                        <SectionTitle icon={<Globe size={28} className="text-blue-400" />} title="Your Cinematic Passport 🗺️" subtitle="New worlds you discovered" />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl p-6">
                                <div className="text-3xl md:text-5xl mb-4 text-center">🌍</div>
                                <h4 className="text-xl font-bold text-white mb-3 text-center">Country Discovery</h4>
                                <p className="text-white/90 text-center">{stats.story_analytics.cinematic_passport.country_story}</p>
                            </div>
                            <div className="bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-2xl p-6">
                                <div className="text-3xl md:text-5xl mb-4 text-center">🎬</div>
                                <h4 className="text-xl font-bold text-white mb-3 text-center">Director Discovery</h4>
                                <p className="text-white/90 text-center">{stats.story_analytics.cinematic_passport.director_story}</p>
                            </div>
                        </div>
                    </Section>
                )}

                {/* Cinema Archetype */}
                {stats.story_analytics.cinema_archetype && (
                    <Section>
                        <div className="text-center">
                            <motion.div 
                                variants={itemVariants}
                                className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 p-10 rounded-3xl"
                            >
                                <h2 className="text-3xl md:text-5xl font-black text-white mb-4">🏆 YOUR 2025 CINEMA IDENTITY</h2>
                                <div className="text-5xl md:text-8xl mb-6">🎪</div>
                                <h3 className="text-2xl md:text-5xl font-bold text-yellow-300 mb-6">{stats.story_analytics.cinema_archetype.type}</h3>
                                <p className="text-2xl text-white/95 max-w-3xl mx-auto leading-relaxed mb-8">
                                    {stats.story_analytics.cinema_archetype.description}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-md mx-auto">
                                    <div className="bg-black/20 rounded-xl p-4">
                                        <p className="text-sm text-gray-300">Popularity Score</p>
                                        <p className="text-2xl font-bold text-white">{stats.story_analytics.cinema_archetype.popularity_score}</p>
                                    </div>
                                    <div className="bg-black/20 rounded-xl p-4">
                                        <p className="text-sm text-gray-300">Average Film Age</p>
                                        <p className="text-2xl font-bold text-white">{stats.story_analytics.cinema_archetype.film_age} years</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </Section>
                )}
            </>
        )}

        {/* My Star & Director Analysis */}
        {(stats.my_star || stats.director_deep_analysis) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
                {/* My Star */}
                {stats.my_star && (
                    <Section>
                        <SectionTitle icon={<Star size={28} className="text-yellow-400" />} title="Your Star ⭐" subtitle="Most watched actor/actress" />
                        <div className="text-center bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl p-8">
                            <div className="text-4xl md:text-6xl mb-4">🌟</div>
                            <h3 className="text-xl md:text-3xl font-bold text-white mb-2">{stats.my_star.name}</h3>
                            <p className="text-xl text-yellow-400 font-semibold">{stats.my_star.count} films together</p>
                            <p className="text-gray-300 mt-2">You&apos;re their most loyal fan!</p>
                        </div>
                    </Section>
                )}

                {/* Director Deep Analysis */}
                {stats.director_deep_analysis && (
                    <Section>
                        <SectionTitle icon={<Award size={28} className="text-orange-400" />} title="Director Relationship 🎯" subtitle="Your connection with your favorite director" />
                        <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-2xl p-6">
                            <h3 className="text-2xl font-bold text-white mb-4">{stats.director_deep_analysis.director_name}</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-300">Average rating given:</span>
                                    <span className="text-orange-400 font-bold">{stats.director_deep_analysis.average_rating_given}★</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-300">Films watched:</span>
                                    <span className="text-white font-bold">{stats.director_deep_analysis.total_films}</span>
                                </div>
                                <div className="text-center mt-4 p-3 bg-black/20 rounded-lg">
                                    <span className="text-yellow-300 font-semibold">
                                        You&apos;re a {stats.director_deep_analysis.relationship} viewer!
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Section>
                )}
            </div>
        )}

        {/* Cinema Enthusiast Meter */}
        {stats.sinefil_meter && (
            <Section>
                <SectionTitle icon={<TrendingUp size={28} className="text-indigo-400" />} title="Your Cinema Scale 📊" subtitle="Popular vs Niche film preferences" />
                <div className="text-center">
                    <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl p-8 mb-6">
                        <h3 className="text-2xl md:text-4xl font-bold text-white mb-4">{stats.sinefil_meter.type}</h3>
                        <div className="flex justify-center items-center mb-4">
                            <div className="text-4xl md:text-6xl font-black text-indigo-400">{stats.sinefil_meter.score}</div>
                            <div className="text-xl text-gray-400 ml-2">/ 100</div>
                        </div>
                        <p className="text-xl text-white/90">{stats.sinefil_meter.description}</p>
                    </div>
                    
                    {/* Visual meter */}
                    <div className="w-full bg-gray-700 rounded-full h-6 mb-4">
                        <div 
                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-6 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(stats.sinefil_meter.score, 100)}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-400">
                        <span>Independent Cinephile</span>
                        <span>Popular Explorer</span>
                    </div>
                </div>
            </Section>
        )}

        {/* Special Insights */}
        {stats.insights && (
            <Section>
                <SectionTitle icon={<Sparkles size={28} className="text-yellow-300"/>} title="Special Insights" subtitle="Fun facts from your viewing habits" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {stats.insights.slice(0, 3).map((insight) => (
                    <motion.div variants={itemVariants} key={insight.title} className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-2xl p-6">
                        <h4 className="font-bold text-2xl text-orange-400 mb-3">{insight.title}</h4>
                        <p className="text-lg text-gray-200">{insight.description}</p>
                    </motion.div>
                    ))}
                </div>
            </Section>
        )}

        {/* Directors & Runtime */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
            <div className="lg:col-span-2">
                {/* Favorite Directors */}
                <Section>
                    <SectionTitle icon={<Award size={28} className="text-orange-300" />} title="Favorite Directors" subtitle={`${stats.total_directors} directors watched`} />
                    <div className="space-y-2">
                        {stats.top_directors.slice(0, 5).map((director) => (
                            <motion.div variants={itemVariants} key={director.name} className="flex items-center gap-4 py-3 border-b border-white/10">
                                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                    <User size={32} className="text-gray-400" />
                                </div>
                                <div className="flex-grow min-w-0">
                                    <p className="font-semibold text-lg text-white truncate">{director.name}</p>
                                </div>
                                <div className="flex items-baseline gap-2 text-right shrink-0">
                                    <span className="font-bold text-3xl text-orange-400">{director.count}</span>
                                    <span className="text-gray-400">films</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </Section>
            </div>
            <div className="space-y-8">
                {/* Runtime Record */}
                <Section>
                    <SectionTitle icon={<Clock size={24} className="text-teal-400" />} title="Runtime Analysis" subtitle="How long you like your movies" />
                    <div className="text-center my-8">
                        <div className="text-5xl md:text-8xl font-black text-white">{stats.average_runtime.toFixed(0)}</div>
                        <p className="text-gray-300 text-lg">minutes average</p>
                    </div>
                    <div className="text-center">
                        <div>
                            <p className="text-gray-400 text-sm">Longest Film</p>
                            <p className="font-bold text-lg">{stats.longest_film.title}</p>
                            <p className="text-teal-400 font-mono">{stats.longest_film.runtime} min</p>
                        </div>
                    </div>
                </Section>
            </div>
        </div>

        {/* Languages & Top Countries */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
          <Section>
              <SectionTitle icon={<Languages size={28} className="text-blue-300" />} title="Languages" subtitle="Your cinematic linguistic profile" />
              <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 items-center">
                  <motion.div variants={chartVariants} className="w-full h-64 md:h-80">
                      <ResponsiveContainer>
                          <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                              <Pie data={languageData} dataKey="count" nameKey="language" cx="50%" cy="50%" innerRadius={70} outerRadius={110} fill="#8884d8" paddingAngle={5} cornerRadius={10}>
                                  {languageData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                              </Pie>
                              <Tooltip
                                  cursor={{fill: 'rgba(255,255,255,0.1)'}}
                                  content={<CustomTooltip />}
                              />
                          </PieChart>
                      </ResponsiveContainer>
                  </motion.div>
                  <motion.div variants={containerVariants} className="flex flex-col gap-y-4">
                      {languageData.map((entry, index) => (
                          <motion.div variants={itemVariants} key={entry.language} className="flex items-center text-base">
                              <div className="w-4 h-4 rounded-full mr-3 shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                              <span className="font-medium text-gray-300">{languageMap[entry.language] || entry.language.toUpperCase()}</span>
                              <span className="font-bold text-white ml-auto">{((entry.count / totalLanguageCount) * 100).toFixed(1)}%</span>
                          </motion.div>
                      ))}
                  </motion.div>
              </div>
          </Section>
          <Section>
              <SectionTitle icon={<Globe size={28} className="text-green-300" />} title="Top Countries" subtitle={`Films from ${stats.total_countries} countries`} />
              <div className="space-y-2">
                  {stats.top_countries.slice(0, 8).map((country, index) => (
                  <motion.div variants={itemVariants} key={country.name} className="flex justify-between items-center py-1">
                      <div className="flex items-center">
                          <span className="text-sm font-bold w-8 text-gray-400">#{index + 1}</span>
                          <span className="font-semibold text-lg">{country.name}</span>
                      </div>
                      <span className="font-bold text-lg text-gray-300 bg-white/5 py-1 px-2 rounded-lg">{country.count}</span>
                  </motion.div>
                  ))}
              </div>
          </Section>
        </div>

        {/* Top Genres */}
        <Section>
            <SectionTitle icon={<TrendingUp size={28} className="text-yellow-300" />} title="Top Genres" subtitle="Your most-watched movie genres" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                {stats.top_genres.slice(0, 5).map((genre, i) => (
                <motion.div 
                    variants={itemVariants} 
                    key={genre.name} 
                    className={`relative rounded-2xl p-4 md:p-6 text-center transition-transform duration-300 hover:scale-105 group overflow-hidden`}
                >
                    <div className={`absolute inset-0 bg-gradient-to-br ${genreGradients[i % genreGradients.length]} opacity-60 group-hover:opacity-80 transition-opacity`}></div>
                    <div className="relative">
                        <h4 className="font-bold text-2xl text-white mb-1">{genre.name}</h4>
                        <p className="text-base text-white/90 font-medium">{genre.count} films</p>
                    </div>
                </motion.div>
                ))}
            </div>
        </Section>
        {/* Decade Chart */}
        <Section>
            <SectionTitle icon={<Calendar size={28} className="text-purple-400" />} title="Films by Decade" subtitle="Your journey through film history" />
            <motion.div variants={chartVariants} className="w-full h-64 md:h-80 mt-4">
                <ResponsiveContainer>
                    <LineChart data={decadeData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <XAxis dataKey="decade" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                        <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }}/>
                        <Tooltip
                            cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }}
                            content={<DecadeTooltip />}
                        />
                        <Line type="monotone" dataKey="count" name="Films" stroke="#fb923c" strokeWidth={3} dot={{ r: 5, fill: '#fb923c' }} activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            </motion.div>
        </Section>
        
        {/* Rating Distribution */}
        <Section>
            <SectionTitle icon={<Star size={28} className="text-yellow-400" />} title="Rating Distribution" subtitle="How you rate films" />
            <motion.div variants={chartVariants} className="w-full h-64 md:h-80 mt-4">
                <ResponsiveContainer>
                    <BarChart data={Object.entries(stats.rating_distribution).map(([rating, count]) => ({ rating: `${rating}★`, count }))}>
                        <XAxis dataKey="rating" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                        <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }}/>
                        <Tooltip
                            cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                            contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }}
                        />
                        <Bar dataKey="count" fill="#8884d8" />
                    </BarChart>
                </ResponsiveContainer>
            </motion.div>
        </Section>

        {/* Monthly Viewing Habits */}
        {stats.monthly_viewing_habits && stats.monthly_viewing_habits.length > 0 && (
            <Section>
                <SectionTitle icon={<Calendar size={28} className="text-green-400" />} title="Monthly Viewing Habits" subtitle="Your film watching patterns throughout the year" />
                <motion.div variants={chartVariants} className="w-full h-64 md:h-80 mt-4">
                    <ResponsiveContainer>
                        <BarChart data={stats.monthly_viewing_habits}>
                            <XAxis 
                                dataKey="month" 
                                stroke="#9ca3af" 
                                tick={{ fill: '#9ca3af' }}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                            />
                            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }}/>
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                                contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }}
                            />
                            <Bar dataKey="count" fill="#10b981" />
                        </BarChart>
                    </ResponsiveContainer>
                </motion.div>
            </Section>
        )}

        {/* Weekday vs Weekend Breakdown */}
        {stats.day_of_week_pattern && (
            <Section>
                <SectionTitle icon={<Clock size={28} className="text-indigo-400" />} title="Weekday vs. Weekend Breakdown" subtitle="When do you prefer to watch movies?" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    <motion.div variants={chartVariants} className="w-full h-64 lg:h-80">
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie 
                                    data={[
                                        { name: 'Weekday', value: stats.day_of_week_pattern.weekday, fill: '#6366f1' },
                                        { name: 'Weekend', value: stats.day_of_week_pattern.weekend, fill: '#f59e0b' }
                                    ]}
                                    dataKey="value" 
                                    nameKey="name" 
                                    cx="50%" 
                                    cy="50%" 
                                    innerRadius={60} 
                                    outerRadius={100} 
                                    paddingAngle={5}
                                    cornerRadius={10}
                                >
                                </Pie>
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                                    contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </motion.div>
                    <div className="flex flex-col gap-6 lg:gap-8">
                        <div className="flex items-center text-lg">
                            <div className="w-6 h-6 rounded-full bg-indigo-500 mr-4"></div>
                            <span className="text-gray-300 font-medium">Weekday</span>
                            <span className="text-white font-bold ml-auto text-xl">{stats.day_of_week_pattern.weekday}</span>
                        </div>
                        <div className="flex items-center text-lg">
                            <div className="w-6 h-6 rounded-full bg-amber-500 mr-4"></div>
                            <span className="text-gray-300 font-medium">Weekend</span>
                            <span className="text-white font-bold ml-auto text-xl">{stats.day_of_week_pattern.weekend}</span>
                        </div>
                        <div className="mt-4 p-4 bg-slate-800/50 rounded-xl">
                            <p className="text-gray-300 text-center">
                                {stats.day_of_week_pattern.weekday > stats.day_of_week_pattern.weekend 
                                    ? "You&apos;re a weekday cinema lover! 📚" 
                                    : "Weekend movie marathons are your thing! 🍿"}
                            </p>
                        </div>
                    </div>
                </div>
            </Section>
        )}

        {/* Fun Statistics */}
        {stats.fun_statistics && (
            <Section>
                <SectionTitle icon={<Sparkles size={28} className="text-cyan-400" />} title="Fun Statistics ✨" subtitle="Surprising film facts" />
                    <div className="space-y-4">
                        {stats.fun_statistics.highest_budget_film && (
                            <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-4">
                                <h4 className="text-sm text-gray-400 mb-1">💰 Highest Budget Film</h4>
                                <p className="font-bold text-white">{stats.fun_statistics.highest_budget_film.title}</p>
                                <p className="text-green-400 text-sm">${(stats.fun_statistics.highest_budget_film.budget / 1000000).toFixed(1)}M</p>
                            </div>
                        )}

                        {stats.fun_statistics.guilty_pleasure && (
                            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-4">
                                <h4 className="text-sm text-gray-400 mb-1">😅 Your Guilty Pleasure</h4>
                                <p className="font-bold text-white">{stats.fun_statistics.guilty_pleasure.title}</p>
                                <p className="text-pink-400 text-sm">
                                    TMDb: {stats.fun_statistics.guilty_pleasure.tmdb_rating}★ / You: {stats.fun_statistics.guilty_pleasure.your_rating}★
                                </p>
                            </div>
                        )}

                        {stats.fun_statistics.favorite_genre_combo && (
                            <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-xl p-4">
                                <h4 className="text-sm text-gray-400 mb-1">🎭 Favorite Genre Combo</h4>
                                <p className="font-bold text-white">{stats.fun_statistics.favorite_genre_combo.combination}</p>
                                <p className="text-orange-400 text-sm">{stats.fun_statistics.favorite_genre_combo.count} films</p>
                            </div>
                        )}

                        {stats.fun_statistics.film_age_analysis && (
                            <div className="bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-xl p-4">
                                <h4 className="text-sm text-gray-400 mb-1">📅 Your Time Journey</h4>
                                <p className="font-bold text-white">You&apos;re a {stats.fun_statistics.film_age_analysis.type}!</p>
                                <p className="text-blue-400 text-sm">
                                    Average film age: {stats.fun_statistics.film_age_analysis.average_age} years
                                </p>
                            </div>
                        )}
                    </div>
                </Section>
            )}

        {/* Cinematic World Tour */}
        {stats.fun_statistics?.world_tour && stats.fun_statistics.world_tour.length > 0 && (
            <Section>
                <SectionTitle icon={<Globe size={28} className="text-emerald-400" />} title="Cinematic World Tour 🌍" subtitle="Countries explored through film" />
                <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-white mb-2">You traveled to {stats.fun_statistics.world_tour.length} countries through cinema this year!</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {stats.fun_statistics.world_tour.map((country) => (
                        <motion.div 
                            variants={itemVariants} 
                            key={country.country}
                            className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl p-6 text-center"
                        >
                            <div className="text-4xl mb-2">{country.flag}</div>
                            <h4 className="font-bold text-white text-sm mb-1">{country.country}</h4>
                            <p className="text-emerald-400 font-semibold">{country.count} films</p>
                        </motion.div>
                    ))}
                </div>
            </Section>
        )}

        {/* Footer */}
        <footer className="text-center py-12">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">Share Your Wrapped</h3>
            <div className="flex justify-center gap-4 mb-4">
                <button onClick={() => setShareLayout('horizontal')} className={`px-4 py-2 rounded-lg ${shareLayout === 'horizontal' ? 'bg-orange-500' : 'bg-slate-700'}`}>16:9</button>
                <button onClick={() => setShareLayout('vertical')} className={`px-4 py-2 rounded-lg ${shareLayout === 'vertical' ? 'bg-orange-500' : 'bg-slate-700'}`}>Vertical</button>
                <button onClick={() => setShareLayout('square')} className={`px-4 py-2 rounded-lg ${shareLayout === 'square' ? 'bg-orange-500' : 'bg-slate-700'}`}>Square</button>
            </div>
             <div className="flex justify-center gap-4 mt-4">
                <button
                  onClick={handleShare}
                  disabled={isDownloading}
                  className="bg-gradient-to-br from-purple-500 to-pink-500 p-4 rounded-full hover:scale-110 transition-transform text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Share your results"
                >
                  <Share2 />
                  <span>{isDownloading ? 'Downloading...' : 'Share'}</span>
                </button>
            </div>
        </footer>
      </main>
    </div>
  );
};

export default ComprehensiveResultsPage;