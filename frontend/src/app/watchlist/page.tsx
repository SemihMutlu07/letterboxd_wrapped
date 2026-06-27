'use client';

import Link from 'next/link';
import DateNight from '@/components/watchlist/DateNight';
import WatchlistCompare from '@/components/watchlist/WatchlistCompare';

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

export default function WatchlistPage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: T.paper,
      backgroundImage: `
        linear-gradient(0deg, transparent 24%, ${T.lines} 25%, ${T.lines} 26%, transparent 27%, transparent 74%, ${T.lines} 75%, ${T.lines} 76%, transparent 77%, transparent),
        linear-gradient(90deg, transparent 24%, ${T.lines} 25%, ${T.lines} 26%, transparent 27%, transparent 74%, ${T.lines} 75%, ${T.lines} 76%, transparent 77%, transparent)
      `,
      backgroundSize: '50px 50px',
      color: T.ink,
      fontFamily: SERIF,
      paddingBottom: 40
    }}>
      <div style={{ marginLeft: 'auto', marginRight: 'auto', maxWidth: '64rem', paddingLeft: 20, paddingRight: 20, paddingTop: 40, paddingBottom: 40 }}>
        <header style={{ marginBottom: 32, borderBottom: `2.5px solid ${T.ink}`, paddingBottom: 32 }}>
          <p style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.lime, marginBottom: 8 }}>Watchlist lab</p>
          <h1 style={{ marginTop: 12, maxWidth: '48rem', fontSize: 48, fontFamily: SERIF, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em', color: T.ink, marginBottom: 16 }}>
            Compare two watchlists like a double feature program.
          </h1>
          <p style={{ marginTop: 16, maxWidth: '42rem', fontSize: 12, lineHeight: 1.6, color: T.muted, fontFamily: MONO, fontWeight: 700, letterSpacing: '0.05em' }}>
            Find overlap, split the misses, then pick a film from the shared shelf.
          </p>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <WatchlistCompare />
          <DateNight />
        </div>

        <div style={{ marginTop: 48, display: 'flex', justifyContent: 'center', borderTop: `2.5px solid ${T.ink}`, paddingTop: 32 }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2.5px solid ${T.ink}`,
              background: T.purple,
              paddingLeft: 14,
              paddingRight: 14,
              paddingTop: 10,
              paddingBottom: 10,
              fontFamily: MONO,
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: T.ink,
              transition: 'all 90ms',
              textDecoration: 'none',
              boxShadow: shadow(2),
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              const link = e.currentTarget;
              link.style.background = T.red;
              link.style.boxShadow = shadow(3);
              link.style.transform = 'translate(-1px, -1px)';
            }}
            onMouseLeave={(e) => {
              const link = e.currentTarget;
              link.style.background = T.purple;
              link.style.boxShadow = shadow(2);
              link.style.transform = 'none';
            }}
          >
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
