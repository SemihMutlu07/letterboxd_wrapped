'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Clapperboard, Shuffle, Sparkles, Users, X } from 'lucide-react';

import {
  compareWatchlists,
  recommendFromCompare,
  handleApiError,
  type FilmRecommendation,
  type RecommendationStrategy,
  type WatchlistCompareResult,
  type WatchlistFilm,
} from '@/lib/api';
import { readWatchlistUsersFromLocation, watchlistPath } from '@/lib/routes';
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

const COLLAPSED_FILM_LIMIT = 10;

/* ── Toggle-able loading panel with close button ───────────────────────────── */

function LoadingPanel({
  title,
  message,
  showPosterRail = false,
  onClose,
}: {
  title: string;
  message: string;
  showPosterRail?: boolean;
  onClose?: () => void;
}) {
  return (
    <section style={{ border: `2.5px solid ${T.ink}`, background: T.card, padding: 20, position: 'relative', boxShadow: shadow(2) }}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{ position: 'absolute', right: 12, top: 12, padding: 4, background: 'none', border: 'none', color: T.muted, cursor: 'pointer', transition: 'color 150ms' }}
          onMouseEnter={(e) => e.currentTarget.style.color = T.ink}
          onMouseLeave={(e) => e.currentTarget.style.color = T.muted}
          aria-label="Close loading panel"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'auto 1fr' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ height: 36, width: 36, shrinkFlex: 0, animation: 'spin 1s linear infinite', borderRadius: '50%', border: `2px solid ${T.ink}20`, borderTopColor: T.amber }} />
            <div>
              <p style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: T.lime }}>{title}</p>
              <p style={{ marginTop: 4, fontSize: 14, color: T.muted }}>{message}</p>
            </div>
          </div>
          <div style={{ marginTop: 16, height: 4, overflow: 'hidden', background: T.ink + '20' }}>
            <div style={{ height: '100%', width: '50%', animation: 'pulse 1.5s ease-in-out infinite', background: T.lime }} />
          </div>
        </div>
        {showPosterRail && (
          <div style={{ display: 'flex', gap: 8 }}>
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                style={{ height: 96, width: 64, border: `2.5px solid ${T.ink}`, background: T.card, animationDelay: `${index * 120}ms` }}
              >
                <div style={{ height: '100%', width: '100%', animation: 'pulse 1.5s ease-in-out infinite', background: T.ink + '10' }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function cleanUsername(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase();
}

const USERNAME_RE = /^[a-z0-9_]+$/;

/* ── Shared film-row renderer (used by both open + accordion) ──────────────── */

function FilmRows({ films }: { films: WatchlistFilm[] }) {
  return (
    <>
      {films.map((film) => {
        const slug = film.slug?.replace(/^\/film\/|\/$/g, '');
        const href = slug ? `https://letterboxd.com/film/${slug}/` : null;
        const content = (
          <div className="flex items-center gap-3 py-2">
            <div className="h-[60px] w-10 shrink-0 overflow-hidden bg-stone-900">
              {film.poster_url ? (
                <img
                  src={film.poster_url}
                  alt={`${film.title} poster`}
                  width={40}
                  height={60}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-stone-100">{film.title}</p>
              <p className="font-mono text-[11px] text-stone-500">{film.year}</p>
            </div>
          </div>
        );
        return (
          <li key={`${film.title}-${film.year}-${film.slug}`}>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="block transition-colors duration-150 ease-out hover:bg-stone-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
              >
                {content}
              </a>
            ) : (
              content
            )}
          </li>
        );
      })}
    </>
  );
}

/* ── Always-open list (used for Common / both watchlists) ──────────────────── */

function FilmListOpen({
  title,
  films,
  totalCount,
  truncated,
  emptyMessage,
}: {
  title: string;
  films: WatchlistFilm[];
  totalCount: number;
  truncated?: boolean;
  emptyMessage?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? films : films.slice(0, COLLAPSED_FILM_LIMIT);
  const remaining = films.length - visible.length;

  return (
    <section style={{ border: `2.5px solid ${T.ink}`, background: T.card, padding: 16, boxShadow: shadow(2) }}>
      <h3 style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: T.lime }}>{title}</h3>
      <ul style={{ marginTop: 16, borderTop: `1px solid ${T.ink}20` }}>
        {films.length === 0 && (
          <li style={{ paddingTop: 8, paddingBottom: 8, fontSize: 14, color: T.muted }}>
            {emptyMessage || 'No films in this bucket.'}
          </li>
        )}
        <FilmRows films={visible} />
      </ul>

      {(films.length > COLLAPSED_FILM_LIMIT || (truncated && films.length > 0)) && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {films.length > COLLAPSED_FILM_LIMIT && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                width: '100%',
                border: `2.5px solid ${T.ink}`,
                padding: '8px 12px',
                fontFamily: MONO,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: T.muted,
                background: T.card,
                cursor: 'pointer',
                transition: 'all 90ms',
                boxShadow: shadow(2)
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = T.lime;
                e.currentTarget.style.color = T.ink;
                e.currentTarget.style.boxShadow = shadow(3);
                e.currentTarget.style.transform = 'translate(-1px, -1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = T.card;
                e.currentTarget.style.color = T.muted;
                e.currentTarget.style.boxShadow = shadow(2);
                e.currentTarget.style.transform = 'none';
              }}
            >
              {expanded ? `Hide ${films.length - COLLAPSED_FILM_LIMIT}` : `Show ${remaining} more`}
            </button>
          )}
          {truncated && (
            <p style={{ fontFamily: MONO, fontSize: 11, color: T.muted }}>
              Showing {films.length} of {totalCount}. Backend caps each bucket at {films.length}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Accordion list (used for individual watchlists) ───────────────────────── */

function WatchlistAccordion({
  user,
  count,
  films,
}: {
  user: string;
  count: number;
  films: WatchlistFilm[];
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? films : films.slice(0, COLLAPSED_FILM_LIMIT);
  const remaining = films.length - visible.length;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: `2.5px solid ${T.ink}`,
          background: T.card,
          padding: '12px 16px',
          textAlign: 'left',
          transition: 'all 90ms',
          cursor: 'pointer',
          boxShadow: shadow(2)
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = T.lime;
          e.currentTarget.style.boxShadow = shadow(3);
          e.currentTarget.style.transform = 'translate(-1px, -1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = T.card;
          e.currentTarget.style.boxShadow = shadow(2);
          e.currentTarget.style.transform = 'none';
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.muted }}>
          Only @{user} <span style={{ marginLeft: 4, color: T.amber }}>({count})</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" style={{ color: T.muted }} />
      </button>
    );
  }

  return (
    <section style={{ border: `2.5px solid ${T.ink}`, background: T.card, padding: 16, boxShadow: shadow(2) }}>
      <button
        type="button"
        onClick={() => setOpen(false)}
        style={{ marginBottom: 12, display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <h3 style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: T.lime }}>
          Only @{user} <span style={{ color: T.muted }}>({count})</span>
        </h3>
        <ChevronUp className="h-4 w-4 shrink-0" style={{ color: T.muted }} />
      </button>

      <ul style={{ borderTop: `1px solid ${T.ink}20` }}>
        <FilmRows films={visible} />
      </ul>

      {films.length > COLLAPSED_FILM_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 12,
            width: '100%',
            border: `2.5px solid ${T.ink}`,
            padding: '8px 12px',
            fontFamily: MONO,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: T.muted,
            background: T.card,
            cursor: 'pointer',
            transition: 'all 90ms',
            boxShadow: shadow(2)
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = T.lime;
            e.currentTarget.style.color = T.ink;
            e.currentTarget.style.boxShadow = shadow(3);
            e.currentTarget.style.transform = 'translate(-1px, -1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = T.card;
            e.currentTarget.style.color = T.muted;
            e.currentTarget.style.boxShadow = shadow(2);
            e.currentTarget.style.transform = 'none';
          }}
        >
          {expanded ? `Hide ${films.length - COLLAPSED_FILM_LIMIT}` : `Show ${remaining} more`}
        </button>
      )}
    </section>
  );
}

/* ── Recommendation strip ──────────────────────────────────────────────────── */

function RecommendationStrip({ recommendation }: { recommendation: FilmRecommendation }) {
  return (
    <div style={{ border: `2.5px solid ${T.amber}`, background: T.amber, padding: 16, color: T.ink, boxShadow: shadow(2) }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <p style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700 }}>Tonight's pick</p>
          <p style={{ marginTop: 4, fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{recommendation.title}</p>
          <p style={{ marginTop: 4, fontFamily: MONO, fontSize: 12, color: T.muted }}>{recommendation.year}</p>
        </div>
        <Sparkles className="h-6 w-6 shrink-0" />
      </div>
      <p style={{ marginTop: 12, fontSize: 14, fontWeight: 500, color: T.ink }}>{recommendation.reason}</p>
    </div>
  );
}

/* ── Main exported component ───────────────────────────────────────────────── */

export default function WatchlistCompare() {
  const placeholders = useMemo(() => pickRandomUsernames(2), []);
  const [first, setFirst] = useState(() => {
    const [routeFirst] = readWatchlistUsersFromLocation();
    if (routeFirst) return routeFirst;
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem('wc_first') || '';
  });
  const [second, setSecond] = useState(() => {
    const [, routeSecond] = readWatchlistUsersFromLocation();
    if (routeSecond) return routeSecond;
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem('wc_second') || '';
  });
  const [strategy, setStrategy] = useState<RecommendationStrategy>('random');
  const [result, setResult] = useState<WatchlistCompareResult | null>(null);
  const [recommendation, setRecommendation] = useState<FilmRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissLoading, setDismissLoading] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoComparedRef = useRef(false);

  const normalized = useMemo(() => [cleanUsername(first), cleanUsername(second)] as const, [first, second]);
  const validationMessage = useMemo(() => {
    const filled = normalized.filter(Boolean);
    if (filled.some((username) => !USERNAME_RE.test(username))) {
      return 'Use only lowercase letters, numbers, or underscores for Letterboxd usernames.';
    }
    if (normalized[0] && normalized[1] && normalized[0] === normalized[1]) {
      return 'Enter two different Letterboxd usernames.';
    }
    return null;
  }, [normalized]);
  const canSubmit = normalized[0].length > 0 && normalized[1].length > 0 && !validationMessage;

  // Persist inputs so users don't re-type after error / refresh
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('wc_first', first);
    }
  }, [first]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('wc_second', second);
    }
  }, [second]);

  const handleCompare = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setDismissLoading(false);
    setError(null);
    try {
      const next = await compareWatchlists(normalized[0], normalized[1]);
      setResult(next);
      setRecommendation(null);
      const nextPath = watchlistPath(normalized[0], normalized[1]);
      if (typeof window !== 'undefined' && `${window.location.pathname}${window.location.search}` !== nextPath) {
        window.history.pushState(null, '', nextPath);
      }
    } catch (err) {
      setError(handleApiError(err, 'watchlist comparison').message);
    } finally {
      setLoading(false);
    }
  }, [canSubmit, normalized]);

  useEffect(() => {
    const [routeFirst, routeSecond] = readWatchlistUsersFromLocation();
    if (!routeFirst || !routeSecond || autoComparedRef.current) return;
    autoComparedRef.current = true;
    void handleCompare();
  }, [handleCompare]);

  const handleRecommend = async () => {
    if (!canSubmit) return;
    setRecommending(true);
    setError(null);
    try {
      const next = await recommendFromCompare(normalized[0], normalized[1], strategy);
      setRecommendation(next.recommendation);
    } catch (err) {
      setError(handleApiError(err, 'recommendation').message);
    } finally {
      setRecommending(false);
    }
  };

  const counts = result?.counts;
  const barTotal = counts ? Math.max(counts.first_only + counts.common + counts.second_only, 1) : 1;
  const formatPct = (n: number) => `${Math.round((n / barTotal) * 100)}%`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <section style={{ border: `2.5px solid ${T.ink}`, background: T.card, padding: 20, boxShadow: shadow(2) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', height: 40, width: 40, alignItems: 'center', justifyContent: 'center', background: T.lime, boxShadow: shadow(2) }}>
            <Users className="h-5 w-5" style={{ color: T.ink }} />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: T.ink }}>Watchlist Compare</h2>
            <p style={{ fontSize: 14, color: T.muted, marginTop: 4 }}>Find overlap, split the misses, then pick a film from the shared shelf.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(150px, 250px) minmax(150px, 250px) auto', alignItems: 'end' }}>
          <label style={{ display: 'block' }}>
            <span style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: T.muted }}>First watchlist</span>
            <input
              value={first}
              onChange={(event) => setFirst(event.target.value)}
              placeholder={placeholders[0]}
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
                e.currentTarget.style.borderColor = T.lime;
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = shadow(2);
                e.currentTarget.style.borderColor = T.ink;
              }}
            />
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: T.muted }}>Second watchlist</span>
            <input
              value={second}
              onChange={(event) => setSecond(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleCompare();
              }}
              placeholder={placeholders[1]}
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
                e.currentTarget.style.borderColor = T.lime;
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
              void handleCompare();
            }}
            style={{
              display: 'inline-flex',
              height: 46,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: T.lime,
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
                e.currentTarget.style.background = T.amber;
                e.currentTarget.style.boxShadow = shadow(3);
                e.currentTarget.style.transform = 'translate(-1px, -1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = T.lime;
                e.currentTarget.style.boxShadow = shadow(2);
                e.currentTarget.style.transform = 'none';
              }
            }}
          >
            <Clapperboard className="h-4 w-4" />
            {loading ? 'Reading' : 'Compare'}
          </button>
        </div>
        {validationMessage && <p style={{ marginTop: 16, border: `2.5px solid ${T.red}`, background: T.red + '20', padding: '12px 16px', fontSize: 14, color: T.red }}>{validationMessage}</p>}
        {error && (
          <div style={{ marginTop: 16, border: `2.5px solid ${T.red}`, background: T.red + '20', padding: '12px 16px' }}>
            <p style={{ fontSize: 14, color: T.red }}>{error}</p>
            <button
              type="button"
              onClick={() => void handleCompare()}
              style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: T.red, background: 'none', border: 'none', cursor: 'pointer', transition: 'color 150ms' }}
              onMouseEnter={(e) => e.currentTarget.style.color = T.darkamber}
              onMouseLeave={(e) => e.currentTarget.style.color = T.red}
            >
              <Clapperboard className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        )}
      </section>

      {loading && !dismissLoading && (
        <LoadingPanel
          title="Comparing watchlists"
          message="Reading both public watchlists and sorting the shared shelf from the one-sided picks."
          onClose={() => setDismissLoading(true)}
        />
      )}

      {result && (
        <>
          {/* Match score header */}
          <section style={{ border: `2.5px solid ${T.ink}`, background: T.card, padding: 20, textAlign: 'center', boxShadow: shadow(2) }}>
            <p style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: T.amber }}>Match score</p>
            <p style={{ marginTop: 8, fontSize: 72, fontWeight: 900, lineHeight: 1, color: T.ink }}>{result.match_score}%</p>
            <p style={{ marginTop: 8, fontSize: 14, color: T.muted }}>
              <span style={{ fontWeight: 600, color: T.darkamber }}>@{result.users[0]}</span>
              <span style={{ margin: '0 6px', color: T.muted }}>vs</span>
              <span style={{ fontWeight: 600, color: T.darkblue }}>@{result.users[1]}</span>
            </p>
          </section>

          {/* Responsive summary cards */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div style={{ border: `2.5px solid ${T.ink}`, background: T.card, padding: '12px 16px', textAlign: 'center', boxShadow: shadow(2) }}>
              <p style={{ fontFamily: MONO, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.darkamber, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Only @{result.users[0]}
              </p>
              <p style={{ marginTop: 4, fontSize: 24, fontWeight: 900, lineHeight: 1, color: T.ink }}>{counts?.first_only ?? 0}</p>
            </div>
            <div style={{ border: `2.5px solid ${T.ink}`, background: T.card, padding: '12px 16px', textAlign: 'center', boxShadow: shadow(2) }}>
              <p style={{ fontFamily: MONO, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.lime }}>
                Both
              </p>
              <p style={{ marginTop: 4, fontSize: 24, fontWeight: 900, lineHeight: 1, color: T.ink }}>{counts?.common ?? 0}</p>
            </div>
            <div style={{ border: `2.5px solid ${T.ink}`, background: T.card, padding: '12px 16px', textAlign: 'center', boxShadow: shadow(2) }}>
              <p style={{ fontFamily: MONO, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.darkblue, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Only @{result.users[1]}
              </p>
              <p style={{ marginTop: 4, fontSize: 24, fontWeight: 900, lineHeight: 1, color: T.ink }}>{counts?.second_only ?? 0}</p>
            </div>
          </section>

          {/* Proportional bar */}
          <section style={{ border: `2.5px solid ${T.ink}`, background: T.card, padding: 20, boxShadow: shadow(2) }}>
            <div style={{ display: 'flex', width: '100%', gap: 2 }}>
              {counts && (
                <>
                  <div
                    style={{
                      flex: counts.first_only || 1,
                      position: 'relative',
                      height: 48,
                      background: T.darkamber,
                      border: `2.5px solid ${T.ink}`
                    }}
                    title={`Only @${result.users[0]}: ${counts.first_only} (${formatPct(counts.first_only)})`}
                    onMouseEnter={(e) => {
                      const span = e.currentTarget.querySelector('span');
                      if (span) {
                        span.style.opacity = '1';
                        e.currentTarget.style.boxShadow = shadow(3);
                      }
                    }}
                    onMouseLeave={(e) => {
                      const span = e.currentTarget.querySelector('span');
                      if (span) {
                        span.style.opacity = '0';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <span style={{ pointerEvents: 'none', position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', fontSize: 11, fontWeight: 700, color: T.paper, opacity: 0, transition: 'opacity 150ms' }}>
                      {formatPct(counts.first_only)}
                    </span>
                  </div>
                  <div
                    style={{
                      flex: counts.common || 1,
                      position: 'relative',
                      height: 48,
                      background: T.amber,
                      border: `2.5px solid ${T.ink}`
                    }}
                    title={`Both: ${counts.common} (${formatPct(counts.common)})`}
                    onMouseEnter={(e) => {
                      const span = e.currentTarget.querySelector('span');
                      if (span) {
                        span.style.opacity = '1';
                        e.currentTarget.style.boxShadow = shadow(3);
                      }
                    }}
                    onMouseLeave={(e) => {
                      const span = e.currentTarget.querySelector('span');
                      if (span) {
                        span.style.opacity = '0';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <span style={{ pointerEvents: 'none', position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', fontSize: 11, fontWeight: 700, color: T.ink, opacity: 0, transition: 'opacity 150ms' }}>
                      {formatPct(counts.common)}
                    </span>
                  </div>
                  <div
                    style={{
                      flex: counts.second_only || 1,
                      position: 'relative',
                      height: 48,
                      background: T.darkblue,
                      border: `2.5px solid ${T.ink}`
                    }}
                    title={`Only @${result.users[1]}: ${counts.second_only} (${formatPct(counts.second_only)})`}
                    onMouseEnter={(e) => {
                      const span = e.currentTarget.querySelector('span');
                      if (span) {
                        span.style.opacity = '1';
                        e.currentTarget.style.boxShadow = shadow(3);
                      }
                    }}
                    onMouseLeave={(e) => {
                      const span = e.currentTarget.querySelector('span');
                      if (span) {
                        span.style.opacity = '0';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <span style={{ pointerEvents: 'none', position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', fontSize: 11, fontWeight: 700, color: T.paper, opacity: 0, transition: 'opacity 150ms' }}>
                      {formatPct(counts.second_only)}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              <span style={{ textAlign: 'center', color: T.darkamber }}>Only @{result.users[0]}: {counts?.first_only}</span>
              <span style={{ textAlign: 'center', color: T.amber }}>Both: {counts?.common}</span>
              <span style={{ textAlign: 'center', color: T.darkblue }}>Only @{result.users[1]}: {counts?.second_only}</span>
            </div>
          </section>

          {/* Common shelf — always visible */}
          <FilmListOpen
            title="Shared shelf"
            films={result.common}
            totalCount={result.counts.common}
            emptyMessage="Zero shared films in both watchlists."
          />

          {/* Individual watchlists — collapsed by default */}
          <div className="grid grid-cols-1 gap-3">
            <WatchlistAccordion
              user={result.users[0]}
              count={result.counts.first_only}
              films={result.first_only}
            />
            <WatchlistAccordion
              user={result.users[1]}
              count={result.counts.second_only}
              films={result.second_only}
            />
          </div>

          {result.counts.common === 0 && (
            <section style={{ border: `2.5px solid ${T.ink}`, background: T.card, padding: 20, boxShadow: shadow(2) }}>
              <p style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: T.muted }}>No overlap yet</p>
              <p style={{ marginTop: 8, fontSize: 14, color: T.muted }}>
                Zero shared films. Expand individual watchlists above to see what each person wants to watch.
              </p>
            </section>
          )}

          <section style={{ display: 'grid', gap: 16, border: `2.5px solid ${T.ink}`, background: T.card, padding: 20, boxShadow: shadow(2), gridTemplateColumns: result.counts.common === 0 ? undefined : '1fr auto' }}>
            <div>
              <p style={{ fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: T.muted }}>What should we watch?</p>
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(['random', 'highest_rated', 'newest'] as RecommendationStrategy[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStrategy(item)}
                    style={{
                      border: `2.5px solid ${strategy === item ? T.ink : T.ink}`,
                      background: strategy === item ? T.amber : T.card,
                      color: strategy === item ? T.ink : T.muted,
                      paddingLeft: 12,
                      paddingRight: 12,
                      paddingTop: 8,
                      paddingBottom: 8,
                      fontFamily: MONO,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      cursor: 'pointer',
                      transition: 'all 90ms',
                      boxShadow: shadow(2)
                    }}
                    onMouseEnter={(e) => {
                      if (strategy !== item) {
                        e.currentTarget.style.background = T.lime;
                        e.currentTarget.style.color = T.ink;
                        e.currentTarget.style.boxShadow = shadow(3);
                        e.currentTarget.style.transform = 'translate(-1px, -1px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (strategy !== item) {
                        e.currentTarget.style.background = T.card;
                        e.currentTarget.style.color = T.muted;
                        e.currentTarget.style.boxShadow = shadow(2);
                        e.currentTarget.style.transform = 'none';
                      }
                    }}
                  >
                    {item.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleRecommend()}
              disabled={recommending || result.counts.common === 0}
              style={{
                display: 'inline-flex',
                height: 46,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: recommending || result.counts.common === 0 ? T.muted : T.lime,
                paddingLeft: 20,
                paddingRight: 20,
                fontFamily: MONO,
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: T.ink,
                cursor: recommending || result.counts.common === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 90ms',
                border: `2.5px solid ${T.ink}`,
                boxShadow: shadow(2)
              }}
              onMouseEnter={(e) => {
                if (!recommending && result.counts.common > 0) {
                  e.currentTarget.style.background = T.amber;
                  e.currentTarget.style.boxShadow = shadow(3);
                  e.currentTarget.style.transform = 'translate(-1px, -1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!recommending && result.counts.common > 0) {
                  e.currentTarget.style.background = T.lime;
                  e.currentTarget.style.boxShadow = shadow(2);
                  e.currentTarget.style.transform = 'none';
                }
              }}
            >
              <Shuffle className="h-4 w-4" />
              {recommending ? 'Choosing' : 'Pick one'}
            </button>
          </section>

          {recommendation && <RecommendationStrip recommendation={recommendation} />}
        </>
      )}

      {recommending && (
        <LoadingPanel
          title="Choosing from the overlap"
          message="Enriching shared watchlist films with TMDB data before picking one."
          showPosterRail
          onClose={() => {/* recommending state is handled by the async call, can't be dismissed mid-flight */}}
        />
      )}
    </div>
  );
}
