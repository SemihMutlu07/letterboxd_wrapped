# Roadmap: Movies Wrapped

**Created:** 2026-05-09
**Core Value:** Kullanıcının Letterboxd verisinden anlamlı, görsel olarak etkileyici ve paylaşılabilir bir film istatistik özeti çıkarmak.

## Overview

**7 phases** | **19 v1 requirements** | All requirements mapped ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|-------------|-----------------|
| 1 | TMDB Image Fix | Director/cast profile photos gelsin | IMG-01, IMG-02, IMG-03 | 4 |
| 2 | Poster Strategy | Poster kalitesi iyileştirilsin | IMG-04, IMG-05 | 3 |
| 3 | Review Text Analysis | Review metrikleri pipeline'a bağlansın | REV-01, REV-02 | 4 |
| 4 | Mobile + Share UX | Mobile responsive + share UX düzeltmeleri | MOB-01, MOB-02, MOB-03, MOB-04 | 5 |
| 5 | Error Logging | Hata loglama + analytics altyapısı | LOG-01, LOG-02, LOG-03 | 4 |
| 6 | Design Integration | Tema kararı + entegrasyon | DSG-01, DSG-02 | 3 |
| 7 | Supabase + Deploy | Backend/frontend deploy | DEP-01, DEP-02, DEP-03 | 4 |

## Phase Details

### Phase 1: TMDB Image Fix

**Goal:** Director'lar ve actor'lar için TMDB profile_path'leri backend'de çekilsin, frontend'de düzgün gösterilsin.

**Requirements:** IMG-01, IMG-02, IMG-03

**Files to change:**
- `backend/app/services/analysis.py` (top_directors'a profile_path ekle, actor profile fetch'i top 3 → top 20 genişlet)
- `backend/app/services/tmdb_client.py` (opsiyonel: batch person search)
- `frontend/src/components/results/Cards.tsx` (image loading sağlamlaştırma)
- `frontend/src/containers/results/experimental/sections/DirectorsGrid.tsx` (PersonCard)
- `frontend/src/containers/results/experimental/sections/CastGrid.tsx`

**Success criteria:**
1. Backend `top_directors` response'ında her direktör için `profile_path` var
2. Backend `top_actors` response'ında top 20 aktörün her biri için `profile_path` var
3. Frontend DirectorsGrid'de her direktörün fotoğrafı gözüküyor (fallback placeholder çalışıyor)
4. Frontend CastGrid'de tüm aktörlerin fotoğrafları gözüküyor

**Plan:**
1. `analysis.py` içinde `top_directors` oluşturulurken TMDB person search yap (async gather ile paralel)
2. `top_actors` oluşturulurken top 3 limitini kaldır, top 20'nin tamamına search yap
3. `directors_with_ratings`'e de `profile_path` ekle (frontend merge ediyor)
4. Frontend PersonCard image timeout (5s sonra fallback) ekle
5. `tsc && npm run lint` ile doğrula

**UI hint:** Yes

---

### Phase 2: Poster Strategy

**Goal:** TMDB poster sorgu stratejisi iyileştirilsin, alternatif posterler dene, Letterboxd farkı analiz edilsin.

**Requirements:** IMG-04, IMG-05

**Files to change:**
- `backend/app/services/tmdb_client.py` (poster fetch stratejisi: alternatives, fallback chain)
- `backend/app/services/analysis.py` (poster selection logic)
- `frontend/src/lib/analytics.ts` (getPosterUrl fallback chain)

**Success criteria:**
1. Film için TMDB'de alternatif poster (backdrop, english poster) deneniyor
2. Letterboxd poster farkı belgelenmiş (en azından tespit)
3. Poster gelmeyen film sayısı minimize edilmiş

**Plan:**
1. TMDB `/movie/{id}/images` endpoint'ini dene (alternative posters)
2. Poster seçim stratejisi: language_filter='en' + poster type
3. Letterboxd poster'ının nereden geldiğini araştır (manual upload, TMDB source?)
4. Frontend'de poster fallback chain ekle: birincil poster → alternatif poster → backdrop → placeholder

**UI hint:** No (backend ağırlıklı)

---

### Phase 3: Review Text Analysis

**Goal:** Mevcut review_analysis.py (342 satır) backend analysis pipeline'ına bağlansın, frontend'de WritingStats/WordCloud/LanguageTimeline gösterilsin.

**Requirements:** REV-01, REV-02

**Files to change:**
- `backend/app/services/analysis.py` (review_analysis fonksiyonlarını pipeline'a ekle)
- `backend/app/services/review_analysis.py` (API contract kontrolü)
- `frontend/src/containers/results/` (yeni section component'ları)

**Success criteria:**
1. Reviews CSV varsa analiz pipeline'ı review metriklerini hesaplıyor
2. Supabase endpoint'ten `stats.review_metrics` dönüyor
3. Frontend'de en az 1 review section gösteriliyor (WritingStats)
4. Frontend, review metriklerini düzgün render ediyor

**Plan:**
1. `analysis.py` → `process_comprehensive_letterboxd_data()` içinde `reviews.csv` varsa `compute_review_metrics()` çağır
2. `review_analysis.py` fonksiyonlarını `analysis.py`'deki `_progress()` sistemine entegre et
3. Frontend'de `StatsData` type'ına review metriklerini ekle
4. WritingStats, WordCloud, LanguageTimeline section'larını oluştur
5. Tümünü `experimental/registry.ts`'ye kaydet

**UI hint:** Yes

---

### Phase 4: Mobile Responsive + Share UX

**Goal:** Tüm results component'ları mobile responsive olsun, share wrapped'de actor/director diversity tıklanabilir olsun, pinch-to-zoom çalışsın.

**Requirements:** MOB-01, MOB-02, MOB-03, MOB-04

**Files to change:**
- `frontend/src/containers/results/` (tüm section'lar — responsive)
- `frontend/src/components/share/` (share cards — pinch zoom)
- `frontend/src/components/share/ShareModal.tsx` (actor/director diversity tıklanabilir)

**Success criteria:**
1. Tüm results section'ları mobile (375px) viewport'ta okunabilir
2. Film history grafiği mobile'da scroll edilebilir / kaydırılabilir
3. Share card'lar mobilde pinch-to-zoom ile zoom yapılabiliyor
4. Director diversity / actor diversity share card'larında seçim yapılabiliyor

**Plan:**
1. Her section component'ı mobile responsive yap (Tailwind breakpoint: sm:, md:)
2. FilmHistory/RatingPatterns → mobilde yatay scroll ile göster
3. Share cards'a touch gesture (pinch zoom) ekle — CSS `touch-action: pinch-zoom` veya `@use-gesture/react`
4. CrushDirectorSwap bileşenindeki diversity etiketlerini tıklanabilir buton yap (şu an sadece metin)

**UI hint:** Yes

---

### Phase 5: Error Logging & Analytics

**Goal:** Backend error logging, frontend image hata raporlama, kullanıcı analytics tracking (consent-free).

**Requirements:** LOG-01, LOG-02, LOG-03

**Files to change:**
- `backend/app/main.py` (error logging middleware genişletme)
- `backend/app/routes/analyze.py` (analiz log endpoint'i)
- `backend/app/services/analysis.py` (hata durumlarını logla)
- `frontend/src/lib/api.ts` (image error reporting)
- `frontend/src/components/results/Cards.tsx` (onError → backend raporla)
- `frontend/src/lib/supabaseClient.ts`

**Success criteria:**
1. Backend tüm analiz hatalarını Supabase `error_logs` tablosuna yazıyor
2. Frontend'de image load hatası oluştuğunda backend'e rapor gidiyor
3. Kullanıcı session verileri (film_count, browser, timestamp) Supabase'e kaydediliyor
4. Log'lar `user_sessions` ve `analysis_runs` üzerinden trace edilebiliyor

**Plan:**
1. Supabase'de `error_logs` tablosu oluştur (session_id, error_type, error_message, timestamp, metadata)
2. Backend error middleware'ini log writing ile genişlet
3. Analysis pipeline'da try/except bloklarını log ekle
4. Frontend Cards.tsx'te image onError → POST /api/log-error
5. landing sayfasında kullanıcı interaction'larını (consent-free) Supabase'e upsert

**UI hint:** No

---

### Phase 6: Design Integration

**Goal:** Tema kararı verilsin, seçilen tema CSS variable'larına dönüştürülüp tüm component'lara entegre edilsin.

**Requirements:** DSG-01, DSG-02

**Files to change:**
- `frontend/src/lib/theme.tsx` (yeni tema ekle)
- `frontend/src/styles/globals.css` (CSS variable tanımları)
- Tüm component files (varsa hardcoded renkleri temizle)

**Success criteria:**
1. En az 1 tema prototipi CSS variable'larına dönüştürülmüş
2. Tüm component'lar CSS variable'larını kullanıyor (hardcoded renk yok)
3. Tema switch çalışıyor (en az current ve yeni tema)

**Plan:**
1. Mevcut prototipleri (Letterboxd Native, Editorial Magazine, Filmstrip Darkroom) göster
2. Seçilen tema için CSS variable seti oluştur (renk, font, border-radius)
3. `theme.tsx`'e yeni tema config'i ekle
4. Hardcoded renkleri temizle (CSS variable'larına taşı)
5. Tema switch test et

**UI hint:** Yes

---

### Phase 7: Supabase + Deploy

**Goal:** Backend Render'a deploy, frontend Netlify güncellemesi, Supabase bağlantısı.

**Requirements:** DEP-01, DEP-02, DEP-03

**Files to change:**
- `frontend/.env.local` (Supabase URL güncelle)
- `backend/.env` (TMDB_API_KEY, ALLOW_ALL_NETLIFY)
- `backend/Dockerfile` (kontrol)
- `netlify.toml` (kontrol)

**Success criteria:**
1. Backend Render'da çalışıyor (health check 200)
2. Frontend Netlify deploy başarılı
3. Supabase bağlantısı çalışıyor (ERR_NAME_NOT_RESOLVED yok)
4. Uçtan uca test: username scrape → results → share export çalışıyor

**Plan:**
1. Supabase'de yeni proje oluştur, URL + anon key al
2. `.env.local`'ı güncelle
3. Backend Dockerfile'ı kontrol et, Render'a deploy et (env: TMDB_API_KEY, ALLOW_ALL_NETLIFY)
4. Frontend'i `npm run build` ile derle, Netlify'a deploy et
5. Uçtan uca test

**UI hint:** No

---

## Parallelization Map

```
Terminal 1: Phase 1 (TMDB Image Fix) — backend
Terminal 2: Phase 4 (Mobile Responsive) — frontend   ← Phase 1 ile paralel
Terminal 3: Phase 3 (Reviews) — backend               ← Phase 1 bittikten sonra
Terminal 4: Phase 5 (Error Logging) — backend          ← Phase 1 bittikten sonra
Terminal 5: Phase 2 (Poster) — backend                 ← Phase 1 bittikten sonra
Terminal 6: Phase 6 (Design) — frontend                ← bağımsız, istediğin zaman
Terminal 7: Phase 7 (Deploy) — en son                  ← tümü bittikten sonra
```

**Paralel çalışabilecek fazlar:**
- Phase 1 (backend) ↔ Phase 4 (frontend) — tamamen bağımsız ✅
- Phase 6 (design frontend) ↔ herhangi bir backend phase ✅
- Phase 2 ↔ Phase 3 ↔ Phase 5 (farklı dosyalar, düşük çakışma riski ⚠️)
- Phase 7 — tek başına, en son

**Not:** Phase 2, 3, 5 aynı anda çalışırsa `analysis.py`'de merge conflict riski var. Art arda veya dikkatli branch ile yapılmalı.

---
*Roadmap created: 2026-05-09*
