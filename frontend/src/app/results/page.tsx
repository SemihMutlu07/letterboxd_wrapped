'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, Variants, useReducedMotion, LazyMotion, domAnimation } from 'framer-motion';
import { User, Heart } from 'lucide-react';
import dynamic from 'next/dynamic';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getCachedUrl, setCachedUrl } from '@/lib/tmdbCache';
import FeedbackFab from '@/components/FeedbackFab';
import { trackEvent, trackAnalyticsEvent, trackFilmStats } from '@/lib/analytics';
import PreResultsConsentModal from '@/components/PreResultsConsentModal';
import { getSessionId } from '@/lib/session';
import { hasConsentModalBeenShown, markConsentModalAsShown, saveConsentDecision as saveConsentToStorage } from '@/lib/sessionUtils';

// Dynamic imports for Recharts with SSR disabled
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
// Removed PieChart/Pie/Cell dynamic imports as the Languages chart now uses a custom SVG donut

// --- Design System Constants ---
const typography = {
  hero: "text-6xl md:text-8xl font-black",
  sectionTitle: "text-3xl md:text-[2.5rem] font-bold leading-tight",
  cardTitle: "text-xl md:text-2xl font-semibold",
  bigNumber: "text-4xl md:text-6xl font-black",
  body: "text-base md:text-lg",
  caption: "text-sm md:text-base opacity-80",
  // NEW – for small stat cards (Quick Facts & Runtime)
  statNumberSm: "text-3xl md:text-4xl font-black",
  statLabelSm: "text-xs md:text-sm uppercase tracking-wider opacity-80 font-medium"
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

// TMDB Image Cache
const imgCache = new Map<string, string | null>();

const __DEV__ = process.env.NODE_ENV !== 'production';

// Simple semaphore for TMDB fetches
let activeRequests = 0;
const MAX_CONCURRENT = 5;
const queue: Array<() => void> = [];
function acquire(): Promise<() => void> {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (activeRequests < MAX_CONCURRENT) {
        activeRequests += 1;
        resolve(() => {
          activeRequests -= 1;
          const next = queue.shift();
          if (next) next();
        });
      } else {
        queue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}

// Debug helper removed (unused)

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
  signature_combo?: { director: string; actor: string; count: number; };
  data_timeline?: {
    earliest_date?: string;
    latest_date?: string;
    total_days?: number;
    period_description?: string;
  };
}

// --- Utility Functions ---
// number/date helpers removed (unused)

function calcCinephileScore(s: LetterboxdStats | null | undefined) {
  if (!s) return 50; // Default score when no stats available
  
  const total = s.total_films || 1;
  const us = s.top_countries?.find(c=>c.name.toLowerCase().includes('united states'))?.count ?? 0;
  const nonUS = Math.max(0, 1 - us / Math.max(1, total));            // 0..1

  const pre2000 = (s.decades ?? [])
    .filter(d => /^\d{4}/.test(d.decade) && parseInt(d.decade) < 2000)
    .reduce((a,b)=>a+b.count,0) / total; // 0..1
  const langSpread = Math.min(1, ((s.top_languages?.length ?? 0) || 1) / 7); // 0..1
  const ratingBias = Math.abs((s.most_common_rating ?? 3.5) - (s.average_rating ?? 3.5)) / 2; // 0..1-ish

  // weights (tweakable but conservative)
  const raw = 0.4*nonUS + 0.35*pre2000 + 0.2*langSpread + 0.05*(1 - Math.min(1, ratingBias));
  return Math.round(raw * 100);
}

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
  const reduceLocal = useReducedMotion();
  const variants = {
    default: "bg-slate-800/30 backdrop-blur-sm border border-slate-700/50",
    highlight: "bg-gradient-to-r from-orange-500/10 to-pink-500/10 border border-orange-500/30",
    subtle: "bg-slate-900/50"
  };
  
  return (
    <motion.section
      initial={reduceLocal ? undefined : "hidden"}
      whileInView={reduceLocal ? undefined : "visible"}
      viewport={reduceLocal ? undefined : { once: true, amount: 0.2 }}
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
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const { first, last } = useMemo(() => splitName(director?.name || ''), [director?.name]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setIsVisible(true); });
    }, { rootMargin: '100px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  
  useEffect(() => {
    const ctrl = new AbortController();
    let released = false;
    let releaseFn: (() => void) | null = null;
    const fetchDirectorImage = async () => {
      if (!director?.name) return;
      if (!isVisible) return;
      
      // Check cache first
      const cacheKey = `director-${director.name}`;
      const local = getCachedUrl(director.name, 'director');
      if (local !== undefined) { if (local) setImageUrl(local); return; }
      if (imgCache.has(cacheKey)) { const cachedUrl = imgCache.get(cacheKey); if (cachedUrl) setImageUrl(cachedUrl); return; }
      
      setImageLoading(true);
      try {
        if (__DEV__) console.log(`🔍 Fetching TMDB image for director: ${director.name}`);
        releaseFn = await acquire();
        const response = await fetch(`http://localhost:8000/api/tmdb/person/search?name=${encodeURIComponent(director.name)}&role=director`, { signal: ctrl.signal });
        
        if (response.ok) {
          const data = await response.json();
          if (__DEV__) console.log(`📡 TMDB API response for director ${director.name}:`, data);
          
          if (data.found && data.url) {
            if (__DEV__) console.log(`✅ Setting director image URL: ${data.url}`);
            imgCache.set(cacheKey, data.url);
            setCachedUrl(director.name, 'director', data.url);
            setImageUrl(data.url);
          } else {
            if (__DEV__) console.log(`❌ No image found for director: ${director.name}`, data);
            imgCache.set(cacheKey, null);
            setCachedUrl(director.name, 'director', null);
          }
        } else {
          if (__DEV__) console.error(`❌ TMDB API error for director ${director.name}:`, response.status, response.statusText);
          imgCache.set(cacheKey, null);
          setCachedUrl(director.name, 'director', null);
        }
      } catch (error) {
        if (__DEV__) console.error(`💥 Error fetching director image for ${director.name}:`, error);
        imgCache.set(cacheKey, null);
        setCachedUrl(director.name, 'director', null);
      } finally {
        setImageLoading(false);
        // release semaphore
        try { if (releaseFn) releaseFn(); released = true; } catch {}
      }
    };
    
    const timeout = setTimeout(fetchDirectorImage, rank * 100);
    return () => { clearTimeout(timeout); try { ctrl.abort(); } catch {} if (!released) { try { if (releaseFn) releaseFn(); } catch {} } };
  }, [director.name, rank, isVisible]);
  
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
      ref={cardRef}
      variants={itemVariants}
      className="grid grid-cols-[56px_72px_1fr] items-center gap-4 p-5 bg-slate-800/60 border border-slate-700/60 rounded-xl hover:bg-slate-800/80 hover:border-slate-600/60 transition-all duration-200 shadow-lg min-h-[96px]"
    >
      <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg ${getRankColor(rank)}`}>
        #{rank}
      </div>

      <div className="w-[72px] h-[72px] rounded-full overflow-hidden bg-slate-700 border-2 border-slate-600/50">
        {imageLoading ? (
          <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-700 animate-pulse" />
        ) : imageUrl ? (
          <Image
            src={imageUrl}
            alt={director?.name ?? 'director'}
            width={72}
            height={72}
            className="w-full h-full object-cover"
            loading="lazy"
            sizes="(max-width: 768px) 72px, 96px"
            onError={() => setImageUrl(null)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400"><User /></div>
        )}
      </div>

      <div className="min-w-0">
        <div className="text-lg font-semibold text-white truncate leading-tight">{first || 'Unknown'}</div>
        {last && <div className="text-white/90 font-semibold truncate -mt-0.5">{last}</div>}
        <div className="text-cyan-400 font-medium tabular-nums mt-0.5">
          {typeof director?.count === 'number' ? director.count.toLocaleString() : director?.count} films
        </div>
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
    className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-4 md:p-6 hover:scale-[1.02] hover:bg-slate-800/80 hover:border-slate-600/60 transition-all duration-200 shadow-lg h-full min-h-[120px] md:min-h-[140px] grid place-content-center text-center"
  >
    <div>
      <div className={`${size === 'large' 
        ? 'text-[clamp(20px,4vw,40px)] md:text-[clamp(24px,2.5vw,36px)]' 
        : 'text-[clamp(18px,3.5vw,28px)] md:text-[clamp(20px,2vw,32px)]'} font-black ${color} leading-tight tabular-nums`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="uppercase tracking-wider opacity-80 font-medium text-[11px] md:text-sm mt-1">{label}</div>
    </div>
  </motion.div>
);

// Actor Card Component with TMDB Image Fetching
interface ActorCardProps {
  actor: ActorItem;
  rank: number;
  variant?: 'main' | 'small';
  stats?: LetterboxdStats;
}

const ActorCard: React.FC<ActorCardProps> = ({ actor, rank, variant = 'small', stats }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setVisible(true); });
    }, { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  
  useEffect(() => {
    const ctrl = new AbortController();
    let released = false;
    let releaseFn: (() => void) | null = null;
    const fetchActorImage = async () => {
      if (!actor?.name) return;
      if (!visible) return;
      
      // Check cache first
      const cacheKey = `actor-${actor.name}`;
      const local = getCachedUrl(actor.name, 'actor');
      if (local !== undefined) { if (local) setImageUrl(local); return; }
      if (imgCache.has(cacheKey)) { const cachedUrl = imgCache.get(cacheKey); if (cachedUrl) setImageUrl(cachedUrl); return; }
      
      setImageLoading(true);
      try {
        if (__DEV__) console.log(`🎭 Fetching TMDB image for actor: ${actor.name}`);
        releaseFn = await acquire();
        const response = await fetch(`http://localhost:8000/api/tmdb/person/search?name=${encodeURIComponent(actor.name)}&role=actor`, { signal: ctrl.signal });
        
        if (response.ok) {
          const data = await response.json();
          if (__DEV__) console.log(`📡 TMDB API response for actor ${actor.name}:`, data);
          
          if (data.found && data.url) {
            if (__DEV__) console.log(`✅ Setting actor image URL: ${data.url}`);
            imgCache.set(cacheKey, data.url);
            setCachedUrl(actor.name, 'actor', data.url);
            setImageUrl(data.url);
          } else {
            if (__DEV__) console.log(`❌ No image found for actor: ${actor.name}`, data);
            imgCache.set(cacheKey, null);
            setCachedUrl(actor.name, 'actor', null);
          }
        } else {
          if (__DEV__) console.error(`❌ TMDB API error for actor ${actor.name}:`, response.status, response.statusText);
          imgCache.set(cacheKey, null);
          setCachedUrl(actor.name, 'actor', null);
        }
      } catch (error) {
        if (__DEV__) console.error(`💥 Error fetching actor image for ${actor.name}:`, error);
        imgCache.set(cacheKey, null);
        setCachedUrl(actor.name, 'actor', null);
      } finally {
        setImageLoading(false);
        try { if (releaseFn) releaseFn(); released = true; } catch {}
      }
    };
    
    const timeout = setTimeout(fetchActorImage, rank * 150);
    return () => { clearTimeout(timeout); try { ctrl.abort(); } catch {} if (!released) { try { const next = queue.shift(); activeRequests = Math.max(0, activeRequests - 1); if (next) next(); } catch {} } };
  }, [actor.name, rank, visible]);
  
  if (!actor) {
    return null;
  }

  if (variant === 'main') {
    return (
      <div ref={ref} className="lg:col-span-2 flex items-center gap-4 md:gap-6 bg-gradient-to-r from-pink-500/20 to-rose-500/20 border border-pink-500/30 rounded-2xl p-6">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-2 border-pink-400/40 bg-slate-700 flex-shrink-0">
          {imageLoading ? (
            <div className="w-full h-full bg-gradient-to-br from-pink-600/30 to-rose-600/30 animate-pulse" />
          ) : imageUrl ? (
            <Image src={imageUrl} alt={actor.name} width={128} height={128} className="w-full h-full object-cover" loading="lazy" sizes="(max-width: 768px) 96px, 160px"/>
                          ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300" aria-label={actor.name}><Heart /></div>
                )}
        </div>
        <div>
          <div className="text-2xl md:text-4xl font-black text-pink-400">{actor.name}</div>
          <div className={`${typography.caption} text-pink-200`}>{actor.count} films together</div>
          <div className="text-lg font-semibold text-pink-300 mt-1">#1 Favorite</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="flex items-center gap-3 bg-slate-800/60 border border-slate-600/40 rounded-xl p-3 md:p-4 min-h-[64px]">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm md:text-base text-white line-clamp-1">#{rank} {actor.name}</div>
        <div className="text-xs text-slate-300 line-clamp-1 tabular-nums">
          {typeof actor.count === 'number' ? actor.count.toLocaleString() : actor.count} films
        </div>
        {/* Progress bar */}
        {stats?.top_actors && stats.top_actors[0] && (
          <div className="w-full h-1 bg-slate-700 rounded-full mt-2 overflow-hidden">
            <div 
              className="h-full bg-pink-500/60 rounded-full transition-all duration-300"
              style={{ width: `${Math.round((actor.count / stats.top_actors[0].count) * 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Language mapping
const languageMap: { [key: string]: string } = {
    en: 'English', fr: 'French', ja: 'Japanese', es: 'Spanish', ko: 'Korean',
    de: 'German', it: 'Italian', ru: 'Russian', pt: 'Portuguese', zh: 'Chinese',
    hi: 'Hindi', sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish',
    tr: 'Türkçe'
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
      <div className="bg-slate-900/95 backdrop-blur-sm p-3 rounded-lg border border-orange-500/40 text-white shadow-2xl">
        <p className="font-bold text-lg mb-1">{label}</p>
        <p className="text-orange-400 font-semibold">{`${payload[0].value} films`}</p>
      </div>
    );
  }
  return null;
};

// Utility function for splitting names
const splitName = (full: string) => {
  const s = (full || '').trim();
  const parts = s.split(/\s+/);
  if (s.length <= 16 || parts.length < 2) return { first: s, last: '' };
  const last = parts.pop()!;
  return { first: parts.join(' '), last };
};

// --- Main Component ---
const ComprehensiveResultsPage = () => {
  const [stats, setStats] = useState<LetterboxdStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const reduce = useReducedMotion();
  const [scrollDepthsTracked, setScrollDepthsTracked] = useState<Set<number>>(new Set());
  
  // Consent modal state
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 480);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Track scroll depth
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = Math.round((scrollTop / docHeight) * 100);
      
      const depths = [25, 50, 75, 100];
      depths.forEach(depth => {
        if (scrollPercent >= depth && !scrollDepthsTracked.has(depth)) {
          trackAnalyticsEvent('scroll_depth', { depth });
          setScrollDepthsTracked(prev => new Set([...prev, depth]));
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollDepthsTracked]);

  useEffect(() => {
    console.log('[Results] Page loading...');
    const savedStats = localStorage.getItem('letterboxdStats');
    console.log('[Results] Saved stats found:', !!savedStats);
    
    if (savedStats) {
      try {
        const parsedStats = JSON.parse(savedStats);
        console.log('[Results] Stats parsed successfully, keys:', Object.keys(parsedStats));
        setStats(parsedStats);
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error parsing stats:', err);
        }
      }
    } else {
      console.log('[Results] No saved stats found in localStorage');
    }
    setLoading(false);
    
    // Track page view
    trackEvent('page_view', { page: 'results' });
    trackAnalyticsEvent('results_view');
    console.log('[Results] Page view tracked');
  }, []);

  // Initialize session ID and check for consent modal
  useEffect(() => {
    const currentSessionId = getSessionId();
    setSessionId(currentSessionId);
    
    // Show consent modal after 0.5 seconds if not shown before
    const timer = setTimeout(() => {
      if (!hasConsentModalBeenShown()) {
        setShowConsentModal(true);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  // Handle consent modal actions
  const handleConsentAccept = () => {
    markConsentModalAsShown(); // This is equivalent to setting 'consentGateSeen'
    saveConsentToStorage('accept');
    setShowConsentModal(false);
    trackEvent('consent_given', { decision: 'accept', session_id: sessionId });
    
    // Track film stats after consent is given
    if (stats) {
      trackFilmStats({
        total_films: stats.total_films,
        average_rating: stats.average_rating,
        top_genres: stats.top_genres?.map(g => g.name) || [],
        top_directors: stats.top_directors?.map(d => d.name) || [],
        countries_watched: stats.top_countries?.map(c => c.name) || [],
        languages_watched: stats.top_languages?.map(l => l.language) || []
      });
    }
  };

  const handleConsentDecline = () => {
    markConsentModalAsShown(); // This is equivalent to setting 'consentGateSeen'
    saveConsentToStorage('decline');
    setShowConsentModal(false);
    trackEvent('consent_given', { decision: 'decline', session_id: sessionId });
  };

  // ALWAYS called - null-safe hooks
  const decadeData = useMemo(() => {
    const src = stats?.decades ?? [];
    return src
      .filter(d => d.decade && d.decade !== 'Unknown')
      .sort((a,b) => parseInt(String(a.decade).replace('s','')) - parseInt(String(b.decade).replace('s','')))
      .map(d => ({ ...d, decade: String(d.decade).includes('s') ? d.decade : `${d.decade}s` }));
  }, [stats?.decades]);

  const languageData = useMemo(() => (stats?.top_languages ?? []).slice(0,7), [stats?.top_languages]);
  // const totalLanguageCount = useMemo(() => languageData.reduce((a,l)=>a+l.count,0), [languageData]);
  const COLORS = ['#f97316', '#a855f7', '#3b82f6', '#10b981', '#eab308', '#059669', '#ec4899', '#22c55e'];

  const ratingsArr = useMemo(() => {
    const dist = stats?.rating_distribution ?? {};
    return Object.entries(dist)
      .map(([r,c]) => ({ ratingNum: parseFloat(r), label: `${r}★`, count: c as number }))
      .sort((a,b)=> a.ratingNum - b.ratingNum);
  }, [stats?.rating_distribution]);

  const decadeMax = useMemo(() => Math.max(0, ...decadeData.map(d=>d.count)), [decadeData]);
  const ratingMax = useMemo(() => Math.max(0, ...ratingsArr.map(d=>d.count)), [ratingsArr]);

  // Movie crush calculation
  const crush = useMemo(() => 
    stats?.movie_crush ?? (stats?.top_actors?.[0] ? { 
      name: stats.top_actors[0].name, 
      profile_path: stats.top_actors[0].profile_path ?? "", 
      count: stats.top_actors[0].count 
    } : null), [stats?.movie_crush, stats?.top_actors]);
  
  // If we have movie_crush with profile_path, use it instead of fetching from TMDB
  const shouldUseCrush = useMemo(() => crush && crush.profile_path, [crush]);

  // Date range calculation for time percentage
  const rangeDays = useMemo(() =>
    stats?.data_timeline?.total_days ??
    Math.max(1, Math.round((new Date(stats?.data_timeline?.latest_date ?? Date.now()).getTime()
      - new Date(stats?.data_timeline?.earliest_date ?? Date.now()).getTime()) / 86400000)), [stats?.data_timeline]);
  
  const timePct = useMemo(() => 
    `${Math.round(((stats?.days_watched ?? 0) / rangeDays) * 100)}%`, [stats?.days_watched, rangeDays]);

  // Cinephile score calculation
  const cineScore = useMemo(() => 
    Math.max(0, Math.min(100, stats?.sinefil_meter?.score ?? calcCinephileScore(stats))), [stats]);

  // Removed - now using actual languageData with Recharts PieChart

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
  
  return (
    <LazyMotion features={domAnimation}>
    <div className="font-sans bg-slate-900 text-white overflow-x-hidden relative min-h-screen">
      {/* Consent Modal */}
      <PreResultsConsentModal
        open={showConsentModal}
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
        sessionId={sessionId}
      />
      {/* Subtle background gradients */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full filter blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full filter blur-[120px]" />
        </div>

      <main className="relative z-10 px-3 md:px-8 py-4 md:py-6 max-w-7xl mx-auto space-y-3 md:space-y-6">
                {/* Header */}
        <header className="text-center py-4 md:py-10">
          <motion.h1 
            variants={itemVariants}
            initial={reduce ? false : "hidden"}
            animate="visible"
                          className="text-[clamp(32px,6vw,72px)] font-black text-white mb-4 leading-[0.95] tracking-tighter"
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
        <section className="flex items-center justify-center py-4 md:py-6">
          <div className="text-center space-y-4 md:space-y-6 max-w-4xl mx-auto w-full">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 items-stretch" style={{ gridAutoRows: '1fr' }}>
              <StatCard
                value={typeof stats.total_films === 'number' ? stats.total_films.toLocaleString() : stats.total_films}
                label="Films"
                size="large"
                color="text-white"
              />
              <StatCard
                value={`${typeof stats.average_rating === 'number' ? stats.average_rating.toFixed(1) : stats.average_rating}★`}
                label="Avg Rating"
                color={colors.rating}
                size="large"
              />
              <StatCard
                value={typeof stats.days_watched === 'number' ? Math.round(stats.days_watched).toLocaleString() : stats.days_watched}
                label="Days"
                color={colors.time}
                size="large"
              />
              <StatCard
                value={stats.favorite_genre.name}
                label="Top Genre"
                color={colors.genre}
              />
        </div>

            {/* Cinema Identity */}
            {stats.cinematic_persona && (
        <div
                className="bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/40 rounded-3xl p-4 md:p-6 lg:p-8 text-center"
              >
                <div className="text-sm md:text-lg text-orange-200 mb-2">Your Cinema Identity</div>
                <div className="text-2xl md:text-4xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-400">
                  {stats.cinematic_persona.persona}
            </div>
          </div>
            )}
            
            {/* Key Stats Highlight */}
            <div
              className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-3xl p-4 md:p-6 lg:p-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
                <div className="text-center bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col items-center justify-center min-h-[100px] md:min-h-[120px]">
                  <div className="text-3xl md:text-4xl lg:text-5xl font-black text-orange-500 mb-2">
                    {timePct}
                  </div>
                  <div className="text-sm md:text-base uppercase tracking-wider opacity-80 font-medium text-orange-200">of your time spent watching films</div>
                </div>
                <div className="text-center bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col items-center justify-center min-h-[100px] md:min-h-[120px]">
                  <div className="text-xl md:text-2xl lg:text-3xl font-bold text-cyan-500 mb-2 truncate">
                    {stats.most_watched_director.name}
                  </div>
                  <div className="text-sm md:text-base uppercase tracking-wider opacity-80 font-medium text-cyan-200">{typeof stats.most_watched_director.count === 'number' ? stats.most_watched_director.count.toLocaleString() : stats.most_watched_director.count} films • Your director</div>
                </div>
                <div className="text-center bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col items-center justify-center min-h-[100px] md:min-h-[120px]">
                  <div className="text-3xl md:text-4xl lg:text-5xl font-black text-purple-500 mb-2">
                    {stats.favorite_decade.name}
                  </div>
                  <div className="text-sm md:text-base uppercase tracking-wider opacity-80 font-medium text-purple-200">{typeof stats.favorite_decade.count === 'number' ? stats.favorite_decade.count.toLocaleString() : stats.favorite_decade.count} films • Your peak decade</div>
                </div>
              </div>
            </div>
              </div>
        </section>

        {/* Favorite Directors */}
        <Section title="Favorite Directors" subtitle={`${typeof stats.total_directors === 'number' ? stats.total_directors.toLocaleString() : stats.total_directors} directors explored`} icon="🎬">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {stats.top_directors && stats.top_directors.length > 0 ? (
              stats.top_directors.slice(0, 3).map((director, i) => (
                <DirectorCard key={director.name} director={director} rank={i + 1} />
              ))
            ) : (
              <motion.div variants={itemVariants} className="text-center py-8 text-gray-400 col-span-3">
                <User size={48} className="mx-auto mb-4 opacity-50" />
                <p>No director data available</p>
              </motion.div>
            )}
          </div>
        </Section>

        {/* Top Genres */}
        <Section title="Genre Preferences" subtitle="Your most-watched categories" icon="🎭">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                        {(stats.top_genres ?? []).slice(0, 5).map((genre, i) => {
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
                  className={`bg-gradient-to-br ${genreColors[i]} border rounded-xl p-3 md:p-4 text-center hover:scale-[1.02] hover:shadow-lg transition-all duration-200 min-h-[92px] flex flex-col items-center justify-center`}
                >
                  <div className="text-lg md:text-xl font-semibold mb-1">{genre.name}</div>
                  <div className="text-xs md:text-sm opacity-80 font-medium tabular-nums">
                    {typeof genre.count === 'number' ? genre.count.toLocaleString() : genre.count} films
                  </div>
                            </motion.div>
                );
            })}
                        </div>
                    </Section>

                {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
          {/* Languages */}
          <Section title="Languages" subtitle="Your linguistic journey">
            <div className="w-full h-56 md:h-64 py-3 md:py-0">
              <ResponsiveContainer>
                <PieChart margin={{ top: 8, bottom: 8 }}>
                  <Pie 
                    data={languageData} 
                    dataKey="count" 
                    nameKey="language" 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={70} 
                    outerRadius={110} 
                    fill="#8884d8" 
                    paddingAngle={5} 
                    cornerRadius={10}
                  >
                    {languageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={{fill: 'rgba(255,255,255,0.1)'}}
                    content={<CustomTooltip />}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Countries */}
          <Section title="Countries" subtitle={`Films from ${typeof stats.total_countries === 'number' ? stats.total_countries.toLocaleString() : stats.total_countries} countries`}>
            <div className="space-y-2 md:space-y-3">
              {(stats.top_countries ?? []).slice(0, 8).map((country, index) => {
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
                                            <div className="flex items-center min-w-0">
                        <span className="text-xs md:text-sm font-bold w-6 md:w-8 opacity-70 flex-shrink-0">#{index + 1}</span>
                        <span className="font-semibold text-sm md:text-base truncate">{country.name}</span>
                      </div>
                    <span className="font-bold text-sm md:text-base w-16 text-center py-1 px-3 rounded-lg bg-white/10 border border-white/15 flex-shrink-0 tabular-nums">{typeof country.count === 'number' ? country.count.toLocaleString() : country.count}</span>
                  </motion.div>
                );
              })}
              </div>
          </Section>
        </div>

        {/* Film Timeline */}
        <Section title="Film History" subtitle="Your journey through cinema decades">
          <div className="w-full h-64 md:h-80 lg:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={decadeData}
                margin={{ top: 12, right: isMobile ? 12 : 30, left: isMobile ? 10 : 20, bottom: isMobile ? 48 : 60 }}
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
                  tick={{ fill: '#94a3b8', fontSize: isMobile ? 10 : 12 }}
                  angle={isMobile ? -30 : 0}
                  textAnchor={isMobile ? 'end' : 'middle'}
                  height={isMobile ? 60 : 40}
                  tickLine={{ stroke: '#475569' }}
                  interval={isMobile ? 1 : 'preserveStartEnd'}
                  axisLine={{ stroke: '#475569' }}
                  tickMargin={isMobile ? 2 : 6}
                />
                <YAxis
                  stroke="#64748b" 
                  tick={{ fill: '#94a3b8', fontSize: isMobile ? 10 : 11 }}
                  tickLine={{ stroke: '#475569' }}
                  axisLine={{ stroke: '#475569' }}
                  domain={[0, Math.ceil(decadeMax * 1.2)]}
                  allowDecimals={false}
                  tickCount={isMobile ? 4 : 6}
                  tickMargin={isMobile ? 2 : 6}
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
                    r: 4 
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
          </div>
        </Section>
        
        {/* Rating Distribution */}
        <Section title="Rating Patterns" subtitle="How you rate films">
          <div className="w-full h-48 md:h-64 lg:h-80">
                <ResponsiveContainer>
              <BarChart data={ratingsArr}>
                        <XAxis dataKey="label" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <YAxis 
                  stroke="#9ca3af" 
                  tick={{ fill: '#9ca3af' }} 
                  domain={[0, Math.ceil(ratingMax * 1.2)]}
                  allowDecimals={false}
                  tickCount={5}
                  tickMargin={6}
                />
                        <Tooltip
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    border: '1px solid rgba(234, 179, 8, 0.4)', 
                    borderRadius: '0.75rem',
                    color: '#ffffff',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                  }}
                />
                <Bar dataKey="count" fill={chartColors.rating} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Section>

        {/* Quick Facts */}
        <Section title="Quick Facts" subtitle="Notable highlights from your viewing">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
            <div className="text-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col justify-center min-h-[100px] md:min-h-[120px]">
              <div className={`${typography.statNumberSm} text-emerald-500 mb-2`}>{stats.average_runtime.toFixed(0)}</div>
              <div className={`${typography.statLabelSm} text-emerald-200`}>minutes average</div>
            </div>

            <div className="text-center bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col justify-center min-h-[100px] md:min-h-[120px]">
              <div className={`${typography.statNumberSm} text-purple-500 mb-2`}>{typeof stats.total_countries === 'number' ? stats.total_countries.toLocaleString() : stats.total_countries}</div>
              <div className={`${typography.statLabelSm} text-purple-200`}>countries explored</div>
            </div>

            <div className="text-center bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col justify-center min-h-[100px] md:min-h-[120px]">
              <div className={`${typography.statNumberSm} text-yellow-500 mb-2`}>{stats.most_common_rating}★</div>
              <div className={`${typography.statLabelSm} text-yellow-200`}>most common rating</div>
            </div>
          </div>
        </Section>

        {/* Runtime Analysis */}
        <Section title="Runtime Analysis" subtitle="Session-length insights" className="hidden md:block">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="col-span-1 md:col-span-1 text-center bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-6 min-h-[140px] md:min-h-[160px] grid place-content-center">
              <div className={`${typography.bigNumber} text-blue-400 mb-2`}>{Math.round(stats.average_runtime)}</div>
              <div className={`text-blue-200 text-xs md:text-sm opacity-80 tabular-nums mt-1`}>minutes average</div>
            </div>
            <div className="md:col-span-2 text-center bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl p-6 min-h-[140px] md:min-h-[160px] grid place-content-center">
              <div className={`text-indigo-400 mb-2 text-[clamp(18px,4.5vw,40px)] md:text-[clamp(22px,2.8vw,44px)] font-black leading-tight tracking-tight text-balance line-clamp-2`}>{stats.longest_film.title}</div>
              <div className={`text-indigo-200 text-xs md:text-sm opacity-80 tabular-nums mt-1`}>Longest Film • {stats.longest_film.runtime} min</div>
            </div>
          </div>
        </Section>

        {/* Your On-Screen Crush */}
        {(stats.top_actors && stats.top_actors.length > 0) && (
          <Section title="Your On-Screen Crush" subtitle="Top actors you couldn't get enough of">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              {/* Main Crush - Larger */}
              {shouldUseCrush && crush ? (
                <div className="lg:col-span-2 flex items-center gap-4 md:gap-6 bg-gradient-to-r from-pink-500/20 to-rose-500/20 border border-pink-500/40 rounded-2xl p-6 min-h-[92px]">
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-2 border-pink-400/40 bg-slate-700 flex-shrink-0">
                    <Image 
                      src={`https://image.tmdb.org/t/p/w300${crush.profile_path}`} 
                      alt={crush.name} 
                      width={96} 
                      height={96}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      sizes="(max-width: 768px) 96px, 160px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-2xl md:text-4xl font-black text-pink-400 line-clamp-1">{crush.name}</div>
                    <div className={`${typography.caption} text-pink-200 line-clamp-1`}>{crush.count} films together</div>
                    <div className="text-lg font-semibold text-pink-300 mt-1">#1 Favorite</div>
                  </div>
                </div>
              ) : (
                <ActorCard actor={stats.top_actors[0]} rank={1} variant="main" stats={stats} />
              )}
              
              {/* Runner-ups */}
              <div className="space-y-3 lg:space-y-4">
                {stats.top_actors.slice(1, 3).map((actor, index) => (
                  <ActorCard key={`${actor.name}-${index}`} actor={actor} rank={index + 2} variant="small" stats={stats} />
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* Your Signature Combo */}
        {stats.signature_combo && (
          <Section title="Your Signature Combo" subtitle="Favorite director–actor pairing">
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-6 md:p-8 text-center">
              <div className="text-2xl md:text-3xl font-bold mb-2">
                {stats.signature_combo.director} × {stats.signature_combo.actor}
              </div>
              <div className={`${typography.caption}`}>{typeof stats.signature_combo.count === 'number' ? stats.signature_combo.count.toLocaleString() : stats.signature_combo.count} films together</div>
            </div>
          </Section>
        )}

        {/* Your Cinema Scale */}
        <Section title="Your Cinema Scale" subtitle="Popular vs Niche film preferences">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 md:p-8">
            <div className="text-center mb-4 md:mb-6 lg:flex lg:items-center lg:justify-between lg:text-left">
              <div className="lg:flex-1">
                <div className="text-2xl md:text-3xl font-bold">
                  {stats.sinefil_meter?.type || 'Independent Cinephile'}
                </div>
                {stats.sinefil_meter?.description && (
                  <div className="text-sm text-slate-300 mt-2">{stats.sinefil_meter.description}</div>
                )}
              </div>
              <div className="text-5xl md:text-7xl font-black mt-1 lg:mt-0 lg:ml-8 tabular-nums">{cineScore} <span className="text-2xl">/ 100</span></div>
            </div>
            <div className="w-full h-3 md:h-4 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${cineScore}%` }} />
            </div>
            <div className={`${typography.caption} mt-2 text-center`}>Higher = more obscure/indie taste</div>
          </div>
        </Section>

        {/* Footer */}
        <footer className="text-center py-12">
            <p className="text-gray-400">Thank you for exploring your cinematic journey with us!</p>
        </footer>

        {/* Dev helper button */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="fixed bottom-3 right-3 text-xs text-slate-300/70">
            <button
              className="block underline"
              onClick={() => {
                sessionStorage.removeItem('consent_modal_shown');
                setShowConsentModal(true);
              }}
            >
              test consent modal
            </button>
          </div>
        )}
      </main>
      {/* Feedback hidden for now */}
      <div className="hidden">
        <FeedbackFab sessionId={typeof window !== 'undefined' ? (new URLSearchParams(window.location.search)).get('session') : null} />
      </div>
    </div>
    </LazyMotion>
  );
};

export default ComprehensiveResultsPage;