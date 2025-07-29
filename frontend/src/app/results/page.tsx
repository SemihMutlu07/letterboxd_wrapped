'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, Variants } from 'framer-motion';
import {
  Film, Star, Clock, TrendingUp, Calendar, Award, Globe, Languages, Sparkles, Instagram, Twitter
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import React from 'react';
import Link from 'next/link';

// --- Interfaces for Stats Data ---
interface CountItem { name: string; count: number; }
interface ActorItem extends CountItem { profile_path?: string; }
interface DecadeItem { decade: string; count: number; }
interface LanguageItem { language: string; count: number; }
interface InsightItem { title: string; description: string; }

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
  top_languages: LanguageItem[];
  analysis_date: string;
  has_ratings_data: boolean;
  has_diary_data: boolean;
  has_watchlist_data: boolean;
  has_reviews_data: boolean;
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
    className={`p-6 rounded-3xl text-white shadow-2xl ${gradient} transition-transform hover:scale-105`}
  >
    <div className="flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
      {icon}
    </div>
    <div className="text-5xl font-black mb-1">{value} <span className="text-3xl opacity-80">{unit}</span></div>
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
      <h3 className="text-4xl font-bold text-white tracking-tight">{title}</h3>
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
const CustomTooltip = ({ active, payload }: any) => {
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

// --- Main Page Component ---
const ComprehensiveResultsPage = () => {
  const [stats, setStats] = useState<LetterboxdStats | null>(null);
  const [loading, setLoading] = useState(true);

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

  const groupedDirectors = useMemo(() => {
    if (!stats?.top_directors) return [];
    const groups: Record<number, string[]> = {};
    stats.top_directors.forEach(director => {
        if (!groups[director.count]) {
            groups[director.count] = [];
        }
        groups[director.count].push(director.name);
    });
    return Object.entries(groups)
        .map(([count, names]) => ({ count: parseInt(count), names }))
        .sort((a, b) => b.count - a.count);
  }, [stats?.top_directors]);

  const generateShareUrl = (type: 'instagram' | 'twitter') => {
    if (!stats) return '';
    const baseUrl = `/api/og/${type === 'instagram' ? 'instagram-story' : 'twitter'}`;
    const params = new URLSearchParams({
        totalFilms: stats.total_films.toString(),
        averageRating: stats.average_rating.toFixed(2),
        daysWatched: stats.days_watched.toFixed(1),
        topGenre: stats.favorite_genre.name,
        topDirector: stats.most_watched_director.name,
    });
    return `${baseUrl}?${params.toString()}`;
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
  const decadeData = [...stats.decades].sort((a, b) => parseInt(a.decade) - parseInt(b.decade));
  const languageData = stats.top_languages.slice(0, 7);
  const totalLanguageCount = languageData.reduce((acc, lang) => acc + lang.count, 0);
  const COLORS = ['#FF6B6B', '#4D96FF', '#6BCB77', '#FFD93D', '#9D6A74', '#FF8C42', '#A06CD5'];
  
  const genreGradients = [
      'from-pink-500 to-orange-500',
      'from-cyan-500 to-blue-500',
      'from-violet-500 to-purple-500',
      'from-amber-500 to-red-500',
      'from-lime-500 to-green-500',
  ];
  
  return (
    <div className={`font-sans bg-slate-900 text-white`}>
        <div className="absolute inset-0 z-0 opacity-40">
             <div className="absolute top-[-10rem] left-[-10rem] w-[40rem] h-[40rem] bg-purple-600/50 rounded-full filter blur-[150px] animate-blob"></div>
             <div className="absolute top-[-5rem] right-[-10rem] w-[40rem] h-[40rem] bg-orange-600/50 rounded-full filter blur-[150px] animate-blob animation-delay-2000"></div>
             <div className="absolute bottom-[-10rem] left-[15rem] w-[40rem] h-[40rem] bg-blue-600/50 rounded-full filter blur-[150px] animate-blob animation-delay-4000"></div>
        </div>
      <main className="relative z-10 p-4 md:p-8 max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <header className="text-center py-16">
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
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          <StatCard icon={<Film size={32} />} title="Total Films" value={stats.total_films} unit="films" gradient="from-pink-500 to-orange-500" />
          <StatCard icon={<Star size={32} />} title="Average Rating" value={stats.average_rating.toFixed(2)} unit="★" gradient="from-blue-500 to-purple-500" />
          <StatCard icon={<Clock size={32} />} title="Days Watched" value={stats.days_watched.toFixed(1)} unit="days" gradient="from-green-500 to-teal-500" />
          <StatCard icon={<TrendingUp size={32} />} title="Top Genre" value={stats.favorite_genre.name} unit="" gradient="from-yellow-500 to-red-500" />
        </motion.div>

        {/* Special Insights */}
        {stats.insights && (
            <Section>
                <SectionTitle icon={<Sparkles size={28} className="text-yellow-300"/>} title="Special Insights" subtitle="Fun facts from your viewing habits" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {stats.insights.slice(0, 3).map((insight) => (
                    <motion.div variants={itemVariants} key={insight.title} className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-2xl p-6">
                        <h4 className="font-bold text-xl text-orange-300 mb-2">{insight.title}</h4>
                        <p className="text-base text-gray-300">{insight.description}</p>
                    </motion.div>
                    ))}
                </div>
            </Section>
        )}

        {/* Directors & Runtime */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                {/* Favorite Directors */}
                <Section>
                    <SectionTitle icon={<Award size={28} className="text-orange-300" />} title="Favorite Directors" subtitle={`${stats.total_directors} directors watched`} />
                    <div className="space-y-4 h-96 overflow-y-auto pr-4 custom-scrollbar">
                        {groupedDirectors.slice(0, 15).map(({ count, names }) => (
                            <motion.div variants={itemVariants} key={count} className="flex items-center justify-between py-3 border-b border-white/10">
                                <p className="font-semibold text-lg text-white w-3/4">
                                    {names.join(', ')}
                                </p>
                                <div className="flex items-baseline gap-2 text-right w-1/4">
                                    <span className="font-bold text-3xl text-orange-400">{count}</span>
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
                    <SectionTitle icon={<Clock size={24} className="text-teal-400" />} title="Average Runtime" subtitle="How long you like your movies" />
                    <div className="text-center my-8">
                        <div className="text-8xl font-black text-white">{stats.average_runtime.toFixed(0)}</div>
                        <p className="text-gray-300 text-lg">minutes</p>
                    </div>
                </Section>
            </div>
        </div>

        {/* Languages & Top Countries */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <Section className="lg:col-span-3">
              <SectionTitle icon={<Languages size={28} className="text-blue-300" />} title="Languages" subtitle="Your cinematic linguistic profile" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <motion.div variants={chartVariants} className="w-full h-80">
                      <ResponsiveContainer>
                          <PieChart>
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
          <Section className="lg:col-span-2">
              <SectionTitle icon={<Globe size={28} className="text-green-300" />} title="Top Countries" subtitle={`Films from ${stats.total_countries} countries`} />
              <div className="space-y-3 h-96 overflow-y-auto pr-4 custom-scrollbar">
                  {stats.top_countries.slice(0, 15).map((country, index) => (
                  <motion.div variants={itemVariants} key={country.name} className="flex justify-between items-center py-2">
                      <div className="flex items-center">
                          <span className="text-md font-bold w-10 text-gray-400">#{index + 1}</span>
                          <span className="font-semibold text-lg">{country.name}</span>
                      </div>
                      <span className="font-bold text-xl text-gray-300 bg-white/5 py-1 px-3 rounded-lg">{country.count}</span>
                  </motion.div>
                  ))}
              </div>
          </Section>
        </div>

        {/* Top Genres */}
        <Section>
            <SectionTitle icon={<TrendingUp size={28} className="text-yellow-300" />} title="Top Genres" subtitle="Your most-watched movie genres" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {stats.top_genres.slice(0, 5).map((genre, i) => (
                <motion.div 
                    variants={itemVariants} 
                    key={genre.name} 
                    className={`relative rounded-2xl p-6 text-center transition-transform duration-300 hover:scale-105 group overflow-hidden`}
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
            <motion.div variants={chartVariants} className="w-full h-80 mt-4">
                <ResponsiveContainer>
                    <LineChart data={decadeData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <XAxis dataKey="decade" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                        <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }}/>
                        <Tooltip 
                            contentStyle={{ 
                                background: 'rgba(15, 23, 42, 0.8)',
                                backdropFilter: 'blur(4px)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '1rem',
                                color: '#fff'
                            }} 
                        />
                        <Line type="monotone" dataKey="count" stroke="#fb923c" strokeWidth={3} dot={{ r: 5, fill: '#fb923c' }} activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            </motion.div>
        </Section>
        
        {/* Footer */}
        <footer className="text-center py-12">
            <h3 className="text-3xl font-bold mb-4">Share Your Wrapped</h3>
             <div className="flex justify-center gap-4 mt-4">
                {/* 
                <a href={generateShareUrl('instagram')} target="_blank" rel="noopener noreferrer"
                  className="bg-gradient-to-br from-purple-500 to-pink-500 p-4 rounded-full hover:scale-110 transition-transform"
                  aria-label="Share on Instagram"
                >
                  <Instagram />
                </a>
                <a href={generateShareUrl('twitter')} target="_blank" rel="noopener noreferrer"
                  className="bg-sky-500 p-4 rounded-full hover:scale-110 transition-transform"
                  aria-label="Share on Twitter"
                >
                  <Twitter />
                </a>
                */}
            </div>
        </footer>
      </main>
    </div>
  );
};

export default ComprehensiveResultsPage;