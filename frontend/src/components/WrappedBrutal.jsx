"use client";

import React, { useState, useEffect } from "react";

/* =================================================================
   WRAPPED — neo-brutalist rebuild (WRAPMINAL visual language)
   Paper + grid · thick black borders · hard offset shadows ·
   sharp corners · heavy serif display · mono uppercase labels ·
   saturated color blocks.

   New interactions:
   · info (i) tooltips on Film History + Rating Patterns
   · click a language row -> expand popup with the films in it
   · click a review word -> filter the review list + UI shifts
   ================================================================= */

const T = {
  paper: "#F1ECDE",
  card: "#FBF8EF",
  ink: "#100F0C",
  lime: "#AEE63E",
  amber: "#F2B33D",
  cyan: "#53CFE6",
  purple: "#A98BEA",
  red: "#E8463A",
  muted: "#6F6E63",
};
const SERIF = 'Georgia, "Times New Roman", serif';
const MONO = 'ui-monospace, "Cascadia Code", "Courier New", monospace';
const shadow = (n) => `${n}px ${n}px 0 ${T.ink}`;

// Color palette for cycling through items
const COLORS = [T.lime, T.amber, T.cyan, T.purple, T.red];
const getColor = (index) => COLORS[index % COLORS.length];

/* ---------- atoms ---------- */
const Box = ({ bg = T.card, sh = 5, style, children, ...p }) => (
  <div {...p} style={{ background: bg, border: `2.5px solid ${T.ink}`, boxShadow: shadow(sh), ...style }}>{children}</div>
);

const Label = ({ children, color = T.muted, style }) => (
  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color, fontWeight: 700, ...style }}>{children}</div>
);

function Eyebrow({ children, note, info }) {
  return (
    <div className="flex items-center justify-between" style={{ marginBottom: 12, paddingBottom: 8, borderBottom: `1.5px solid ${T.ink}` }}>
      <div className="flex items-center" style={{ gap: 8 }}>
        <Label color={T.ink} style={{ fontSize: 11.5 }}>{children}</Label>
        {info && <InfoDot text={info} />}
      </div>
      {note && <Label style={{ fontSize: 10 }}>{note}</Label>}
    </div>
  );
}

function InfoDot({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative" style={{ display: "inline-flex" }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span style={{
        width: 16, height: 16, border: `2px solid ${T.ink}`, background: open ? T.lime : T.card,
        fontFamily: SERIF, fontSize: 11, fontWeight: 700, fontStyle: "italic", display: "flex",
        alignItems: "center", justifyContent: "center", cursor: "help", lineHeight: 1, color: T.ink,
      }}>i</span>
      {open && (
        <span style={{
          position: "absolute", top: 22, left: -6, width: 230, zIndex: 50, background: T.ink, color: T.card,
          border: `2px solid ${T.ink}`, boxShadow: shadow(4), padding: "9px 11px", fontFamily: MONO,
          fontSize: 10.5, lineHeight: 1.6, textTransform: "none", letterSpacing: 0, fontWeight: 400,
        }}>{text}</span>
      )}
    </span>
  );
}

function Btn({ children, active, onClick, color = T.lime }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
        padding: "6px 11px", border: `2px solid ${T.ink}`, background: active ? color : (h ? T.paper : T.card),
        color: T.ink, cursor: "pointer", boxShadow: h && !active ? shadow(3) : shadow(2),
        transform: h && !active ? "translate(-1px,-1px)" : "none", transition: "all 90ms",
      }}>{children}</button>
  );
}

/* ---------- nav ---------- */
function Nav({ revealed, setRevealed }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: "18px 0 22px" }}>
      <div className="flex items-center" style={{ gap: 10 }}>
        <div style={{ width: 26, height: 26, background: T.lime, border: `2.5px solid ${T.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontWeight: 700, fontSize: 12 }}>LB</div>
        <span style={{ fontFamily: MONO, fontWeight: 700, letterSpacing: "0.14em", fontSize: 13, color: T.ink }}>LETTERBOXD WRAPPED</span>
      </div>
      <div className="flex" style={{ gap: 8 }}>
        <Btn active={revealed} color={T.cyan} onClick={() => setRevealed((v) => !v)}>{revealed ? "Hide" : "Reveal"}</Btn>
        <Btn>Sample</Btn>
        <Btn>Export SVG</Btn>
      </div>
    </div>
  );
}

/* ---------- hero ---------- */
function Hero({ stats }) {
  const totalFilms = stats?.total_films ?? 0;
  const avgRating = (stats?.average_rating ?? 0).toFixed(1);
  const daysWatched = stats?.days_watched ?? 0;
  const langCount = stats?.top_languages?.length ?? 0;

  const heroStats = [
    [String(totalFilms), "Films", T.lime],
    [`${avgRating}★`, "Avg rating", T.amber],
    [String(daysWatched), "Days", T.cyan],
    [String(langCount), "Languages", T.cyan]
  ];

  return (
    <div className="grid" style={{ gridTemplateColumns: "1.25fr 1fr", gap: 14, marginBottom: 28 }}>
      <Box style={{ padding: "22px 26px 26px" }}>
        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 62, lineHeight: 0.92, letterSpacing: "-0.02em", color: T.ink }}>
          Film<br />Wrapped
        </div>
        <p style={{ fontFamily: MONO, fontSize: 11, color: T.muted, marginTop: 16, lineHeight: 1.6 }}>
          {totalFilms} films total. Raw history stays local and is never rendered.
        </p>
      </Box>
      <div className="grid grid-cols-2" style={{ gap: 14 }}>
        {heroStats.map(([v, l, c]) => (
          <Box key={l} bg={c} style={{ padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 38, color: T.ink, lineHeight: 1 }}>{v}</div>
            <Label color={T.ink} style={{ fontSize: 9.5, marginTop: 18 }}>{l}</Label>
          </Box>
        ))}
      </div>
    </div>
  );
}


/* ---------- wrapped cards hover info ---------- */
function CardHoverInfo({ cardType, data, stats }) {
  let films = [];
  let title = "";

  if (cardType === "director" && data) {
    title = `Films by ${data.name}`;
    films = (stats?.all_films || [])
      .filter(f => f.director && f.director.toLowerCase() === data.name.toLowerCase() && f.rating !== null)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 8);
  } else if (cardType === "decade" && data) {
    const startYear = parseInt(data.decade);
    const endYear = startYear + 9;
    title = `Films from ${data.decade}s`;
    films = (stats?.all_films || [])
      .filter(f => {
        const year = parseInt(f.year);
        return !isNaN(year) && year >= startYear && year <= endYear && f.rating !== null;
      })
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 8);
  } else if (cardType === "genre" && data) {
    title = `${data.name} films`;
    films = (stats?.all_films || [])
      .filter(f => f.genres && f.genres.includes(data.name) && f.rating !== null)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 8);
  } else if (cardType === "actor" && data) {
    title = `Films with ${data.name}`;
    films = (stats?.all_films || [])
      .filter(f => f.cast && f.cast.includes(data.name) && f.rating !== null)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 8);
  } else if (cardType === "reviews") {
    title = "Your reviews";
    films = (stats?.review_analysis?.reviews || []).slice(0, 8);
  }

  if (films.length === 0) return null;

  return (
    <Box sh={6} style={{ position: "absolute", top: 0, right: "calc(100% + 12px)", width: 280, maxHeight: 360, padding: 14, zIndex: 50, overflowY: "auto" }}>
      <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 14, color: T.ink, marginBottom: 12 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {films.map((f, i) => (
          <div key={i} style={{ padding: "8px 10px", border: `1px solid ${T.ink}22`, background: T.paper }}>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 12, color: T.ink, lineHeight: 1.2 }}>{f.title || "—"}</div>
            {cardType === "reviews" ? (
              <div style={{ fontFamily: MONO, fontSize: 9, color: T.muted, marginTop: 4, lineHeight: 1.4 }}>{f.text?.slice(0, 60)}...</div>
            ) : (
              <div style={{ fontFamily: MONO, fontSize: 9, color: T.muted, marginTop: 2 }}>
                {f.year || "—"} · ★ {(f.rating ?? 0).toFixed(1)}
              </div>
            )}
          </div>
        ))}
      </div>
      {films.length > 8 && (
        <div style={{ fontFamily: MONO, fontSize: 9, color: T.muted, marginTop: 10 }}>+ more in your diary</div>
      )}
    </Box>
  );
}

function DirectorProfileModal({ director, onClose }) {
  const [closeHover, setCloseHover] = useState(false);
  const profileUrl = director?.profile_path ? `https://image.tmdb.org/t/p/h632${director.profile_path}` : null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(16,15,12,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}>
      <Box onClick={(e) => e.stopPropagation()} sh={8} style={{ maxWidth: 320, width: "100%", padding: 0, overflow: "hidden" }}>
        {profileUrl && (
          <img src={profileUrl} alt={director.name} style={{ width: "100%", aspectRatio: "9/12", objectFit: "cover", borderBottom: `2.5px solid ${T.ink}` }} onError={(e) => e.target.style.display = "none"} />
        )}
        <div style={{ padding: "20px 22px 24px", background: T.card }}>
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 28, color: T.ink, marginBottom: 12, lineHeight: 1.2 }}>{director.name || "—"}</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: T.muted, marginBottom: 20 }}>
            {director.count} film{director.count !== 1 ? "s" : ""} · {director.avg_rating ? `★ ${(director.avg_rating ?? 0).toFixed(1)} avg` : ""}
          </div>
          <button
            onClick={onClose}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            style={{
              width: "100%",
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "8px 11px",
              border: `2px solid ${T.ink}`,
              background: closeHover ? T.amber : T.lime,
              color: T.ink,
              cursor: "pointer",
              boxShadow: closeHover ? shadow(3) : shadow(2),
              transform: closeHover ? "translate(-1px,-1px)" : "none",
              transition: "all 90ms",
            }}
          >
            Close
          </button>
        </div>
      </Box>
    </div>
  );
}

function CardModal({ cardInfo, onClose, stats }) {
  if (!cardInfo) return null;

  const [cardType, data, title, value] = cardInfo;
  const [closeHover, setCloseHover] = useState(false);
  let films = [];

  if (cardType === "director" && data) {
    films = (stats?.all_films || [])
      .filter(f => f.director && f.director.toLowerCase() === data.name.toLowerCase() && f.rating !== null)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else if (cardType === "decade" && data) {
    const startYear = parseInt(data.decade);
    const endYear = startYear + 9;
    films = (stats?.all_films || [])
      .filter(f => {
        const year = parseInt(f.year);
        return !isNaN(year) && year >= startYear && year <= endYear && f.rating !== null;
      })
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else if (cardType === "genre" && data) {
    films = (stats?.all_films || [])
      .filter(f => f.genres && f.genres.includes(data.name) && f.rating !== null)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else if (cardType === "actor" && data) {
    films = (stats?.all_films || [])
      .filter(f => f.cast && f.cast.includes(data.name) && f.rating !== null)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else if (cardType === "reviews") {
    films = (stats?.review_analysis?.reviews || []);
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(16,15,12,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}>
      <Box onClick={(e) => e.stopPropagation()} sh={8} style={{ maxWidth: 900, width: "100%", maxHeight: "90vh", padding: 26, overflowY: "auto", position: "relative" }}>
        <button
          onClick={onClose}
          onMouseEnter={() => setCloseHover(true)}
          onMouseLeave={() => setCloseHover(false)}
          style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, border: `2.5px solid ${T.ink}`, background: closeHover ? T.red : T.lime, fontFamily: SERIF, fontSize: 20, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1, transform: closeHover ? "scale(1.15) translate(-2px,-2px)" : "scale(1)", transition: "all 120ms", boxShadow: closeHover ? shadow(5) : shadow(2) }}>×</button>
        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 28, color: T.ink, marginBottom: 8 }}>{title}</div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: T.muted, marginBottom: 20 }}>{films.length} items</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {films.slice(0, 60).map((f, i) => {
            const [posterHover, setPosterHover] = useState(false);
            return (
            <div key={i} style={{ display: "flex", flexDirection: "column" }}>
              {f.poster_path ? (
                <div
                  onMouseEnter={() => setPosterHover(true)}
                  onMouseLeave={() => setPosterHover(false)}
                  style={{ position: "relative", marginBottom: 10, aspectRatio: "2/3", background: getColor(i), border: `2.5px solid ${T.ink}`, overflow: "hidden", cursor: "pointer" }}>
                  <img src={`https://image.tmdb.org/t/p/w342${f.poster_path}`} alt={f.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => e.target.style.display = "none"} />
                  <div style={{ position: "absolute", top: 8, right: 8, background: T.lime, border: `2px solid ${T.ink}`, fontFamily: MONO, fontWeight: 700, fontSize: 13, padding: "4px 8px", color: T.ink, opacity: posterHover ? 1 : 0, transform: posterHover ? "scale(1)" : "scale(0.8)", transition: "all 120ms", transformOrigin: "top right" }}>
                    ★ {(f.rating ?? 0).toFixed(1)}
                  </div>
                </div>
              ) : (
                <div
                  onMouseEnter={() => setPosterHover(true)}
                  onMouseLeave={() => setPosterHover(false)}
                  style={{ position: "relative", marginBottom: 10, aspectRatio: "2/3" }}>
                  <Box bg={getColor(i)} sh={3} style={{ height: "100%", display: "flex", alignItems: "flex-end", padding: 12, position: "relative" }}>
                    <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 14, color: T.ink, lineHeight: 1.2 }}>{f.title || "—"}</div>
                  </Box>
                  <div style={{ position: "absolute", top: 8, right: 8, background: T.lime, border: `2px solid ${T.ink}`, fontFamily: MONO, fontWeight: 700, fontSize: 13, padding: "4px 8px", color: T.ink, opacity: posterHover ? 1 : 0, transform: posterHover ? "scale(1)" : "scale(0.8)", transition: "all 120ms", transformOrigin: "top right", zIndex: 10 }}>
                    ★ {(f.rating ?? 0).toFixed(1)}
                  </div>
                </div>
              )}
              <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 12, color: T.ink, lineHeight: 1.3, marginBottom: 4 }}>{f.title || "—"}</div>
              <div style={{ fontFamily: MONO, fontSize: 9.5, color: T.muted }}>
                {f.year || "—"} {f.director && `· ${f.director}`}
              </div>
            </div>
            );
          })}
        </div>
        {films.length > 60 && <div style={{ fontFamily: MONO, fontSize: 10, color: T.muted, marginTop: 16 }}>+ {films.length - 60} more</div>}
      </Box>
    </div>
  );
}

function WrappedCards({ stats }) {
  const topDirector = stats?.top_directors?.[0];
  const topGenre = stats?.top_genres?.[0];
  const topActor = stats?.top_actors?.[0];
  const decades = stats?.decades || [];
  const peakDecade = decades.length > 0 ? decades.reduce((a, b) => (a.count > b.count) ? a : b) : null;
  const avgRuntime = stats?.average_runtime ? Math.round(stats.average_runtime) : 0;
  const reviewCount = stats?.review_analysis?.total_reviews || 0;

  const cards = [
    ["TOP DIRECTOR", topDirector?.name || "—", topDirector ? `${topDirector.count} films · ${(topDirector.avg_rating ?? 0).toFixed(1)} avg` : "—", T.lime, "director", topDirector],
    ["TOP GENRE", topGenre?.name || "—", topGenre ? `${topGenre.count} of ${stats.total_films} films` : "—", T.cyan, "genre", topGenre],
    ["PEAK DECADE", peakDecade?.decade || "—", peakDecade ? `${peakDecade.count} films from these years` : "—", T.amber, "decade", peakDecade],
    ["TOP ACTOR", topActor?.name || "—", topActor ? `★ ${(topActor.avg_rating ?? 0).toFixed(1)} across ${topActor.count} films` : "—", T.purple, "actor", topActor],
    ["AVG RUNTIME", `${avgRuntime} min`, "feature-length comfort zone", T.lime, null, null],
    ["REVIEWS", `${reviewCount} written`, "see breakdown below", T.cyan, "reviews", null],
  ];
  const [h, setH] = useState(null);
  const [sel, setSel] = useState(null);
  const [directorProfile, setDirectorProfile] = useState(null);

  return (
    <section style={{ marginBottom: 28 }}>
      <Eyebrow note="estimated from local diary" info="Your headline stats for the period — top director, genre, decade, actor, runtime and review tally — each pulled from your local diary.">wrapped cards</Eyebrow>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {cards.map(([l, v, c, col, cardType, data], i) => {
          const isActive = sel && sel[0] === cardType && sel[1] === data;
          const handleCardClick = () => {
            if (!cardType) return;
            if (cardType === "director") {
              setDirectorProfile(data);
            } else {
              setSel([cardType, data, l, v]);
            }
          };
          return (
          <div key={l} className="relative" onMouseEnter={() => setH(i)} onMouseLeave={() => setH(null)} style={{ display: "flex", zIndex: h === i ? 10 : 1, position: "relative" }}>
            <Box bg={h === i && !isActive ? T.paper : col} sh={isActive ? 4 : (h === i ? 3 : 2)}
              onClick={handleCardClick}
              style={{
                width: "100%",
                padding: "24px 22px 26px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                transform: h === i && !isActive ? "translate(-1px,-1px)" : "none",
                transition: "all 90ms",
                cursor: cardType ? "pointer" : "default",
                borderColor: isActive ? "rgba(174, 230, 62, 0.8)" : "inherit",
                borderWidth: isActive ? "2.5px" : "2.5px",
                boxShadow: isActive ? `${shadow(4)}, 0 0 0 3px rgba(174, 230, 62, 0.2)` : undefined,
              }}>
              <div>
                <Label color={T.ink} style={{ fontSize: 9.5, marginBottom: 12 }}>{l}</Label>
                <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 32, color: T.ink, lineHeight: 1.1, marginBottom: 14 }}>{v}</div>
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: T.ink, opacity: h === i || isActive ? 1 : 0.75, transition: "opacity 110ms" }}>{c}</div>
                {cardType && (h === i || isActive) && (
                  <div style={{ fontFamily: MONO, fontSize: 9, color: T.lime, marginTop: 10, fontWeight: 700, opacity: 0, animation: "fadeIn 200ms 80ms forwards" }}>
                    {cardType === "director" ? "▸ VIEW PROFILE" : (isActive ? "✓ ACTIVE · CLICK AGAIN TO VIEW ALL" : "▸ CLICK TO VIEW ALL")}
                  </div>
                )}
              </div>
            </Box>
            {isActive && cardType && (
              <div style={{ position: "absolute", bottom: -34, left: 0, right: 0, fontFamily: MONO, fontSize: 9, color: T.lime, fontWeight: 700, textAlign: "center", opacity: 0, animation: "slideUp 300ms 100ms forwards" }}>
                VIEWING {data?.name?.toUpperCase() || l?.toUpperCase()}
              </div>
            )}
          </div>
          );
        })}
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {directorProfile && <DirectorProfileModal director={directorProfile} onClose={() => setDirectorProfile(null)} />}
      {sel && <CardModal cardInfo={sel} onClose={() => setSel(null)} stats={stats} />}
    </section>
  );
}

/* ---------- rating outliers (brutalist posters) ---------- */
function Poster({ f, flip, onClick, isActive }) {
  const [h, setH] = useState(false);
  const diff = ((f.your_rating ?? 0) - (f.average_rating ?? 0)).toFixed(1);
  const col = getColor(f._index);

  return (
    <div className="relative" onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onClick={onClick} style={{ cursor: "pointer" }}>
      <Box bg={col} sh={isActive ? 8 : (h ? 6 : 3)}
        style={{
          padding: "12px 12px 14px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          transform: isActive ? "scale(1.03) translate(-2px,-2px)" : (h ? "scale(1.02) translate(-2px,-2px)" : "scale(1)"),
          transition: "all 140ms cubic-bezier(0.2, 0.7, 0.3, 1)",
          borderColor: isActive ? "rgba(174, 230, 62, 0.8)" : "inherit",
          borderWidth: "2.5px",
          boxShadow: isActive ? `${shadow(8)}, 0 0 0 2px rgba(174, 230, 62, 0.25)` : undefined,
        }}>
        <div className="flex justify-between items-start">
          <div style={{ opacity: isActive ? 1 : 0, transform: isActive ? "scale(1)" : "scale(0.8)", transition: "all 120ms", fontSize: 11, fontFamily: MONO, fontWeight: 700, color: T.lime }}>✓</div>
          <span style={{ background: T.lime, color: T.ink, fontFamily: MONO, fontSize: 11, fontWeight: 700, padding: "3px 7px" }}>+{diff}</span>
        </div>
        <div>
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 16, color: T.ink, lineHeight: 1.15, marginBottom: 8 }}>{f.title || "—"}</div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: T.ink, fontWeight: 700, opacity: h || isActive ? 1 : 0, transform: (h || isActive) ? "scale(1)" : "scale(0.8)", transition: "all 120ms", transformOrigin: "left" }}>★ {(f.your_rating ?? 0).toFixed(1)} vs avg {(f.average_rating ?? 0).toFixed(1)}</div>
        </div>
      </Box>
      {(h || isActive) && (
        <Box sh={5} style={{ position: "absolute", top: 0, [flip ? "right" : "left"]: "calc(100% + 10px)", width: 210, padding: 13, zIndex: 40, animation: "slideIn 200ms cubic-bezier(0.2, 0.7, 0.3, 1)" }}>
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 16, color: T.ink }}>{f.title || "—"}</div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: T.muted, marginTop: 2 }}>{f.director || "—"} · {f.runtime || "—"}min · {f.language || "—"}</div>
          <div className="flex items-center justify-between" style={{ marginTop: 10, fontFamily: MONO, fontSize: 10 }}>
            <span style={{ color: T.muted }}>YOU</span>
            <div style={{ flex: 1, height: 7, border: `1.5px solid ${T.ink}`, margin: "0 8px" }}><div style={{ width: "100%", height: "100%", background: T.lime }} /></div>
            <span style={{ color: T.ink, fontWeight: 700 }}>{(f.your_rating ?? 0).toFixed(1)}</span>
          </div>
          <div className="flex items-center justify-between" style={{ marginTop: 4, fontFamily: MONO, fontSize: 10 }}>
            <span style={{ color: T.muted }}>AVG</span>
            <div style={{ flex: 1, height: 7, border: `1.5px solid ${T.ink}`, margin: "0 8px" }}><div style={{ width: `${Math.min((f.average_rating ?? 0) / 5 * 100, 100)}%`, height: "100%", background: T.muted }} /></div>
            <span style={{ color: T.ink, fontWeight: 700 }}>{(f.average_rating ?? 0).toFixed(1)}</span>
          </div>
          {f.review && <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 12, color: T.ink, marginTop: 10, paddingLeft: 8, borderLeft: `3px solid ${T.ink}` }}>"{f.review}"</div>}
          <div style={{ fontFamily: MONO, fontSize: 9, color: T.muted, marginTop: 10 }}>{isActive ? "VIEWING ✓" : "CLICK FOR FULL CARD →"}</div>
        </Box>
      )}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function FilmModal({ f, onClose }) {
  const col = getColor(f._index);
  const diff = ((f.your_rating ?? 0) - (f.average_rating ?? 0)).toFixed(1);
  const [h, setH] = useState(false);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(16,15,12,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}>
      <Box onClick={(e) => e.stopPropagation()} sh={8} style={{ maxWidth: 420, width: "100%", padding: 26 }} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
        <div className="flex items-start" style={{ gap: 16 }}>
          <Box bg={col} sh={3} style={{ width: 84, aspectRatio: "3/4", padding: 8, display: "flex", alignItems: "flex-end", flexShrink: 0 }}>
            <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 13, lineHeight: 1.1 }}>{f.title || "—"}</span>
          </Box>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 22, color: T.ink }}>{f.title || "—"}</div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: T.muted, marginBottom: 8 }}>{f.release_year || "—"} · DIR. {(f.director || "—").toUpperCase()}</div>
            <span style={{ background: T.lime, border: `2px solid ${T.ink}`, fontFamily: MONO, fontSize: 11, fontWeight: 700, padding: "2px 8px", opacity: h ? 1 : 0, transform: h ? "scale(1)" : "scale(0.8)", transition: "all 120ms", transformOrigin: "left", display: "inline-block" }}>★ {(f.your_rating ?? 0).toFixed(1)} · +{diff} VS AVG</span>
          </div>
        </div>
        <div className="grid grid-cols-3" style={{ gap: 10, marginTop: 18 }}>
          {[["RUNTIME", `${f.runtime || "—"} min`], ["LANGUAGE", f.language || "—"], ["RATED", `${(f.your_rating ?? 0).toFixed(1)} / 5`]].map(([k, v]) => (
            <Box key={k} bg={T.paper} sh={0} style={{ padding: "8px 10px" }}>
              <Label style={{ fontSize: 8.5 }}>{k}</Label>
              <div style={{ fontFamily: MONO, fontSize: 12, color: T.ink, marginTop: 3 }}>{v}</div>
            </Box>
          ))}
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: f.review ? "italic" : "normal", fontSize: 14, color: T.ink, marginTop: 16, paddingLeft: 10, borderLeft: `3px solid ${T.ink}` }}>
          {f.review ? `"${f.review}"` : <span style={{ fontFamily: MONO, fontSize: 11, color: T.muted }}>No written review.</span>}
        </div>
        <div style={{ marginTop: 20 }}><Btn onClick={onClose} color={T.amber}>Close</Btn></div>
      </Box>
    </div>
  );
}

function Outliers({ stats }) {
  const [sel, setSel] = useState(null);
  const [mode, setMode] = useState("higher");

  const avgRating = stats?.average_rating ?? 0;
  const ratedFilms = stats?.rated_films || [];

  const higher = ratedFilms
    .filter((f) => (f.your_rating ?? 0) - (f.average_rating ?? 0) > 1.5)
    .sort((a, b) => ((b.your_rating ?? 0) - (b.average_rating ?? 0)) - ((a.your_rating ?? 0) - (a.average_rating ?? 0)))
    .slice(0, 6)
    .map((f, i) => ({ ...f, _index: i }));

  const lower = ratedFilms
    .filter((f) => (f.average_rating ?? 0) - (f.your_rating ?? 0) > 1.5)
    .sort((a, b) => ((b.average_rating ?? 0) - (b.your_rating ?? 0)) - ((a.average_rating ?? 0) - (a.your_rating ?? 0)))
    .slice(0, 6)
    .map((f, i) => ({ ...f, _index: i }));

  const films = mode === "higher" ? higher : lower;

  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 24, color: T.ink, marginBottom: 6 }}>Your Rating Outliers</div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: T.muted, marginBottom: 14 }}>Your average: ★ {avgRating.toFixed(2)} across {ratedFilms.length} films</div>
        <div className="flex" style={{ gap: 8 }}>
          <Btn active={mode === "higher"} color={T.lime} onClick={() => setMode("higher")}>Rated Higher</Btn>
          <Btn active={mode === "lower"} color={T.cyan} onClick={() => setMode("lower")}>Rated Lower</Btn>
        </div>
      </div>
      <div className="grid grid-cols-3" style={{ gap: 14 }}>
        {films.map((f, i) => <Poster key={f.title} f={f} flip={(i % 3) >= 1} onClick={() => setSel(sel === f ? null : f)} isActive={sel?.title === f.title} />)}
      </div>
      {sel && <FilmModal f={sel} onClose={() => setSel(null)} />}
    </section>
  );
}

/* ---------- film history (line + info tooltip) ---------- */
function FilmHistory({ stats }) {
  const [hi, setHi] = useState(null);
  const history = (stats?.decades || []).map(d => [d.decade, d.count]);
  const W = 640, H = 210, pad = 34;
  const maxV = Math.max(...history.map(([, v]) => v), 1);
  const x = (i) => pad + (i / Math.max(history.length - 1, 1)) * (W - pad * 2);
  const y = (v) => H - pad - (v / maxV) * (H - pad * 2);
  const path = history.map(([, v], i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  const gridLines = [0, Math.round(maxV * 0.25), Math.round(maxV * 0.5), Math.round(maxV * 0.75), maxV];

  return (
    <section style={{ marginBottom: 28 }}>
      <Eyebrow note={`${history.length} decades on screen`} info="Each point is a release decade. Height = how many films you logged from that era. Hover a point for the exact count.">film history</Eyebrow>
      <Box style={{ padding: "18px 20px" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }} onMouseLeave={() => setHi(null)}>
          {gridLines.map((g) => (
            <g key={g}>
              <line x1={pad} x2={W - pad} y1={y(g)} y2={y(g)} stroke={T.ink} strokeOpacity="0.12" />
              <text x={pad - 7} y={y(g) + 3} fontSize="9" fontFamily={MONO} fill={T.muted} textAnchor="end">{g}</text>
            </g>
          ))}
          {history.length > 1 && <path d={path} fill="none" stroke={T.ink} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
          {history.map(([d, v], i) => (
            <g key={d} onMouseEnter={() => setHi(i)} style={{ cursor: "pointer" }}>
              <rect x={x(i) - 18} y={0} width={36} height={H} fill="transparent" />
              <rect x={x(i) - (hi === i ? 6 : 4)} y={y(v) - (hi === i ? 6 : 4)} width={hi === i ? 12 : 8} height={hi === i ? 12 : 8} fill={hi === i ? T.lime : T.card} stroke={T.ink} strokeWidth="2.5" />
              <text x={x(i)} y={H - 10} fontSize="9" fontFamily={MONO} fill={hi === i ? T.ink : T.muted} fontWeight={hi === i ? 700 : 400} textAnchor="middle">{d}</text>
              {hi === i && (
                <g>
                  <rect x={x(i) - 26} y={y(v) - 32} width={52} height={20} fill={T.ink} />
                  <text x={x(i)} y={y(v) - 18} fontSize="11" fontFamily={MONO} fontWeight="700" fill={T.card} textAnchor="middle">{v} films</text>
                </g>
              )}
            </g>
          ))}
        </svg>
      </Box>
    </section>
  );
}

/* ---------- rating patterns (bars + info tooltip) ---------- */
function RatingPatterns({ stats }) {
  const [active, setActive] = useState(null);
  const ratingDist = stats?.rating_distribution || {};
  const ratings = ["0.5", "1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];
  const bars = ratings.map(r => [r, ratingDist[r] || 0]);
  const max = Math.max(...bars.map(([, n]) => n), 1);
  const mostGiven = bars.reduce((a, b) => (a[1] > b[1]) ? a : b);

  return (
    <section style={{ marginBottom: 28 }}>
      <Eyebrow note={active === null ? `most given · ${mostGiven[0]}★` : `${bars[active][1]} films @ ${bars[active][0]}★`} info="Each bar is a half-star bucket. Height = films you gave that score. Hover a bar for its count; your most-given rating leans heaviest.">rating patterns</Eyebrow>
      <Box style={{ padding: "20px 20px 14px" }}>
        <div className="flex items-end justify-between" style={{ height: 150, gap: 6 }}>
          {bars.map(([s, n], i) => {
            const on = active === i;
            return (
              <div key={s} className="relative flex-1 flex flex-col items-center justify-end" style={{ height: "100%" }}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
                {on && (
                  <div style={{ position: "absolute", bottom: `calc(${(n / max) * 100}% + 8px)`, background: T.ink, color: T.card, border: `2px solid ${T.ink}`, padding: "3px 7px", fontFamily: MONO, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap", zIndex: 10 }}>{n} films</div>
                )}
                <div style={{ width: "82%", height: `${(n / max) * 100}%`, border: `2px solid ${T.ink}`, background: on ? T.amber : T.lime, transition: "background 100ms" }} />
                <div style={{ fontFamily: MONO, fontSize: 9, color: on ? T.ink : T.muted, fontWeight: on ? 700 : 400, marginTop: 7 }}>{s}</div>
              </div>
            );
          })}
        </div>
      </Box>
    </section>
  );
}

/* ---------- languages (click -> expand popup) ---------- */
function LangModal({ lang, count, films, color, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(16,15,12,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}>
      <Box onClick={(e) => e.stopPropagation()} sh={8} style={{ maxWidth: 400, width: "100%", padding: 0, overflow: "hidden" }}>
        <div style={{ background: color, borderBottom: `2.5px solid ${T.ink}`, padding: "16px 20px" }}>
          <Label color={T.ink} style={{ fontSize: 9.5 }}>LANGUAGE</Label>
          <div className="flex items-baseline justify-between" style={{ marginTop: 4 }}>
            <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 28, color: T.ink }}>{lang}</span>
            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14, color: T.ink }}>{count} films</span>
          </div>
        </div>
        <div style={{ padding: "8px 20px 16px", maxHeight: 320, overflowY: "auto" }}>
          {films.slice(0, 20).map((f) => (
            <div key={f.title} className="flex items-center justify-between" style={{ padding: "10px 0", borderBottom: `1px solid ${T.ink}22` }}>
              <div>
                <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 14, color: T.ink }}>{f.title || "—"}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: T.muted, marginLeft: 8 }}>{f.release_year || "—"}</span>
              </div>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: T.ink }}>{(f.your_rating ?? 0).toFixed(1)}★</span>
            </div>
          ))}
          {count > films.length && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: T.muted, marginTop: 10 }}>+ {count - films.length} more in your diary</div>
          )}
        </div>
        <div style={{ padding: "0 20px 18px" }}><Btn onClick={onClose} color={T.amber}>Close</Btn></div>
      </Box>
    </div>
  );
}

function Languages({ stats }) {
  const [hi, setHi] = useState(null);
  const [sel, setSel] = useState(null);
  const languages = stats?.top_languages || [];
  const max = languages.length > 0 ? languages[0].count : 1;

  const getLangsFilms = (lang) => {
    return (stats?.rated_films || []).filter(f => f.language === lang).slice(0, 20);
  };

  return (
    <section style={{ marginBottom: 28 }}>
      <Eyebrow note="click a row to expand" info="Every spoken language across your logged films, ranked by count. Click any row to see the actual titles in that language.">languages</Eyebrow>
      <Box style={{ padding: 14 }}>
        {languages.map(({ language, count }, i) => {
          const c = getColor(i);
          return (
            <div key={language} className="relative flex items-center" onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onClick={() => setSel({ lang: language, count, films: getLangsFilms(language), color: c })}
              style={{ padding: "11px 12px", border: `2px solid ${hi === i ? T.ink : "transparent"}`, background: hi === i ? T.paper : "transparent", marginBottom: 3, cursor: "pointer", overflow: "hidden", boxShadow: hi === i ? shadow(2) : "none", transition: "all 90ms" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(count / max) * 100}%`, background: c, opacity: hi === i ? 0.45 : 0.22 }} />
              <span style={{ position: "relative", width: 30, fontFamily: MONO, fontWeight: 700, fontSize: 11, color: T.ink }}>#{i + 1}</span>
              <span style={{ position: "relative", flex: 1, fontFamily: SERIF, fontWeight: 700, fontSize: 16, color: T.ink }}>{language}</span>
              <span style={{ position: "relative", fontFamily: MONO, fontSize: 12, color: T.ink }}>{count}{hi === i ? "  ▸" : ""}</span>
            </div>
          );
        })}
      </Box>
      {sel && <LangModal lang={sel.lang} count={sel.count} films={sel.films} color={sel.color} onClose={() => setSel(null)} />}
    </section>
  );
}

/* ---------- reviews (word filter) ---------- */
function Reviews({ revealed, stats }) {
  const [word, setWord] = useState(null);
  const wordFreq = stats?.review_analysis?.word_frequency || [];
  const words = wordFreq.slice(0, 10).map(w => [w.word, w.count]);
  const maxN = Math.max(...words.map(([, n]) => n), 1);

  const reviews = stats?.review_analysis?.reviews || [];
  const shown = word ? reviews.filter((r) => r.text?.toLowerCase().includes(word.toLowerCase())) : reviews;
  const totalReviews = stats?.review_analysis?.total_reviews || 0;

  return (
    <section style={{ marginBottom: 28 }}>
      <Eyebrow note={`${totalReviews} reviews written`} info="Your most-used words across written reviews, sized by frequency. Tap a word to filter the list to reviews that use it; REVEAL unblurs the text.">your reviews</Eyebrow>
      <Box style={{ padding: 18 }}>
        <Label style={{ fontSize: 9.5, marginBottom: 10 }}>most used words · tap to filter</Label>
        <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 16 }}>
          {words.map(([w, n]) => {
            const on = word === w;
            const sc = 0.9 + (n / maxN) * 0.35;
            return (
              <button key={w} onClick={() => setWord(on ? null : w)}
                style={{
                  fontFamily: MONO, fontWeight: 700, fontSize: 12 * sc, padding: "5px 10px",
                  border: `2px solid ${T.ink}`, background: on ? T.lime : T.card, color: T.ink, cursor: "pointer",
                  boxShadow: on ? shadow(3) : shadow(1), transform: on ? "translate(-1px,-1px)" : "none", transition: "all 90ms",
                }}>
                {w} <span style={{ opacity: 0.5, fontSize: 10 }}>·{n}</span>
              </button>
            );
          })}
        </div>

        {/* filter banner — UI shifts when a word is active */}
        {word && (
          <div className="flex items-center justify-between" style={{ background: T.ink, color: T.card, padding: "8px 12px", marginBottom: 14 }}>
            <span style={{ fontFamily: MONO, fontSize: 11 }}>FILTERING · "{word}" · {shown.length} review{shown.length === 1 ? "" : "s"}</span>
            <button onClick={() => setWord(null)} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, background: T.lime, color: T.ink, border: "none", padding: "2px 9px", cursor: "pointer" }}>CLEAR ✕</button>
          </div>
        )}

        <div className="grid grid-cols-2" style={{ gap: 12 }}>
          {shown.slice(0, 12).map((r, idx) => (
            <Box key={idx} bg={T.paper} sh={2} style={{ padding: 13 }}>
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 15, color: T.ink }}>{r.title || "—"}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: T.ink }}>♥ {r.likes || 0}</span>
              </div>
              <Label style={{ fontSize: 8.5, margin: "2px 0 8px" }}>{r.year || "—"}</Label>
              <div style={{ fontFamily: MONO, fontSize: 11, color: T.ink, lineHeight: 1.5, wordBreak: "break-word", filter: revealed ? "none" : "blur(4px)", transition: "filter 200ms" }}>{r.text || "No text"}</div>
            </Box>
          ))}
        </div>
        {!revealed && <div style={{ fontFamily: MONO, fontSize: 9.5, color: T.muted, marginTop: 12 }}>Review text hidden · hit REVEAL up top to show it.</div>}
      </Box>
    </section>
  );
}

/* ---------- cinema scale ---------- */
function CinemaScale({ stats }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => { const id = setTimeout(() => setGrown(true), 120); return () => clearTimeout(id); }, []);

  const sinefil = stats?.sinefil_meter || {};
  const score = Math.round(sinefil.score ?? 0);
  const breakdown = sinefil.breakdown || {};

  const subScores = [
    ["Geographic", breakdown.geographic?.score ?? 0, breakdown.geographic?.max ?? 25, T.lime],
    ["Historical", breakdown.historical?.score ?? 0, breakdown.historical?.max ?? 20, T.amber],
    ["Languages", breakdown.languages?.score ?? 0, breakdown.languages?.max ?? 15, T.cyan],
    ["Volume", breakdown.volume?.score ?? 0, breakdown.volume?.max ?? 15, T.purple],
    ["Genres", breakdown.genres?.score ?? 0, breakdown.genres?.max ?? 15, T.red],
    ["Directors", breakdown.directors?.score ?? 0, breakdown.directors?.max ?? 10, T.lime],
  ];

  const getScoreLabel = (sc) => {
    if (sc < 30) return "niche";
    if (sc < 50) return "arthouse";
    if (sc < 70) return "balanced";
    return "mainstream";
  };

  return (
    <section style={{ marginBottom: 28 }}>
      <Eyebrow note="how adventurous is your taste" info="A 0–100 score for how adventurous your taste is, built from six sub-scores: geography, era spread, languages, volume, genre breadth and director variety.">cinema scale</Eyebrow>
      <Box style={{ padding: "22px 22px 24px" }}>
        <div className="flex items-end" style={{ gap: 12, marginBottom: 18 }}>
          <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 56, color: T.ink, lineHeight: 0.85 }}>{score}</span>
          <span style={{ fontFamily: MONO, fontSize: 14, color: T.muted, marginBottom: 6 }}>/100 · {getScoreLabel(score)}</span>
        </div>
        <div style={{ height: 14, border: `2.5px solid ${T.ink}`, marginBottom: 6, background: T.paper }}>
          <div style={{ width: grown ? `${score}%` : 0, height: "100%", background: T.lime, transition: "width 900ms cubic-bezier(.2,.7,.3,1)" }} />
        </div>
        <div className="flex justify-between" style={{ fontFamily: MONO, fontSize: 9, color: T.muted, marginBottom: 22 }}>
          <span>NICHE</span><span>BALANCED</span><span>MAINSTREAM</span>
        </div>
        <div className="grid grid-cols-3" style={{ gap: "14px 22px" }}>
          {subScores.map(([l, v, m, c], i) => (
            <div key={l}>
              <div className="flex justify-between" style={{ marginBottom: 5 }}>
                <Label style={{ fontSize: 9 }}>{l}</Label>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: T.ink }}>{Math.round(v)}/{Math.round(m)}</span>
              </div>
              <div style={{ height: 9, border: `2px solid ${T.ink}`, background: T.paper }}>
                <div style={{ width: grown ? `${(v / m) * 100}%` : 0, height: "100%", background: c, transition: `width 800ms ${i * 70}ms cubic-bezier(.2,.7,.3,1)` }} />
              </div>
            </div>
          ))}
        </div>
      </Box>
    </section>
  );
}

/* ---------- footer ---------- */
function Footer() {
  return (
    <div style={{ textAlign: "center", padding: "6px 0 50px" }}>
      <Btn color={T.lime}>Share your Wrapped</Btn>
      <div style={{ fontFamily: MONO, fontSize: 9.5, color: T.muted, marginTop: 14 }}>Raw files are never stored. Only anonymous aggregate stats are kept, with consent.</div>
    </div>
  );
}

/* ---------- app ---------- */
export default function Wrapped() {
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = sessionStorage.getItem('letterboxdStats');
    if (saved) {
      try {
        setStats(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse stats:', e);
      }
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div style={{
        background: T.paper, minHeight: "100vh", color: T.ink,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24
      }}>
        <Box sh={4} style={{ padding: 40, textAlign: "center", maxWidth: 400 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, border: `2.5px solid ${T.ink}`, borderRadius: "50%", borderTopColor: T.lime, animation: "spin 1s linear infinite" }} />
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 24, marginBottom: 12, color: T.ink }}>Loading your data</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: T.muted, letterSpacing: "0.08em" }}>Processing your Letterboxd films and building your wrapped stats.</div>
        </Box>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{
        background: T.paper, minHeight: "100vh", color: T.ink,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24
      }}>
        <Box sh={4} style={{ padding: 40, textAlign: "center", maxWidth: 400 }}>
          <div style={{ background: T.red, border: `2.5px solid ${T.ink}`, width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: shadow(2) }}>
            <span style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, color: T.ink }}>!</span>
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 24, marginBottom: 12, color: T.ink }}>No data found</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: T.muted, lineHeight: 1.6, marginBottom: 20, letterSpacing: "0.05em" }}>
            Please upload your Letterboxd data or scrape your public profile first.
          </div>
          <a href="/" style={{ display: "inline-block", fontFamily: MONO, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: T.ink, background: T.purple, border: `2.5px solid ${T.ink}`, padding: "10px 18px", textDecoration: "none", cursor: "pointer", boxShadow: shadow(2), transition: "all 90ms" }} onMouseEnter={(e) => { e.currentTarget.style.background = T.lime; e.currentTarget.style.boxShadow = shadow(3); e.currentTarget.style.transform = "translate(-1px,-1px)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = T.purple; e.currentTarget.style.boxShadow = shadow(2); e.currentTarget.style.transform = "none"; }}>Back home</a>
        </Box>
      </div>
    );
  }

  return (
    <div style={{
      background: T.paper, minHeight: "100vh", color: T.ink,
      backgroundImage: `linear-gradient(${T.ink}0a 1px, transparent 1px), linear-gradient(90deg, ${T.ink}0a 1px, transparent 1px)`,
      backgroundSize: "30px 30px",
    }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 24px" }}>
        <Nav revealed={revealed} setRevealed={setRevealed} />
        <Hero stats={stats} />
        <WrappedCards stats={stats} />
        <Outliers stats={stats} />
        <FilmHistory stats={stats} />
        <RatingPatterns stats={stats} />
        <Languages stats={stats} />
        <Reviews revealed={revealed} stats={stats} />
        <CinemaScale stats={stats} />
        <Footer />
      </div>
    </div>
  );
}
