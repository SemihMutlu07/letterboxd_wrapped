# Requirements: Movies Wrapped

**Defined:** 2026-05-09
**Core Value:** Kullanıcının Letterboxd verisinden anlamlı, görsel olarak etkileyici ve paylaşılabilir bir film istatistik özeti çıkarmak.

## v1 Requirements

### Image Fix — Directors & Cast

- [ ] **IMG-01**: Director'lar (top 20) için TMDB person search yapılıp profile_path backend'de çekilsin
- [ ] **IMG-02**: Actor'lar (top 20) için TMDB person search yapılıp profile_path backend'de çekilsin (şu an sadece top 3)
- [ ] **IMG-03**: Frontend image loading stratejisi sağlamlaştırılsın (timeout, retry, onError fallback ile placeholder)

### Poster Strategy

- [ ] **IMG-04**: TMDB poster sorgu stratejisi iyileştirilsin — alternatif poster (english/backdrop) dene
- [ ] **IMG-05**: Letterboxd vs TMDB poster farkı analiz edilip çözüm üretilsin

### Review Text Analysis

- [ ] **REV-01**: Mevcut review_analysis.py (342 satır) backend analysis pipeline'ına bağlansın
- [ ] **REV-02**: Review metrikleri frontend'de gösterilsin (WritingStats, WordCloud, LanguageTimeline)

### Mobile Responsive + Share UX

- [ ] **MOB-01**: Tüm results section component'ları mobile responsive hale getirilsin
- [ ] **MOB-02**: Film history & rating patterns mobile'da düzgün görünsün
- [ ] **MOB-03**: Share wrapped mobile'da pinch-to-zoom touch gesture çalışsın
- [ ] **MOB-04**: Share wrapped actor/director diversity seçilebilir/tıklanabilir olsun (şu an statik etiket)

### Error Logging & Analytics

- [ ] **LOG-01**: Backend error logging altyapısı kurulsun (image load failure, analysis errors)
- [ ] **LOG-02**: Kullanıcı analytics tracking (consent-free: film_count, hata sayısı, kullanılan browser) Supabase'e yazılsın
- [ ] **LOG-03**: Frontend image load hataları (onError event) backend'e raporlansın

### Design Integration

- [ ] **DSG-01**: Mevcut 3-4 tasarım prototipi gösterilip karar verilsin
- [ ] **DSG-02**: Seçilen tema CSS variable'larına dönüştürülüp tüm component'lara entegre edilsin

### Deployment

- [ ] **DEP-01**: Supabase geçerli proje URL'si ile güncellensin + tablolar oluşturulsun
- [ ] **DEP-02**: Backend (FastAPI) Render Web Service'e deploy edilsin
- [ ] **DEP-03**: Frontend (Next.js statik export) Netlify'a deploy edilsin

## v2 Requirements

- **Easter egg'ler** (Trainspotting özel ekranı, klasik film arka plan müziği) — uzun vadeli
- **Review HTML scraper** — CSV path çalıştıktan sonra scrape path de eklensin
- **Community / social features** — wrapped paylaşımı, karşılaştırma

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Kullanıcı auth / hesap sistemi | MVP'de gerekli değil, localStorage yeterli |
| Easter egg'ler | Uzun vadeli feature, şimdilik plan dışı |
| Çoklu platform (IMDb, Trakt) | Sadece Letterboxd |
| Community / sosyal özellikler | Core value dışı |
| CI/CD pipeline | Elle deploy yeterli şimdilik |

## Traceability

| Requirement | Phase | Status |
| ----------- | ----- | ------ |
| IMG-01 | Phase 1 | Pending |
| IMG-02 | Phase 1 | Pending |
| IMG-03 | Phase 1 | Pending |
| IMG-04 | Phase 2 | Pending |
| IMG-05 | Phase 2 | Pending |
| REV-01 | Phase 3 | Pending |
| REV-02 | Phase 3 | Pending |
| MOB-01 | Phase 4 | Pending |
| MOB-02 | Phase 4 | Pending |
| MOB-03 | Phase 4 | Pending |
| MOB-04 | Phase 4 | Pending |
| LOG-01 | Phase 5 | Pending |
| LOG-02 | Phase 5 | Pending |
| LOG-03 | Phase 5 | Pending |
| DSG-01 | Phase 6 | Pending |
| DSG-02 | Phase 6 | Pending |
| DEP-01 | Phase 7 | Pending |
| DEP-02 | Phase 7 | Pending |
| DEP-03 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-09*
*Last updated: 2026-05-09 after initialization*
