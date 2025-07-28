'use client';

import { useEffect, useState } from 'react';
import { motion, Variants } from 'framer-motion';
import {
  Film, Star, Clock, TrendingUp, Calendar, Award, Users, Languages, Sparkles, Download, Instagram, Twitter
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
    className={`p-6 rounded-3xl text-white shadow-2xl ${gradient}`}
  >
    <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-xl mb-4">
      {icon}
    </div>
    <div className="text-4xl font-black mb-1">{value} <span className="text-2xl opacity-80">{unit}</span></div>
    <p className="text-base opacity-90 font-medium">{title}</p>
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
    className={`bg-white/5 backdrop-blur-2xl rounded-3xl p-6 md:p-8 border border-white/10 shadow-2xl ${className}`}
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
  <div className="flex items-center mb-6">
    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mr-4">
      {icon}
    </div>
    <div>
      <h3 className="text-3xl font-bold text-white">{title}</h3>
      <p className="text-base text-gray-400">{subtitle}</p>
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
  visible: { y: 0, opacity: 1 }
};
const chartVariants: Variants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
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

  if (loading) {
    return <div className="min-h-screen bg-gray-900" />;
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
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
  const languageData = stats.top_languages.slice(0, 6);
  const totalLanguageCount = languageData.reduce((acc, lang) => acc + lang.count, 0);
  const COLORS = ['#FF8042', '#0088FE', '#00C49F', '#FFBB28', '#AF19FF', '#FF1943'];
  const languageMap: { [key: string]: string } = {
    en: 'English', fr: 'French', ja: 'Japanese', es: 'Spanish', ko: 'Korean',
    de: 'German', it: 'Italian', ru: 'Russian', pt: 'Portuguese', zh: 'Chinese',
    hi: 'Hindi', sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish'
  };
  
  return (
    <div className={`font-sans bg-gray-900 text-white`}>
        <div className="absolute inset-0 z-0 opacity-20">
             <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600 rounded-full filter blur-3xl animate-blob"></div>
             <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600 rounded-full filter blur-3xl animate-blob animation-delay-2000"></div>
             <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>
      <main className="relative z-10 p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="text-center py-12">
          <motion.h1 
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="text-6xl md:text-8xl font-black text-white mb-4 leading-tight"
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
            className="text-xl text-gray-400"
          >
            A comprehensive analysis of your cinematic journey.
          </motion.p>
        </header>

        {/* Main Stats Grid */}
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <StatCard icon={<Film size={28} />} title="Total Films" value={stats.total_films} unit="films" gradient="from-pink-500 to-orange-500" />
          <StatCard icon={<Star size={28} />} title="Average Rating" value={stats.average_rating.toFixed(2)} unit="★" gradient="from-blue-500 to-purple-500" />
          <StatCard icon={<Clock size={28} />} title="Days Watched" value={stats.days_watched.toFixed(1)} unit="days" gradient="from-green-500 to-teal-500" />
          <StatCard icon={<TrendingUp size={28} />} title="Top Genre" value={stats.favorite_genre.name} unit="" gradient="from-yellow-500 to-red-500" />
        </motion.div>

        {/* Special Insights */}
        {stats.insights && (
            <Section>
                <SectionTitle icon={<Sparkles size={24} className="text-yellow-400"/>} title="Special Insights" subtitle="Fun facts based on your viewing habits" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.insights.slice(0, 3).map((insight) => (
                    <motion.div variants={itemVariants} key={insight.title} className="bg-white/5 rounded-xl p-4">
                        <h4 className="font-bold text-orange-400">{insight.title}</h4>
                        <p className="text-sm text-gray-300">{insight.description}</p>
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
                    <SectionTitle icon={<Award size={24} className="text-orange-400" />} title="Favorite Directors" subtitle={`${stats.total_directors} directors watched`} />
                    <div className="relative h-80 overflow-y-auto pr-4 custom-scrollbar">
                        {stats.top_directors.slice(0,15).map((director, index) => (
                        <motion.div variants={itemVariants} key={director.name} className="flex justify-between items-center py-3 border-b border-white/5">
                            <div className="flex items-center">
                                <span className="text-md font-bold w-10 text-gray-400">#{index + 1}</span>
                                <span className="font-semibold text-xl">{director.name}</span>
                            </div>
                            <span className="font-bold text-2xl text-gray-300">{director.count}</span>
                        </motion.div>
                        ))}
                         <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-white/5 to-transparent pointer-events-none"></div>
                    </div>
                </Section>
            </div>
            <div className="space-y-8">
                {/* Runtime Record */}
                <Section>
                    <SectionTitle icon={<Clock size={24} className="text-teal-400" />} title="Average Runtime" subtitle="How long you like your movies" />
                    <div className="text-center">
                        <div className="text-8xl font-black text-white">{stats.average_runtime.toFixed(0)}</div>
                        <p className="text-gray-300 text-lg">minutes</p>
                    </div>
                </Section>
            </div>
        </div>

        {/* Languages & Top Countries */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Section>
                <SectionTitle icon={<Languages size={24} className="text-blue-400" />} title="Languages" subtitle="Your cinematic linguistic profile" />
                <div className="flex flex-col items-center w-full">
                    <motion.div variants={chartVariants} className="w-full h-72">
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie data={languageData} dataKey="count" nameKey="language" cx="50%" cy="50%" innerRadius={60} outerRadius={100} fill="#8884d8" paddingAngle={5}>
                                    {languageData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip
                                    cursor={{fill: 'rgba(255,255,255,0.1)'}}
                                    contentStyle={{
                                        background: 'rgba(30, 41, 59, 0.9)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '1rem',
                                        color: '#fff'
                                    }}
                                    formatter={(value: number, name: string) => [`${value} films`, languageMap[name] || name.toUpperCase()]}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </motion.div>
                    <motion.div variants={containerVariants} className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4">
                        {languageData.map((entry, index) => (
                            <motion.div variants={itemVariants} key={entry.language} className="flex items-center text-sm">
                                <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                <span className="font-medium text-gray-300">{languageMap[entry.language] || entry.language.toUpperCase()}</span>
                                <span className="font-bold text-white ml-2">{((entry.count / totalLanguageCount) * 100).toFixed(1)}%</span>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </Section>
            <Section>
                <SectionTitle icon={<TrendingUp size={24} className="text-green-400" />} title="Top Countries" subtitle={`Films from ${stats.total_countries} countries`} />
                <div className="relative h-80 overflow-y-auto pr-4 custom-scrollbar">
                    {stats.top_countries.map((country, index) => (
                    <motion.div variants={itemVariants} key={country.name} className="flex justify-between items-center py-3 border-b border-white/5">
                        <div className="flex items-center">
                            <span className="text-md font-bold w-10 text-gray-400">#{index + 1}</span>
                            <span className="font-semibold text-xl">{country.name}</span>
                        </div>
                        <span className="font-bold text-2xl text-gray-300">{country.count}</span>
                    </motion.div>
                    ))}
                    <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-white/5 to-transparent pointer-events-none"></div>
                </div>
            </Section>
        </div>

        {/* Top Genres */}
        <Section>
            <SectionTitle icon={<TrendingUp size={24} className="text-yellow-400" />} title="Top Genres" subtitle="Your most-watched movie genres" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {stats.top_genres.slice(0, 5).map((genre) => (
                    <motion.div variants={itemVariants} key={genre.name} className="bg-white/5 rounded-xl p-4 text-center">
                        <h4 className="font-bold text-lg text-white">{genre.name}</h4>
                        <p className="text-sm text-gray-400">{genre.count} films</p>
                    </motion.div>
                ))}
            </div>
        </Section>
        {/* Decade Chart */}
        <Section>
            <SectionTitle icon={<Calendar size={24} className="text-purple-400" />} title="Films by Decade" subtitle="Your journey through film history" />
            <motion.div variants={chartVariants} className="w-full h-80 mt-4">
                <ResponsiveContainer>
                    <LineChart data={decadeData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <XAxis dataKey="decade" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                        <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }}/>
                        <Tooltip 
                            contentStyle={{ 
                                background: 'rgba(30, 41, 59, 0.8)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '1rem' 
                            }} 
                        />
                        <Line type="monotone" dataKey="count" stroke="#fb923c" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            </motion.div>
        </Section>
        
        {/* Footer */}
        <footer className="text-center py-12">
            <h3 className="text-3xl font-bold mb-4">Share Your Wrapped</h3>
             <div className="flex justify-center gap-4 mt-4">
                <button className="bg-pink-500 p-3 rounded-full hover:scale-110 transition-transform"><Instagram /></button>
                <button className="bg-sky-500 p-3 rounded-full hover:scale-110 transition-transform"><Twitter /></button>
                <button className="bg-green-500 p-3 rounded-full hover:scale-110 transition-transform"><Download /></button>
            </div>
        </footer>
      </main>
    </div>
  );
};

export default ComprehensiveResultsPage;