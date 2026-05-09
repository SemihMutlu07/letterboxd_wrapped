# Movies Wrapped (Letterboxd Wrapped)

## What This Is

Letterboxd kullanıcılarının film izleme alışkanlıklarını analiz eden, "wrapped" tarzı görsel bir istatistik özeti. Kullanıcı Letterboxd CSV export'u yükler veya kullanıcı adını girerek profilini çektirir, karşılığında yıllık film istatistiklerini (türler, yönetmenler, oyuncular, cinema scale puanı, vs.) görür.

## Core Value

Kullanıcının Letterboxd verisinden anlamlı, görsel olarak etkileyici ve paylaşılabilir bir film istatistik özeti çıkarmak.

## Requirements

### Validated

- ✓ Kullanıcı CSV/ZIP export yükleyebilir — existing
- ✓ Kullanıcı username ile profil çektirebilir (scraper) — existing
- ✓ Backend film verisini TMDB'den zenginleştirir — existing
- ✓ Cinema Scale (Shannon entropy) hesaplanır — existing
- ✓ Temel istatistikler gösterilir (tür, yıl, yönetmen, oyuncu, ülke, dil) — existing
- ✓ Share card'lar oluşturulup PNG export edilebilir — existing
- ✓ Watchlist compare / date-night araçları — existing
- ✓ Supabase + PostHog entegrasyonu — existing
- ✓ Static export Next.js, Netlify'da — existing

### Active

- [ ] **IMG-01**: Director'lar için TMDB profile_path backend'de çekilsin (top 20)
- [ ] **IMG-02**: Actor'lar için TMDB profile_path top 20'nin tamamına çekilsin (şu an sadece top 3)
- [ ] **IMG-03**: Frontend image loading stratejisi sağlamlaştırılsın (onError fallback, retry, timeout)
- [ ] **IMG-04**: TMDB poster sorgu stratejisi iyileştirilsin, alternatif posterler dene
- [ ] **IMG-05**: Letterboxd-TMDB poster farkı analiz edilip çözüm üretilsin
- [ ] **REV-01**: Mevcut review_analysis.py (342 satır) backend pipeline'ına bağlansın
- [ ] **REV-02**: Review text metrikleri frontend'de gösterilsin (WritingStats, WordCloud, LanguageTimeline)
- [ ] **MOB-01**: Tüm results component'ları mobile responsive hale getirilsin
- [ ] **MOB-02**: Film history & rating patterns mobile'da düzgün görünsün
- [ ] **MOB-03**: Share wrapped mobile'da pinch-to-zoom ile çalışsın
- [ ] **MOB-04**: Share wrapped'de actor/director diversity seçilebilir/tıklanabilir olsun
- [ ] **LOG-01**: Backend error logging altyapısı kurulsun (yüklenmeyen resim, analiz hataları)
- [ ] **LOG-02**: Kullanıcı analytics tracking (consent-free) Supabase'e yazılsın
- [ ] **LOG-03**: Frontend image load hataları (onError) backend'e raporlansın
- [ ] **DEP-01**: Supabase URL güncellensin + geçerli projeye bağlansın
- [ ] **DEP-02**: Backend Render'a deploy edilsin
- [ ] **DEP-03**: Frontend Netlify güncellensin
- [ ] **DSG-01**: Tema/design prototipleri gösterilip karar verilsin
- [ ] **DSG-02**: Seçilen tema CSS variable'larına dönüştürülüp entegre edilsin

### Out of Scope

- Kullanıcı hesabı / auth sistemi — MVP'de gerekli değil
- Easter egg'ler (Trainspotting özel ekranı, klasik film arka plan müziği) — uzun vadeli feature
- Çoklu platform desteği (IMDb, Trakt) — şimdilik sadece Letterboxd
- Community / sosyal özellikler — wrapped şu an bireysel
- Gerçek zamanlı chat / bildirimler — core value dışı

## Context

**Teknik ortam:**
- Frontend: Next.js 15 (App Router), React 19, TypeScript, TailwindCSS, Recharts, Framer Motion
- Backend: Python, FastAPI, Uvicorn, pandas/numpy, aiohttp/aiofiles
- Scraper: BeautifulSoup4 + lxml + cloudscraper (Cloudflare fix)
- Database: Supabase (user_sessions, analysis_runs, feedback)
- Analytics: PostHog (consent-gated)
- Deployment: Frontend Netlify (static export), Backend Render (Docker, deploy edilmedi)

**Mevcut kod durumu:**
- Backend modular: routes/, services/, models/, task_manager.py, config.py
- Frontend: landing, results, watchlist sayfaları, share card'ları, experimental/test lab
- localStorage bridge: landing → results (backend polling ile)
- Supabase konsol hatası: `.env.local`'deki Supabase URL eski/donmuş proje (DNS çözülmüyor)
- `review_analysis.py` yazıldı (342 satır) ama pipeline'a bağlı değil

**Bilinen sorunlar:**
- Director/cast profile_path TMDB'den çekilmiyor (back-end analysis.py:661)
- TMDB poster'ları Letterboxd'daki posterlerle bazen uyuşmuyor
- Supabase URL çalışmıyor (ERR_NAME_NOT_RESOLVED)
- Test coverage ince (özellikle analysis pipeline)

## Constraints

- **Static Export**: Frontend `output: 'export'` — API route'ları runtime'da çalışmaz, image optimization kapalı
- **Single Worker**: Backend in-memory task_state — horizontal scaling yok, deploy tek instance
- **TMDB Rate Limit**: 25 req/s, deque ile pacing
- **No CI/CD**: GitHub Actions yok, build verification elle

## Key Decisions

| Decision | Rationale | Outcome |
| -------- | --------- | ------- |
| Cahiers Riso theme aday | Editörü dergi estetiği, rakiplerden ayrışır | - Pending (tema seçilmedi) |
| Reviews CSV path önce | Daha az kırılgan, export'ta zaten var | ✓ Decision logged (deferred) |
| Supabase SQLite'a geçilmiyor | Mevcut schema 10k+ kullanıcıya kadar yeterli | ✓ Good |
| Statik export | Netlify $0, hızlı deploy | ✓ Good |
| Film verisi JSONB'de | 50k kullanıcı × 400 film = 20M satır olmaz | ✓ Good |

---
*Last updated: 2026-05-09 after initialization*
