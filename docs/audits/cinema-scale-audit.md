# Cinema Scale Scoring — Audit & Proposal

## 1. Where the Score is Calculated

There are **two independent scoring systems** that compete at display time:

| System | Location | Used when |
|---|---|---|
| **Backend `sinefil_meter`** | `backend/app/main.py:653-677` | Always computed; sent as `stats.sinefil_meter.score` |
| **Frontend `calcCinephileScore`** | `frontend/src/app/results/page.tsx:57-107` | Fallback if `sinefil_meter` is missing |

The display line (`results/page.tsx:313`) is:

```ts
const cineScore = Math.max(0, Math.min(100,
  stats?.sinefil_meter?.score ?? calcCinephileScore(stats)
));
```

In practice, the backend **always** returns `sinefil_meter`, so the frontend
formula is dead code for normal users. The score everyone sees is the backend
one.

---

## 2. Current Formulas

### 2A. Backend Formula (the one that matters)

```python
avg_popularity = films_enriched['popularity'].dropna().mean()
cinephile_score = 100 - min(avg_popularity, 100)
```

**Input metrics: exactly one.**

| Metric | Source | Description |
|---|---|---|
| `popularity` | TMDB `movie/{id}` → `popularity` field | TMDB's real-time popularity index (unbounded float, typically 0–200+, with blockbusters sometimes >1000) |

**How it contributes:**
- The score is simply `100 - avg_popularity`, clamped to [0, 100].
- A user whose films have mean TMDB popularity of 25 gets a score of 75.
- A user whose films have mean TMDB popularity of 8 gets a score of 92.

That's it. There is no diversity, no historical depth, no language breadth —
just one inverted popularity number.

### 2B. Frontend Formula (fallback, rarely used)

```
volumeBase   = min(50, log10(max(1, total_films)) * 20)       // 0–50 pts
geoBonus     = (nonUSRatio * 15) + min(15, prestigeCount/total * 30)  // 0–30 pts
historyBonus = (pre2000/total)*10 + (pre1980/total)*5 + (pre1960/total)*5  // 0–20 pts
langBonus    = (min(8, langCount) / 8) * 10                   // 0–10 pts

finalScore   = clamp(round(volumeBase + geoBonus + historyBonus + langBonus), 5, 100)
```

| Metric | Max contribution | Description |
|---|---|---|
| `total_films` (log10) | 50 pts | Film volume — logarithmic |
| non-US ratio | 15 pts | 1 - (US films / total) |
| prestige country films | 15 pts | Films from FR, IT, JP, KR, IR, DE, SE, RU |
| pre-2000 films ratio | 10 pts | Historical depth tier 1 |
| pre-1980 films ratio | 5 pts | Historical depth tier 2 |
| pre-1960 films ratio | 5 pts | Historical depth tier 3 |
| language count | 10 pts | Number of distinct languages (capped at 8) |

**Theoretical max:** 50 + 30 + 20 + 10 = **110**, clamped to 100.

---

## 3. Edge-Case Simulation

### User profile:
- 200 total films
- 80% US films (160 US, 40 non-US)
- 75% English language (but ~6 languages total)
- 60% from 2010s decade
- Top 3 directors = 40% of total films
- High median TMDB popularity (~45)

### Backend score (what the user actually sees):

```
avg_popularity ≈ 45
cinephile_score = 100 - min(45, 100) = 55.0
```

**Result: 55.0** — "Balanced Cinephile"

### Frontend fallback (if backend were missing):

```
volumeBase   = min(50, log10(200) * 20) = min(50, 2.301 * 20) = min(50, 46.0) = 46.0
nonUSRatio   = 1 - 160/200 = 0.20
prestigeCount ≈ 20 (estimate: some JP, FR, KR in the 40 non-US)
geoBonus     = (0.20 * 15) + min(15, (20/200) * 30) = 3.0 + min(15, 3.0) = 6.0
pre2000      ≈ 30 films (15%)  → 0.15 * 10 = 1.5
pre1980      ≈ 10 films (5%)   → 0.05 * 5  = 0.25
pre1960      ≈ 2 films (1%)    → 0.01 * 5  = 0.05
historyBonus = 1.80
langBonus    = (min(8, 6) / 8) * 10 = 7.5

total = 46.0 + 6.0 + 1.80 + 7.5 = 61.3 → rounds to 61
```

**Result: 61** — These two systems disagree by 6 points on the same user.

---

## 4. Why Most Users End Up Above 80

The problem is entirely in the backend formula.

### TMDB popularity is **not** a 0–100 scale

TMDB `popularity` is an unbounded score driven by recent page views, votes,
and watchlist additions. Typical values:

| Film type | TMDB popularity |
|---|---|
| Obscure 1970s arthouse | 2–6 |
| Respected classic (Godfather in a quiet month) | 8–15 |
| Typical well-known film | 15–30 |
| Currently in theaters / trending | 50–200 |
| Blockbuster opening week | 200–2000+ |

The formula `100 - avg_popularity` means:

- **Any user who mostly watches non-trending films** (which is almost everyone
  on Letterboxd, since most of their library was watched months/years ago)
  will have an average popularity of 10–20, yielding a score of **80–90**.
- TMDB popularity **decays over time**. A film that was popular at release
  (popularity=80) might sit at popularity=12 six months later. So even a
  mainstream viewer who watched all the big 2024 releases will show low
  current popularity values by now.
- Only a user who watches *exclusively* currently-trending blockbusters
  would score below 60.

### Concrete demonstration:

A user who watched 100 films — 90 Hollywood crowd-pleasers and 10 obscure
arthouse films — likely has:

```
avg_popularity ≈ (90 * 15 + 10 * 4) / 100 = 13.9
score = 100 - 13.9 = 86.1
```

**86.1 for a viewer who is 90% Hollywood.** The score is nearly meaningless
as a diversity/cinephilia metric.

### Additional problems:

1. **Temporal instability.** The same user gets different scores depending
   on *when* the analysis runs, because TMDB popularity fluctuates daily.
2. **Single-axis.** Director concentration, genre monoculture, decade
   clustering — none of it matters.
3. **No penalty for dominance.** Watching 150 US films and 2 French films
   scores almost the same as watching 75 US and 75 French.
4. **Frontend/backend disagreement.** The two formulas measure completely
   different things and can diverge by 20+ points.
5. **The displayed "breakdown" is a lie.** The CinemaScale component shows
   "Geographic 25%, Historical 20%, Languages 15%, Other 40%" — but those
   weights only apply to the frontend fallback that nobody uses.

---

## 5. Proposed Scoring Model

### Design goals:
- Average user scores **60–70** (not 85+)
- Meaningful discrimination across the full 0–100 range
- Stable across time (no TMDB popularity dependency)
- Penalizes **dominance** (one country/genre/decade dominating)
- Uses **entropy** for true diversity measurement
- Hard caps prevent any single axis from dominating

### 5A. Axes and Weights

| Axis | Weight | Max pts | What it measures |
|---|---|---|---|
| **Geographic diversity** | 25 | 25 | Entropy of country distribution |
| **Temporal depth** | 20 | 20 | Entropy of decade distribution + age bonus |
| **Language diversity** | 15 | 15 | Entropy of language distribution |
| **Volume maturity** | 15 | 15 | Log-scaled film count |
| **Genre breadth** | 15 | 15 | Entropy of genre distribution |
| **Director exploration** | 10 | 10 | Inverse concentration (anti-dominance) |

**Total theoretical max: 100.** Each axis is hard-capped at its weight.

### 5B. Entropy Primer

Shannon entropy for a distribution of counts:

```
H(X) = -Σ (p_i * log2(p_i))   where p_i = count_i / total
```

Normalized entropy (0 to 1):

```
H_norm(X) = H(X) / log2(N)    where N = number of distinct categories
```

`H_norm = 1.0` means perfectly uniform distribution.
`H_norm → 0` means one category dominates everything.

This naturally penalizes dominance without needing special-case rules.

### 5C. Axis Formulas

#### Geographic Diversity (0–25 pts)

```
p_i = films_from_country_i / total_films
H_geo = -Σ (p_i * log2(p_i))
H_geo_norm = H_geo / log2(num_countries)       // 0..1

// Penalty: if top country > 80%, apply a 0.6x multiplier
dominance_mult = top_country_share > 0.80 ? 0.6 : 1.0

geo_score = min(25, round(H_geo_norm * dominance_mult * 25))
```

With only 1 country: `H_geo_norm = 0`, score = 0.
With 10 equally-distributed countries: `H_geo_norm ≈ 1.0`, score ≈ 25.

#### Temporal Depth (0–20 pts)

Two sub-components:

```
// A. Decade entropy (0–12 pts)
p_i = films_from_decade_i / total_films
H_dec = -Σ (p_i * log2(p_i))
H_dec_norm = H_dec / log2(num_decades)
decade_entropy_pts = min(12, round(H_dec_norm * 12))

// B. Age bonus (0–8 pts) — reward watching older films
median_release_year = median of all film release years
years_back = current_year - median_release_year
age_pts = min(8, round((years_back / 40) * 8))     // 40+ years back = full 8 pts
```

```
temporal_score = decade_entropy_pts + age_pts       // capped at 20
```

#### Language Diversity (0–15 pts)

```
p_i = films_in_language_i / total_films
H_lang = -Σ (p_i * log2(p_i))
H_lang_norm = H_lang / log2(num_languages)

// Penalty: if top language > 85%, apply 0.5x
dominance_mult = top_language_share > 0.85 ? 0.5 : 1.0

lang_score = min(15, round(H_lang_norm * dominance_mult * 15))
```

#### Volume Maturity (0–15 pts)

```
volume_score = min(15, round(log10(max(1, total_films)) * 6))
```

| Films | Score |
|---|---|
| 10 | 6 |
| 50 | 10 |
| 100 | 12 |
| 500 | 15 (cap) |
| 1000 | 15 (cap) |

Gentle curve. You don't need 10,000 films to max this out, but watching
10 films won't carry you.

#### Genre Breadth (0–15 pts)

```
p_i = films_in_genre_i / total_genre_tags   // note: films have multiple genres
H_genre = -Σ (p_i * log2(p_i))
H_genre_norm = H_genre / log2(num_genres)

genre_score = min(15, round(H_genre_norm * 15))
```

#### Director Exploration (0–10 pts)

Measures how concentrated vs. spread out your director choices are:

```
top3_share = (top3_directors_film_count) / total_films

// Inverse: lower concentration = higher score
exploration_score = min(10, round((1 - top3_share) * 12))
```

| Top 3 directors share | Score |
|---|---|
| 5% (very spread out) | 10 |
| 15% | 10 |
| 25% | 9 |
| 40% | 7 |
| 60% | 5 |
| 80% | 2 |

### 5D. Final Score

```
cinema_scale = geo_score + temporal_score + lang_score
             + volume_score + genre_score + director_score

// Already hard-capped per axis, but final clamp for safety:
cinema_scale = clamp(cinema_scale, 0, 100)
```

---

## 6. Example Recalculation — Sample Dataset

### Input (from Section 3):
- 200 total films
- 80% US, 8% France, 5% Japan, 3% South Korea, 2% UK, 2% Other
- 75% English, 10% French, 8% Japanese, 4% Korean, 3% Other
- Decades: 60% 2010s, 20% 2020s, 10% 2000s, 5% 1990s, 3% 1980s, 2% pre-1980
- Genres: 30% Drama, 25% Action, 15% Thriller, 10% Comedy, 8% Sci-Fi, 12% Other
- Top 3 directors = 40% of total films (80 films)
- Median release year: ~2015

### Geographic Diversity

```
Counts: US=160, FR=16, JP=10, KR=6, UK=4, Other=4
Probabilities: [0.80, 0.08, 0.05, 0.03, 0.02, 0.02]

H_geo = -(0.80*log2(0.80) + 0.08*log2(0.08) + 0.05*log2(0.05)
        + 0.03*log2(0.03) + 0.02*log2(0.02) + 0.02*log2(0.02))
      = -(0.80*(-0.322) + 0.08*(-3.644) + 0.05*(-4.322)
        + 0.03*(-5.059) + 0.02*(-5.644) + 0.02*(-5.644))
      = -(−0.258 + −0.292 + −0.216 + −0.152 + −0.113 + −0.113)
      = 1.143

H_geo_norm = 1.143 / log2(6) = 1.143 / 2.585 = 0.442

dominance_mult = 0.6   (US = 80%, triggers penalty)

geo_score = min(25, round(0.442 * 0.6 * 25)) = min(25, round(6.63)) = 7
```

### Temporal Depth

```
Decades: 2010s=120, 2020s=40, 2000s=20, 1990s=10, 1980s=6, pre-1980=4
Probs: [0.60, 0.20, 0.10, 0.05, 0.03, 0.02]

H_dec = -(0.60*log2(0.60) + 0.20*log2(0.20) + 0.10*log2(0.10)
        + 0.05*log2(0.05) + 0.03*log2(0.03) + 0.02*log2(0.02))
      = -(−0.442 + −0.464 + −0.332 + −0.216 + −0.152 + −0.113)
      = 1.719

H_dec_norm = 1.719 / log2(6) = 1.719 / 2.585 = 0.665

decade_entropy_pts = min(12, round(0.665 * 12)) = 8

median_release_year ≈ 2015
years_back = 2026 - 2015 = 11
age_pts = min(8, round((11 / 40) * 8)) = min(8, round(2.2)) = 2

temporal_score = 8 + 2 = 10
```

### Language Diversity

```
Counts: EN=150, FR=20, JP=16, KR=8, Other=6
Probs: [0.75, 0.10, 0.08, 0.04, 0.03]

H_lang = -(0.75*log2(0.75) + 0.10*log2(0.10) + 0.08*log2(0.08)
         + 0.04*log2(0.04) + 0.03*log2(0.03))
       = -(−0.311 + −0.332 + −0.292 + −0.186 + −0.152)
       = 1.273

H_lang_norm = 1.273 / log2(5) = 1.273 / 2.322 = 0.548

dominance_mult = 0.5   (EN = 85%, triggers penalty at >85% — borderline)
// Actually 75% < 85%, so no penalty:
dominance_mult = 1.0

lang_score = min(15, round(0.548 * 1.0 * 15)) = min(15, round(8.2)) = 8
```

### Volume Maturity

```
volume_score = min(15, round(log10(200) * 6)) = min(15, round(2.301 * 6))
             = min(15, round(13.8)) = 14
```

### Genre Breadth

```
Genre tags (a film can have multiple): Drama=90, Action=75, Thriller=45,
  Comedy=30, Sci-Fi=24, Other=36   → total_tags = 300
Probs: [0.30, 0.25, 0.15, 0.10, 0.08, 0.12]

H_genre = -(0.30*log2(0.30) + 0.25*log2(0.25) + 0.15*log2(0.15)
          + 0.10*log2(0.10) + 0.08*log2(0.08) + 0.12*log2(0.12))
        = -(−0.521 + −0.500 + −0.411 + −0.332 + −0.292 + −0.367)
        = 2.423

H_genre_norm = 2.423 / log2(6) = 2.423 / 2.585 = 0.937

genre_score = min(15, round(0.937 * 15)) = min(15, 14) = 14
```

### Director Exploration

```
top3_share = 80 / 200 = 0.40

exploration_score = min(10, round((1 - 0.40) * 12)) = min(10, round(7.2)) = 7
```

### Final Score

```
cinema_scale = 7 + 10 + 8 + 14 + 14 + 7 = 60
```

### Comparison

| System | Score | Tier |
|---|---|---|
| Current backend (sinefil_meter) | **55** | Balanced Cinephile |
| Current frontend fallback | **61** | — |
| **Proposed model** | **60** | Eclectic Viewer |

The proposed score of **60** for this US-heavy, modern-skewing, director-concentrated
user is much more honest than the **86** that someone with similar habits
but lower TMDB popularity would get from the current backend formula.

---

## 7. Summary of Problems → Fixes

| # | Problem | Fix |
|---|---|---|
| 1 | Score is purely `100 - popularity` — not a diversity metric at all | Replace with multi-axis entropy-based composite |
| 2 | TMDB popularity decays, making scores temporally unstable | Remove popularity as an input entirely |
| 3 | No penalty for 80% US dominance | Entropy naturally penalizes; explicit dominance multiplier added |
| 4 | No genre, director, or decade diversity measurement | Added as scored axes |
| 5 | Frontend/backend formulas disagree | Consolidate to one formula (recommend backend, delete frontend fallback) |
| 6 | UI shows fake breakdown percentages | Make UI breakdown match actual formula weights |
| 7 | Almost everyone scores 80+ | Target distribution centered at 60–70 with meaningful spread |
| 8 | 10 films and 500 films score similarly | Volume maturity axis rewards experience |

---

## 8. Implementation Notes (for when we build this)

- **Compute in backend** (`main.py`) where all enriched data lives.
- **Delete `calcCinephileScore`** from `results/page.tsx` — no more fallback.
- **Update `CinemaScale.tsx`** breakdown grid to show the real 6 axes.
- **Keep `sinefil_meter` key** in the stats payload for backward compat;
  just change how `.score` is calculated.
- All entropy calculations use `math.log2` in Python; handle `p=0` with
  the convention `0 * log2(0) = 0`.
- Estimated effort: ~80 lines of Python, ~20 lines of TS deletion.
