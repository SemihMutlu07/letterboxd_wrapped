'use client';

import React from 'react';
import Section from '@/components/results/Section';
import { getSinefilPercentile } from '@/lib/supabase/analysis_runs';
import { searchMovie } from '@/lib/api';

interface Breakdown {
  geography: number;
  temporal: number;
  languages: number;
  volume: number;
  genres: number;
  directors: number;
}

interface MovieSuggestion {
  title: string;
  year: number;
  tag: string;
}

// Curated pools of acclaimed films, tagged so we can filter against what the
// user already watches a lot of and surface genuinely underrepresented picks.
const GEOGRAPHY_POOL: MovieSuggestion[] = [
  { title: 'Parasite', year: 2019, tag: 'South Korea' },
  { title: 'City of God', year: 2002, tag: 'Brazil' },
  { title: 'Tsotsi', year: 2005, tag: 'South Africa' },
  { title: 'A Separation', year: 2011, tag: 'Iran' },
  { title: 'Roma', year: 2018, tag: 'Mexico' },
  { title: 'The Handmaiden', year: 2016, tag: 'South Korea' },
  { title: 'Amélie', year: 2001, tag: 'France' },
  { title: 'Wild Tales', year: 2014, tag: 'Argentina' },
  { title: 'Timbuktu', year: 2014, tag: 'Mauritania' },
  { title: 'Rashomon', year: 1950, tag: 'Japan' },
];

const TEMPORAL_POOL: MovieSuggestion[] = [
  { title: 'Metropolis', year: 1927, tag: '1920s' },
  { title: 'Casablanca', year: 1942, tag: '1940s' },
  { title: 'Seven Samurai', year: 1954, tag: '1950s' },
  { title: '2001: A Space Odyssey', year: 1968, tag: '1960s' },
  { title: 'Chinatown', year: 1974, tag: '1970s' },
  { title: 'Blade Runner', year: 1982, tag: '1980s' },
  { title: 'Pulp Fiction', year: 1994, tag: '1990s' },
  { title: 'City of God', year: 2002, tag: '2000s' },
  { title: 'Whiplash', year: 2014, tag: '2010s' },
  { title: 'Everything Everywhere All at Once', year: 2022, tag: '2020s' },
];

const LANGUAGE_POOL: MovieSuggestion[] = [
  { title: 'Oldboy', year: 2003, tag: 'Korean' },
  { title: 'Amélie', year: 2001, tag: 'French' },
  { title: 'Pan\'s Labyrinth', year: 2006, tag: 'Spanish' },
  { title: 'Life is Beautiful', year: 1997, tag: 'Italian' },
  { title: 'Spirited Away', year: 2001, tag: 'Japanese' },
  { title: 'Wings of Desire', year: 1987, tag: 'German' },
  { title: 'Talk to Her', year: 2002, tag: 'Spanish' },
  { title: 'The Lives of Others', year: 2006, tag: 'German' },
  { title: 'In the Mood for Love', year: 2000, tag: 'Cantonese' },
  { title: 'Monsoon Wedding', year: 2001, tag: 'Hindi' },
];

const GENRE_POOL: MovieSuggestion[] = [
  { title: 'Get Out', year: 2017, tag: 'Horror' },
  { title: 'Man on Wire', year: 2008, tag: 'Documentary' },
  { title: 'Arrival', year: 2016, tag: 'Sci-Fi' },
  { title: 'In Bruges', year: 2008, tag: 'Black Comedy' },
  { title: 'The Act of Killing', year: 2012, tag: 'Documentary' },
  { title: 'Coherence', year: 2013, tag: 'Sci-Fi' },
  { title: 'Hereditary', year: 2018, tag: 'Horror' },
  { title: 'Waltz with Bashir', year: 2008, tag: 'Animated Documentary' },
  { title: 'The Grand Budapest Hotel', year: 2014, tag: 'Comedy' },
  { title: 'Zodiac', year: 2007, tag: 'Mystery' },
];

const DIRECTOR_POOL: MovieSuggestion[] = [
  { title: 'Portrait of a Lady on Fire', year: 2019, tag: 'Céline Sciamma' },
  { title: 'Burning', year: 2018, tag: 'Lee Chang-dong' },
  { title: 'Uncle Boonmee Who Can Recall His Past Lives', year: 2010, tag: 'Apichatpong Weerasethakul' },
  { title: 'Zama', year: 2017, tag: 'Lucrecia Martel' },
  { title: 'The Souvenir', year: 2019, tag: 'Joanna Hogg' },
  { title: 'Happy as Lazzaro', year: 2018, tag: 'Alice Rohrwacher' },
  { title: 'Cemetery of Splendour', year: 2015, tag: 'Apichatpong Weerasethakul' },
  { title: 'You Were Never Really Here', year: 2017, tag: 'Lynne Ramsay' },
  { title: 'The Beguiled', year: 2017, tag: 'Sofia Coppola' },
  { title: 'First Cow', year: 2019, tag: 'Kelly Reichardt' },
];

const VOLUME_POOL: MovieSuggestion[] = [
  { title: 'Stalker', year: 1979, tag: 'Essential' },
  { title: 'The Seventh Seal', year: 1957, tag: 'Essential' },
  { title: 'Do the Right Thing', year: 1989, tag: 'Essential' },
  { title: 'Come and See', year: 1985, tag: 'Essential' },
  { title: 'Mulholland Drive', year: 2001, tag: 'Essential' },
  { title: 'The Battle of Algiers', year: 1966, tag: 'Essential' },
];

export default function CinemaScale({
  description,
  score,
  breakdown,
  topCountries,
  topLanguages,
  topGenres,
  topDirectors,
  favoriteDecade,
}: {
  type?: string;
  description?: string;
  score: number;
  breakdown?: Breakdown;
  topCountries?: string[];
  topLanguages?: string[];
  topGenres?: string[];
  topDirectors?: string[];
  favoriteDecade?: string;
}) {
  // Score interpretation
  const getScoreMessage = (score: number) => {
    if (score >= 90) return "Top 5% of film enthusiasts";
    if (score >= 80) return "Top 10% of cinema lovers";
    if (score >= 70) return "Top 20% of movie watchers";
    if (score >= 60) return "Above average film taste";
    if (score >= 50) return "Balanced film preferences";
    if (score >= 40) return "Popular taste with variety";
    if (score >= 30) return "Mainstream preferences";
    return "Blockbuster focused";
  };

  const [percentile, setPercentile] = React.useState<number | null>(null);
  const [revealed, setRevealed] = React.useState(false);
  const [selectedAxis, setSelectedAxis] = React.useState<keyof Breakdown | null>(null);
  const [posterUrls, setPosterUrls] = React.useState<Record<string, string | null>>({});

  const reveal = () => setRevealed(true);

  const handleAxisClick = (e: React.MouseEvent, key: keyof Breakdown) => {
    e.stopPropagation();
    if (!revealed) {
      reveal();
      return;
    }
    setSelectedAxis(key);
  };

  React.useEffect(() => {
    let cancelled = false;
    getSinefilPercentile(score)
      .then((pct) => {
        if (!cancelled) setPercentile(pct);
      })
      .catch(() => {
        if (!cancelled) setPercentile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [score]);

  const axes: { key: keyof Breakdown; label: string; max: number; color: string }[] = [
    { key: 'geography',  label: 'Geographic',  max: 25, color: 'bg-emerald-500' },
    { key: 'temporal',   label: 'Historical',   max: 20, color: 'bg-purple-500' },
    { key: 'languages',  label: 'Languages',    max: 15, color: 'bg-cyan-500' },
    { key: 'volume',     label: 'Volume',       max: 15, color: 'bg-orange-500' },
    { key: 'genres',     label: 'Genres',       max: 15, color: 'bg-pink-500' },
    { key: 'directors',  label: 'Directors',    max: 10, color: 'bg-yellow-500' },
  ];

  const axisInfo: Record<keyof Breakdown, { info: string }> = {
    geography: {
      info: 'Measures how evenly your watched films are spread across different countries of origin. A heavy concentration in one country (over 80% of your films) caps this score.',
    },
    temporal: {
      info: 'Rewards a spread across different decades plus how far back your median release year sits from today. Watching mostly recent releases limits this score.',
    },
    languages: {
      info: 'Measures diversity of the original languages of your watched films. If one language makes up more than 85% of your films, the score is penalized.',
    },
    volume: {
      info: 'A log-scaled score based on your total number of logged films — each additional film matters less as your count grows, so it rewards consistent logging over time.',
    },
    genres: {
      info: 'Measures how evenly distributed your films are across different genres, with no single-genre penalty beyond the natural entropy calculation.',
    },
    directors: {
      info: 'Based on how concentrated your viewing is among your top 3 most-watched directors — the more your films are spread across many directors rather than a few favorites, the higher this scores.',
    },
  };

  const alreadyWatched = (needle: string, haystack?: string[]) =>
    (haystack ?? []).some((h) => h.toLowerCase().trim() === needle.toLowerCase().trim());

  const getMovieSuggestions = (key: keyof Breakdown): MovieSuggestion[] => {
    let pool: MovieSuggestion[];
    let existing: string[] | undefined;

    switch (key) {
      case 'geography':
        pool = GEOGRAPHY_POOL;
        existing = topCountries;
        break;
      case 'temporal':
        pool = TEMPORAL_POOL;
        existing = favoriteDecade ? [favoriteDecade] : undefined;
        break;
      case 'languages':
        pool = LANGUAGE_POOL;
        existing = topLanguages;
        break;
      case 'genres':
        pool = GENRE_POOL;
        existing = topGenres;
        break;
      case 'directors':
        pool = DIRECTOR_POOL;
        existing = topDirectors;
        break;
      case 'volume':
      default:
        return VOLUME_POOL.slice(0, 3);
    }

    const novel = pool.filter((m) => !alreadyWatched(m.tag, existing));
    const picks = novel.length >= 3 ? novel : pool;
    return picks.slice(0, 3);
  };

  React.useEffect(() => {
    if (!selectedAxis) return;
    const movies = getMovieSuggestions(selectedAxis);
    const toFetch = movies.filter((m) => !(m.title in posterUrls));
    if (toFetch.length === 0) return;

    let cancelled = false;
    toFetch.forEach((movie) => {
      searchMovie(movie.title, movie.year)
        .then((res) => {
          if (cancelled) return;
          setPosterUrls((prev) => ({
            ...prev,
            [movie.title]: res && res.found && typeof res.url === 'string' ? res.url : null,
          }));
        })
        .catch(() => {
          if (cancelled) return;
          setPosterUrls((prev) => ({ ...prev, [movie.title]: null }));
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAxis]);

  return (
    <Section title="Your Cinema Scale" subtitle="How adventurous is your film taste?">
      <div
        onClick={reveal}
        className={`bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 md:p-8 space-y-6 transition-all duration-200 ${
          revealed ? '' : 'cursor-pointer hover:bg-slate-800/80 hover:border-slate-600 hover:scale-[1.01]'
        }`}
      >
        {/* Main Score Display */}
        <div className="text-center mb-6">
          <div className="text-5xl md:text-7xl font-black tabular-nums">
            {revealed ? (
              <span className="transition-opacity duration-300">
                {score}<span className="text-2xl text-slate-400">/100</span>
              </span>
            ) : (
              <span className="text-slate-500">?</span>
            )}
          </div>
          <div
            className={`text-slate-300 mt-2 transition-opacity duration-500 ${revealed ? 'opacity-100' : 'opacity-0'}`}
          >
            {getScoreMessage(score)}
          </div>
          <div
            className={`text-sm text-blue-400 mt-1 transition-opacity duration-500 delay-150 ${
              revealed && percentile !== null ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {percentile !== null && `More adventurous than ${percentile}% of viewers`}
          </div>
          {!revealed && (
            <div className="text-xs text-slate-500 mt-3 animate-pulse">Click to reveal your score</div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="w-full h-4 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000 ease-out"
              style={{ width: revealed ? `${score}%` : '0%' }}
            />
          </div>
          {/* Score markers */}
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>Mainstream</span>
            <span>Balanced</span>
            <span>Arthouse</span>
          </div>
        </div>

        {/* Description */}
        {description && (
          <div
            className={`text-center transition-opacity duration-500 delay-200 ${revealed ? 'opacity-100' : 'opacity-0'}`}
          >
            <p className="text-slate-300 text-base leading-relaxed">
              {description}
            </p>
          </div>
        )}

        {/* Real Score Breakdown */}
        {breakdown ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {axes.map(({ key, label, max, color }, index) => {
              const val = breakdown[key] ?? 0;
              const pct = max > 0 ? Math.round((val / max) * 100) : 0;
              const delayMs = index * 70;
              return (
                <div
                  key={key}
                  onClick={(e) => handleAxisClick(e, key)}
                  className={`bg-slate-800/40 rounded-lg p-3 space-y-1.5 transition-colors ${
                    revealed ? 'cursor-pointer hover:bg-slate-700/50' : ''
                  }`}
                >
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-400">{label}</span>
                    <span
                      className={`font-semibold tabular-nums transition-opacity duration-300 ${revealed ? 'opacity-100' : 'opacity-0'}`}
                      style={{ transitionDelay: `${delayMs}ms` }}
                    >
                      {val}/{max}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} rounded-full transition-all duration-700 ease-out`}
                      style={{ width: revealed ? `${pct}%` : '0%', transitionDelay: `${delayMs}ms` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-center text-sm">
            {axes.map(({ key, label, max }) => (
              <div key={key} className="bg-slate-800/40 rounded-lg p-3">
                <div className="text-slate-400">{label}</div>
                <div className="font-semibold">/{max}</div>
              </div>
            ))}
          </div>
        )}

        {/* Competitive Element */}
        <div className="text-center text-sm text-slate-400 border-t border-slate-700 pt-4">
          Challenge your friends to beat your Cinema Scale score!
        </div>
      </div>

      {selectedAxis && breakdown && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedAxis(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold">
                  {axes.find((a) => a.key === selectedAxis)?.label}
                </h3>
                <p className="text-sm text-slate-400">
                  Your score: {breakdown[selectedAxis]}/{axes.find((a) => a.key === selectedAxis)?.max}
                </p>
              </div>
              <button
                onClick={() => setSelectedAxis(null)}
                className="text-slate-400 hover:text-slate-200 text-xl leading-none"
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">How it's scored</div>
              <p className="text-sm text-slate-300 leading-relaxed">{axisInfo[selectedAxis].info}</p>
            </div>
            <div>
              <div className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">Try these to improve it</div>
              <ul className="space-y-2">
                {getMovieSuggestions(selectedAxis).map((movie) => {
                  const poster = posterUrls[movie.title];
                  return (
                    <li
                      key={movie.title}
                      className="flex items-center gap-3 bg-slate-900/50 rounded-lg px-3 py-2"
                    >
                      <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-slate-700/50">
                        {poster ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={poster}
                            alt={`${movie.title} poster`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                            {poster === null ? '—' : ''}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 flex items-baseline justify-between min-w-0">
                        <span className="text-sm text-slate-200 font-medium truncate">
                          {movie.title} <span className="text-slate-500">({movie.year})</span>
                        </span>
                        <span className="text-xs text-blue-400 ml-2 flex-shrink-0">{movie.tag}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
