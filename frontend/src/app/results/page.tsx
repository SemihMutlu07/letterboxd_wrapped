'use client';

import { useEffect, useState } from 'react';
import { motion, Variants } from 'framer-motion';
import {
  Film, Star, Clock, TrendingUp, Calendar, Award, Globe, Languages, User, Heart, Clapperboard
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import React from 'react';
import Link from 'next/link';

// --- Design System Constants ---
const typography = {
  hero: "text-6xl md:text-8xl font-black",
  sectionTitle: "text-3xl md:text-4xl font-bold",
  cardTitle: "text-xl md:text-2xl font-semibold",
  bigNumber: "text-4xl md:text-6xl font-black",
  body: "text-base md:text-lg",
  caption: "text-sm md:text-base opacity-80"
};

const colors = {
  primary: "text-orange-500",
  rating: "text-yellow-500",
  genre: "text-purple-500",
  country: "text-emerald-500",
  director: "text-cyan-500",
  actor: "text-pink-500",
  time: "text-blue-500"
};

const chartColors = {
  primary: "#f97316", // orange-500
  secondary: "#a855f7", // purple-500
  tertiary: "#3b82f6", // blue-500
  quaternary: "#10b981", // emerald-500
  rating: "#eab308", // yellow-500
  country: "#059669", // emerald-600
  accent: "#ec4899", // pink-500
  success: "#22c55e", // green-500
};

// --- Interfaces ---
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
  data_timeline?: {
    earliest_date?: string;
    latest_date?: string;
    total_days?: number;
    period_description?: string;
  };
}

// --- Utility Functions ---
const formatNumber = (num: number): string => {
  if (num >= 1000) return `${(num/1000).toFixed(1)}k`;
  return num.toString();
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getPercentage = (part: number, total: number): string => {
  return `${Math.round((part / total) * 100)}%`;
};

// --- Animation Variants ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } }
};

// --- Components ---
interface SectionProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  variant?: 'default' | 'highlight' | 'subtle';
  className?: string;
}

const Section: React.FC<SectionProps> = ({ 
  title, 
  subtitle, 
  icon, 
  children, 
  variant = 'default',
  className = ''
}) => {
  const variants = {
    default: "bg-slate-800/30 backdrop-blur-sm border border-slate-700/50",
    highlight: "bg-gradient-to-r from-orange-500/10 to-pink-500/10 border border-orange-500/30",
    subtle: "bg-slate-900/50"
  };
  
  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={containerVariants}
      className={`${variants[variant]} rounded-3xl p-6 md:p-8 ${className}`}
    >
      {title && (
        <div className="flex items-center gap-4 mb-6">
          {icon && <div className="text-3xl">{icon}</div>}
          <div>
            <h2 className={typography.sectionTitle}>{title}</h2>
            {subtitle && <p className={`${typography.caption} mt-1`}>{subtitle}</p>}
          </div>
        </div>
      )}
      {children}
    </motion.section>
  );
};

interface DirectorCardProps {
  director: CountItem;
  rank: number;
}

const DirectorCard: React.FC<DirectorCardProps> = ({ director, rank }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  
  useEffect(() => {
    const fetchDirectorImage = async () => {
      // Skip API call if no director name
      if (!director?.name) return;
      
      setImageLoading(true);
      try {
        const response = await fetch(`/api/tmdb/person/search?name=${encodeURIComponent(director.name)}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.profile_path) {
            setImageUrl(`https://image.tmdb.org/t/p/w200${data.profile_path}`);
          }
        }
      } catch (error) {
        console.log('TMDB API not available, using fallback icon');
      } finally {
        setImageLoading(false);
      }
    };
    
    // Add a small delay to avoid overwhelming the API
    const timeout = setTimeout(fetchDirectorImage, rank * 100);
    return () => clearTimeout(timeout);
  }, [director.name, rank]);
  
  const getRankColor = (rank: number) => {
    if (rank === 1) return "text-yellow-500 bg-yellow-500/10";
    if (rank === 2) return "text-gray-300 bg-gray-300/10";
    if (rank === 3) return "text-orange-500 bg-orange-500/10";
    return "text-slate-400 bg-slate-400/10";
  };
  
  if (!director) {
    return null;
  }
  
  return (
    <motion.div 
      variants={itemVariants}
      className="flex items-center gap-3 md:gap-4 p-4 md:p-5 bg-slate-800/60 border border-slate-700/60 rounded-xl hover:bg-slate-800/80 hover:border-slate-600/60 transition-all duration-200 shadow-lg"
    >
      <div className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full font-bold text-lg md:text-xl ${getRankColor(rank)}`}>
        #{rank}
      </div>
      <div className="w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden bg-slate-700 border-2 border-slate-600/50 flex-shrink-0">
        {imageLoading ? (
          <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-700 animate-pulse" />
        ) : imageUrl ? (
          <img 
            src={imageUrl} 
            alt={director.name} 
            className="w-full h-full object-cover"
            onError={() => setImageUrl(null)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-700">
            <User size={20} className="md:size-6" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-base md:text-lg font-semibold text-white truncate mb-1">{director.name}</div>
        <div className="text-sm md:text-base text-cyan-400 font-medium">{director.count} films</div>
      </div>
    </motion.div>
  );
};

const StatCard: React.FC<{
  value: string | number;
  label: string;
  color?: string;
  size?: 'normal' | 'large';
}> = ({ value, label, color = 'text-white', size = 'normal' }) => (
  <motion.div
    variants={itemVariants}
    className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-4 md:p-6 hover:scale-[1.02] hover:bg-slate-800/80 hover:border-slate-600/60 transition-all duration-200 shadow-lg"
  >
    <div className={`${size === 'large' ? 'text-3xl md:text-7xl' : 'text-2xl md:text-5xl'} font-black ${color} mb-1 md:mb-2 leading-tight`}>
      {value}
    </div>
    <div className="text-xs md:text-sm uppercase tracking-wider opacity-80 font-medium">{label}</div>
  </motion.div>
);

// Language mapping
const languageMap: { [key: string]: string } = {
    en: 'English', fr: 'French', ja: 'Japanese', es: 'Spanish', ko: 'Korean',
    de: 'German', it: 'Italian', ru: 'Russian', pt: 'Portuguese', zh: 'Chinese',
    hi: 'Hindi', sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish'
};

// Chart tooltips
const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: { payload: LanguageItem }[];
}> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const languageName = languageMap[data.language] || data.language.toUpperCase();
    return (
      <div className="bg-slate-800/90 backdrop-blur-sm p-3 rounded-lg border border-white/20 text-white shadow-lg">
        <p className="font-bold">{`${languageName}: ${data.count} films`}</p>
      </div>
    );
  }
  return null;
};

const DecadeTooltip: React.FC<{
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800/90 backdrop-blur-sm p-3 rounded-lg border border-orange-500/30 text-white shadow-lg">
        <p className="font-bold text-lg mb-1">{label}</p>
        <p className="text-orange-400 font-semibold">{`${payload[0].value} films`}</p>
      </div>
    );
  }
  return null;
};

// --- Main Component ---
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
    return <div className="min-h-screen bg-slate-900" />;
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No data found</h2>
          <p className="text-gray-400">Please upload your Letterboxd data first.</p>
          <Link href="/" className="mt-6 inline-block px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold transition-colors">
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  // Data transformations
  const decadeData = stats.decades ? 
    [...stats.decades]
      .filter(item => item.decade && item.decade !== 'Unknown')
      .sort((a, b) => {
        const yearA = parseInt(a.decade.replace('s', ''));
        const yearB = parseInt(b.decade.replace('s', ''));
        return yearA - yearB;
      })
      .map(item => ({
        ...item,
        decade: item.decade.includes('s') ? item.decade : `${item.decade}s`
      })) : [];
  
  const languageData = stats.top_languages ? stats.top_languages.slice(0, 7) : [];
  const totalLanguageCount = languageData.reduce((acc, lang) => acc + lang.count, 0);
  const COLORS = [chartColors.primary, chartColors.secondary, chartColors.tertiary, chartColors.quaternary, chartColors.rating, chartColors.country, chartColors.accent, chartColors.success];
  
  return (
    <div className="font-sans bg-slate-900 text-white overflow-x-hidden relative min-h-screen">
      {/* Subtle background gradients */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full filter blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full filter blur-[120px]" />
        </div>

      <main className="relative z-10 px-3 md:px-8 py-4 md:py-8 max-w-7xl mx-auto space-y-4 md:space-y-8">
        {/* Header */}
        <header className="text-center py-8 md:py-16">
          <motion.h1 
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className={`${typography.hero} text-white mb-4 leading-tight tracking-tighter`}
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
            className="text-xl text-gray-300 mb-2"
          >
            A comprehensive analysis of your cinematic journey.
          </motion.p>
          {stats.data_timeline && stats.data_timeline.earliest_date && stats.data_timeline.latest_date && (
            <motion.p 
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              transition={{delay: 0.4}}
              className="text-center text-gray-400 text-lg"
            >
              Analysed from {new Date(stats.data_timeline.earliest_date).toLocaleDateString()} to {new Date(stats.data_timeline.latest_date).toLocaleDateString()}
            </motion.p>
          )}
        </header>

                {/* Hero Section - Key Stats */}
        <section className="min-h-[50vh] md:min-h-[60vh] flex items-center justify-center py-6 md:py-8">
          <div className="text-center space-y-6 md:space-y-8 max-w-6xl mx-auto w-full">
        {/* Main Stats Grid */}
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
              className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6"
            >
              <StatCard
                value={stats.total_films}
                label="Films"
                size="large"
                color="text-white"
              />
              <StatCard
                value={`${stats.average_rating.toFixed(1)}★`}
                label="Avg Rating"
                color={colors.rating}
                size="large"
              />
              <StatCard
                value={Math.round(stats.days_watched)}
                label="Days"
                color={colors.time}
                size="large"
              />
              <StatCard
                value={stats.favorite_genre.name}
                label="Top Genre"
                color={colors.genre}
              />
        </motion.div>

            {/* Cinema Identity */}
            {stats.cinematic_persona && (
        <motion.div
                variants={itemVariants}
                className="bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/40 rounded-3xl p-6 md:p-8"
              >
                <div className="text-base md:text-lg text-orange-200 mb-2">Your Cinema Identity</div>
                <div className="text-3xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-400">
                  {stats.cinematic_persona.persona}
            </div>
          </motion.div>
            )}
              </div>
        </section>

                {/* Key Insights */}
        <Section title="Your Year in Numbers" icon="📊" variant="highlight">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <motion.div variants={itemVariants} className="text-center bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 md:p-6">
              <div className="text-4xl md:text-5xl font-black text-orange-500 mb-2">
                {getPercentage(stats.days_watched, 365)}
              </div>
              <div className="text-sm md:text-base text-orange-200 font-medium">of your year watching films</div>
          </motion.div>
            <motion.div variants={itemVariants} className="text-center bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 md:p-6">
              <div className="text-2xl md:text-3xl font-bold text-cyan-500 mb-2 truncate">
                {stats.most_watched_director.name}
              </div>
              <div className="text-sm md:text-base text-cyan-200 font-medium">{stats.most_watched_director.count} films • Your director</div>
          </motion.div>
            <motion.div variants={itemVariants} className="text-center bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 md:p-6">
              <div className="text-4xl md:text-5xl font-black text-purple-500 mb-2">
                {stats.favorite_decade.name}
              </div>
              <div className="text-sm md:text-base text-purple-200 font-medium">{stats.favorite_decade.count} films • Your peak decade</div>
                    </motion.div>
                </div>
            </Section>

                        {/* Directors Section */}
        <Section title="Your Directors" subtitle={`${stats.total_directors} directors explored`} icon="🎬">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3 md:space-y-4"
          >
            {stats.top_directors && stats.top_directors.length > 0 ? (
              stats.top_directors.slice(0, 3).map((director, i) => (
                <DirectorCard key={director.name} director={director} rank={i + 1} />
              ))
            ) : (
              <motion.div variants={itemVariants} className="text-center py-8 text-gray-400">
                <User size={48} className="mx-auto mb-4 opacity-50" />
                <p>No director data available</p>
              </motion.div>
            )}
          </motion.div>
        </Section>

        {/* Top Genres */}
        <Section title="Genre Preferences" subtitle="Your most-watched categories" icon="🎭">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
            {stats.top_genres.slice(0, 5).map((genre, i) => {
              const genreColors = [
                'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400',
                'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400',
                'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30 text-emerald-400',
                'from-pink-500/20 to-pink-600/20 border-pink-500/30 text-pink-400',
                'from-amber-500/20 to-amber-600/20 border-amber-500/30 text-amber-400'
              ];
              
              return (
                            <motion.div 
                                variants={itemVariants}
                  key={genre.name}
                  className={`bg-gradient-to-br ${genreColors[i]} border rounded-xl p-3 md:p-4 text-center hover:scale-[1.02] transition-all duration-200`}
                >
                  <div className="text-lg md:text-xl font-bold mb-1">{genre.name}</div>
                  <div className="text-xs md:text-sm opacity-80 font-medium">{genre.count} films</div>
                            </motion.div>
              );
            })}
                        </div>
                    </Section>

                {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
          {/* Languages */}
          <Section title="Languages" subtitle="Your linguistic journey">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-start">
              <motion.div variants={itemVariants} className="w-full h-48 md:h-64">
                      <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={languageData} 
                      dataKey="count" 
                      nameKey="language" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={40} 
                      outerRadius={80} 
                      paddingAngle={3}
                      cornerRadius={8}
                    >
                      {languageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                              </Pie>
                    <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                      </ResponsiveContainer>
                  </motion.div>
              <motion.div variants={containerVariants} className="space-y-2 md:space-y-3">
                      {languageData.map((entry, index) => (
                  <motion.div variants={itemVariants} key={entry.language} className="flex items-center justify-between p-2 bg-slate-800/30 rounded-lg">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-3 flex-shrink-0" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                      />
                      <span className="font-medium text-sm md:text-base truncate">{languageMap[entry.language] || entry.language.toUpperCase()}</span>
                    </div>
                    <span className="font-bold text-sm md:text-base flex-shrink-0">{getPercentage(entry.count, totalLanguageCount)}</span>
                          </motion.div>
                      ))}
                  </motion.div>
              </div>
          </Section>

          {/* Countries */}
          <Section title="Countries" subtitle={`Films from ${stats.total_countries} countries`}>
            <div className="space-y-2 md:space-y-3">
              {stats.top_countries.slice(0, 8).map((country, index) => {
                const countryColors = [
                  'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
                  'text-blue-500 bg-blue-500/10 border-blue-500/20',
                  'text-purple-500 bg-purple-500/10 border-purple-500/20',
                  'text-pink-500 bg-pink-500/10 border-pink-500/20',
                  'text-orange-500 bg-orange-500/10 border-orange-500/20',
                  'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
                  'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
                  'text-green-500 bg-green-500/10 border-green-500/20'
                ];
                
                return (
                  <motion.div 
                    variants={itemVariants} 
                    key={country.name} 
                    className={`flex justify-between items-center p-3 rounded-lg border ${countryColors[index]} hover:scale-[1.01] transition-all duration-200`}
                  >
                      <div className="flex items-center">
                      <span className="text-xs md:text-sm font-bold w-6 md:w-8 opacity-70">#{index + 1}</span>
                      <span className="font-semibold text-sm md:text-base truncate">{country.name}</span>
                      </div>
                    <span className="font-bold text-sm md:text-base py-1 px-2 md:px-3 rounded-lg bg-white/10 flex-shrink-0">{country.count}</span>
                  </motion.div>
                );
              })}
              </div>
          </Section>
        </div>

        {/* Film Timeline */}
        <Section title="Film History" subtitle="Your journey through cinema decades">
          <motion.div variants={itemVariants} className="w-full h-64 md:h-80">
            <ResponsiveContainer>
              <LineChart 
                data={decadeData} 
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <defs>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="decade" 
                  stroke="#64748b" 
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tickLine={{ stroke: '#475569' }}
                />
                <YAxis 
                  stroke="#64748b" 
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={{ stroke: '#475569' }}
                  axisLine={{ stroke: '#475569' }}
                />
                <Tooltip
                  cursor={{ 
                    stroke: chartColors.primary, 
                    strokeWidth: 2,
                    strokeDasharray: "5 5",
                    strokeOpacity: 0.7
                  }}
                  content={<DecadeTooltip />}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke={chartColors.primary} 
                  strokeWidth={3}
                  dot={{ 
                    fill: chartColors.primary, 
                    strokeWidth: 2, 
                    stroke: '#0f172a', 
                    r: 5 
                  }}
                  activeDot={{ 
                    r: 8, 
                    stroke: chartColors.primary,
                    strokeWidth: 2,
                    fill: '#0f172a',
                    filter: 'drop-shadow(0 0 6px rgba(249, 115, 22, 0.8))'
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </Section>
        
        {/* Rating Distribution */}
        <Section title="Rating Patterns" subtitle="How you rate films">
          <motion.div variants={itemVariants} className="w-full h-64 md:h-80">
                <ResponsiveContainer>
              <BarChart data={Object.entries(stats.rating_distribution).map(([rating, count]) => ({ 
                rating: `${rating}★`, 
                count 
              }))}>
                        <XAxis dataKey="rating" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                        <Tooltip
                  contentStyle={{ 
                    backgroundColor: 'rgba(31, 41, 55, 0.9)', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    borderRadius: '0.5rem' 
                  }}
                />
                <Bar dataKey="count" fill={chartColors.rating} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </motion.div>
        </Section>

                {/* Additional Stats */}
        <Section title="Quick Facts" subtitle="Notable highlights from your viewing">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <motion.div variants={itemVariants} className="text-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 md:p-6">
              <div className="text-3xl md:text-4xl font-black text-emerald-500 mb-2">{stats.average_runtime.toFixed(0)}</div>
              <div className="text-xs md:text-sm text-emerald-200 font-medium uppercase tracking-wider">minutes average</div>
                </motion.div>
            <motion.div variants={itemVariants} className="text-center bg-pink-500/10 border border-pink-500/20 rounded-xl p-4 md:p-6">
              <div className="text-lg md:text-xl font-bold text-pink-500 mb-2 truncate">{stats.longest_film.title}</div>
              <div className="text-xs md:text-sm text-pink-200 font-medium">Longest film • {stats.longest_film.runtime} min</div>
                    </motion.div>
            <motion.div variants={itemVariants} className="text-center bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 md:p-6">
              <div className="text-3xl md:text-4xl font-black text-yellow-500 mb-2">{stats.most_common_rating}★</div>
              <div className="text-xs md:text-sm text-yellow-200 font-medium uppercase tracking-wider">most common rating</div>
                        </motion.div>
                </div>
            </Section>

        {/* Footer */}
        <footer className="text-center py-12">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">Your Letterboxd Wrapped</h3>
            <p className="text-gray-400">Thank you for exploring your cinematic journey with us!</p>
        </footer>
      </main>
    </div>
  );
};

export default ComprehensiveResultsPage;