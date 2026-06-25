'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, HeartHandshake, Search } from 'lucide-react';

import { dateNight, handleApiError, type DateNightResult } from '@/lib/api';
import { getPosterUrl } from '@/lib/analytics';
import { readWatchlistUsersFromLocation } from '@/lib/routes';
import { pickRandomUsernames } from '@/lib/usernames';

const T = {
  darkblue: "#2776F5",
  paper: "#F1ECDE",
  card: "#FBF8EF",
  ink: "#100F0C",
  lime: "#AEE63E",
  amber: "#F2B33D",
  cyan: "#53CFE6",
  purple: "#A98BEA",
  red: "#E8463A",
  muted: "#6F6E63",
  darkamber: "#e16517",
  lines: "#cdcdcd"
};
const SERIF = 'Georgia, "Times New Roman", serif';
const MONO = 'ui-monospace, "Cascadia Code", "Courier New", monospace';
const shadow = (n: number) => `${n}px ${n}px 0 ${T.ink}`;

function cleanUsername(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export default function DateNight() {
  const placeholders = useMemo(() => pickRandomUsernames(2), []);
  const [first, setFirst] = useState(() => readWatchlistUsersFromLocation()[0]);
  const [second, setSecond] = useState(() => readWatchlistUsersFromLocation()[1]);
  const [result, setResult] = useState<DateNightResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [erroredPosters, setErroredPosters] = useState<Set<string>>(new Set());
  const normalized = useMemo(() => [cleanUsername(first), cleanUsername(second)] as const, [first, second]);
  const canSubmit = normalized[0].length > 0 && normalized[1].length > 0 && normalized[0] !== normalized[1];

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await dateNight(normalized[0], normalized[1]));
    } catch (err) {
      setError(handleApiError(err, 'date night recommendations').message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, border: `2.5px solid ${T.ink}`, background: T.card, padding: 20, boxShadow: shadow(2) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', height: 40, width: 40, alignItems: 'center', justifyContent: 'center', background: T.red, boxShadow: shadow(2) }}>
          <HeartHandshake className="h-5 w-5" style={{ color: T.ink }} />
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: T.ink }}>Date Night Engine</h2>
          <p style={{ fontSize: 14, color: T.muted, marginTop: 4 }}>Taste-profile recommendations beyond watchlist overlap.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(150px, 250px) minmax(150px, 250px) auto', alignItems: 'end' }}>
        <label style={{ display: 'block' }}>
          <span style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: T.muted }}>First profile</span>
          <input
            value={first}
            onChange={(event) => setFirst(event.target.value)}
            placeholder={placeholders[0]}
            aria-label="First Letterboxd username"
            style={{
              marginTop: 8,
              width: '100%',
              border: `2.5px solid ${T.ink}`,
              background: T.card,
              padding: '12px 16px',
              fontSize: 14,
              color: T.ink,
              transition: 'all 150ms',
              boxShadow: shadow(2),
              fontFamily: 'inherit'
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = shadow(3);
              e.currentTarget.style.borderColor = T.red;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = shadow(2);
              e.currentTarget.style.borderColor = T.ink;
            }}
          />
        </label>
        <label style={{ display: 'block' }}>
          <span style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: T.muted }}>Second profile</span>
          <input
            value={second}
            onChange={(event) => setSecond(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleSubmit();
            }}
            placeholder={placeholders[1]}
            aria-label="Second Letterboxd username"
            style={{
              marginTop: 8,
              width: '100%',
              border: `2.5px solid ${T.ink}`,
              background: T.card,
              padding: '12px 16px',
              fontSize: 14,
              color: T.ink,
              transition: 'all 150ms',
              boxShadow: shadow(2),
              fontFamily: 'inherit'
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = shadow(3);
              e.currentTarget.style.borderColor = T.red;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = shadow(2);
              e.currentTarget.style.borderColor = T.ink;
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            if (!canSubmit) {
              alert('Please enter both usernames and make sure they\'re different');
              return;
            }
            void handleSubmit();
          }}
          style={{
            display: 'inline-flex',
            height: 46,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: T.red,
            paddingLeft: 12,
            paddingRight: 12,
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: T.ink,
            cursor: 'pointer',
            transition: 'all 90ms',
            border: `2.5px solid ${T.ink}`,
            boxShadow: shadow(2),
            opacity: loading ? 0.6 : 1,
            marginLeft: 120
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.background = T.darkamber;
              e.currentTarget.style.boxShadow = shadow(3);
              e.currentTarget.style.transform = 'translate(-1px, -1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.background = T.red;
              e.currentTarget.style.boxShadow = shadow(2);
              e.currentTarget.style.transform = 'none';
            }
          }}
        >
          <Search className="h-4 w-4" />
          {loading ? 'Profiling' : 'Find films'}
        </button>
      </div>

      {error && <p style={{ border: `2.5px solid ${T.red}`, background: T.red + '20', padding: '12px 16px', fontSize: 14, color: T.red }}>{error}</p>}

      {loading && (
        <section style={{ border: `2.5px solid ${T.ink}`, background: T.card, padding: 16, boxShadow: shadow(2) }}>
          <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ height: 32, width: 32, shrinkFlexShrink: 0, animation: 'spin 1s linear infinite', borderRadius: '50%', border: `2px solid ${T.muted}`, borderTopColor: T.red }} />
                <div>
                  <p style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: T.red }}>Building mutual profile</p>
                  <p style={{ marginTop: 4, fontSize: 14, color: T.muted }}>Scanning both public profiles, finding shared taste signals, then looking for unwatched recommendations.</p>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  style={{ height: 96, width: 64, border: `2.5px solid ${T.ink}`, background: T.amber, animationDelay: `${index * 120}ms`, animation: 'pulse 1.5s ease-in-out infinite' }}
                >
                  <div style={{ height: '100%', width: '100%', animation: 'pulse 1.5s ease-in-out infinite', background: T.red + '20', animationDelay: `${index * 120}ms` }} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div style={{ border: `2.5px solid ${T.ink}`, background: T.card, padding: 16, boxShadow: shadow(2) }}>
              <p style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: T.muted }}>Genres</p>
              <p style={{ marginTop: 8, fontSize: 14, color: T.ink }}>{result.mutual_profile.top_genres.join(', ') || 'Mixed'}</p>
            </div>
            <div style={{ border: `2.5px solid ${T.ink}`, background: T.card, padding: 16, boxShadow: shadow(2) }}>
              <p style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: T.muted }}>Directors</p>
              <p style={{ marginTop: 8, fontSize: 14, color: T.ink }}>{result.mutual_profile.top_directors.join(', ') || 'No shared auteur yet'}</p>
            </div>
            <div style={{ border: `2.5px solid ${T.ink}`, background: T.card, padding: 16, boxShadow: shadow(2) }}>
              <p style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: T.muted }}>Era</p>
              <p style={{ marginTop: 8, fontSize: 14, color: T.ink }}>{result.mutual_profile.era_overlap}</p>
            </div>
          </div>

          {result.recommendations.length === 0 ? (
            <div style={{ border: `2.5px solid ${T.ink}`, background: T.card, padding: 20, boxShadow: shadow(2) }}>
              <p style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: T.muted }}>No mutual picks</p>
              <p style={{ marginTop: 8, fontSize: 14, color: T.muted }}>
                Zero overlap between your watchlists — no films on both lists. But you can still check what's on <em>their</em> watchlist by scrolling down.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {result.recommendations.map((film, index) => {
                const posterUrl = film.poster_path ? getPosterUrl(film.poster_path) : null;
                const extra = film as unknown as Record<string, unknown>;
                const director = extra.director as string | undefined;
                const overview = extra.overview as string | undefined;
                const watchlistAddedAt = extra.watchlist_added_at as string | undefined;
                const slug = (extra.letterboxd_slug as string) || film.slug;
                const letterboxdUrl = slug
                  ? `https://letterboxd.com/film/${slug}/`
                  : `https://letterboxd.com/search/${encodeURIComponent(film.title)}/`;
                const posterKey = `${film.title}-${film.year}`;
                const imgError = erroredPosters.has(posterKey);

                return (
                  <article
                    key={`${film.title}-${film.year}-${index}`}
                    style={{
                      display: 'flex',
                      gap: 16,
                      border: `2.5px solid ${T.ink}`,
                      background: T.card,
                      padding: 16,
                      transition: 'all 150ms',
                      boxShadow: shadow(2),
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = shadow(3);
                      e.currentTarget.style.transform = 'translate(-1px, -1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = shadow(2);
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    <div style={{ position: 'relative', height: 120, width: 80, flexShrink: 0, overflow: 'hidden', background: T.muted, border: `2.5px solid ${T.ink}` }}>
                      {posterUrl && !imgError ? (
                        <img
                          src={posterUrl}
                          alt={`${film.title} poster`}
                          width={80}
                          height={120}
                          loading="lazy"
                          style={{ height: '100%', width: '100%', objectFit: 'cover' }}
                          onError={() => setErroredPosters(prev => new Set(prev).add(posterKey))}
                        />
                      ) : (
                        <div style={{ display: 'flex', height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center', color: T.muted }} aria-hidden="true">
                          <ExternalLink className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 900, color: T.ink, lineHeight: 1.2 }}>{film.title}</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 8px', fontSize: 12, color: T.muted }}>
                        <span>{film.year || '—'}</span>
                        <span>·</span>
                        <span>{director || '—'}</span>
                      </div>
                      <p style={{ fontSize: 12, color: T.muted, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{overview || '—'}</p>
                      <p style={{ fontSize: 12, fontStyle: 'italic', color: T.muted }}>{film.reason}</p>
                      {watchlistAddedAt && (
                        <span style={{ fontSize: 12, color: T.muted }}>added {watchlistAddedAt}</span>
                      )}
                      <a
                        href={letterboxdUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          marginTop: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontFamily: MONO,
                          fontSize: 11,
                          textTransform: 'uppercase',
                          letterSpacing: '0.14em',
                          color: T.darkamber,
                          transition: 'color 150ms',
                          textDecoration: 'none'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = T.amber}
                        onMouseLeave={(e) => e.currentTarget.style.color = T.darkamber}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View on Letterboxd
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
