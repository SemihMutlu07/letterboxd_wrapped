# Toparlama Planı — 2026-08-01

> Kaynak: Semih'in bu tarihte paylaştığı 9 fazlık plan (muhtemelen Fable'da taslaklandı).
> Bağlam: `0924309` (restore-features) → `f101ce5` (revert) — hızlı restore yerine önce
> prototip onayı seçildi. Durable ledger olarak burada tutuluyor; session'lar arası kaybolmasın.

## Sıra

1. **Feature Recovery Lab prototipi** — ✅ 2026-08-01, `frontend/src/app/dev/feature-recovery-lab/page.tsx`
   (dev-only route, production'a bağlı değil). Kapsar: AppHeader+nav, dönem seçici, üç
   non-blocking consent yaklaşımı (**hiçbiri modal değil** — bkz. memory
   `feedback_no-consent-modals-ever`), ShareModal swap paneli konumlandırma, longest_review
   fallback, canonical/OG açıklaması. `npx tsc --noEmit` temiz, sayfa `localhost:3000/dev/feature-recovery-lab`
   üzerinde doğrulandı (get_page_text + console temiz).
2. **Admin sayfalarının ayrılması** — ✅ 2026-08-01. `backend/app/admin.py` + `templates/`:
   tek `admin_dashboard.html` (799 satır, tab-switch JS) yerine `admin_base.html` (paylaşılan
   sol-nav layout) + `admin_js_common.html` (paylaşılan JS partial) + 5 sayfa
   (`admin_overview.html` özet kartlar, `admin_analysis.html`, `admin_worker.html`,
   `admin_compare.html`, `admin_date_night.html`) — route'lar: `/admin/dashboard` (özet),
   `/admin/analysis`, `/admin/worker`, `/admin/compare`, `/admin/date-night`. Backend API
   yüzeyi değişmedi (`/admin/api/runs`, `/admin/api/worker` aynı kaldı, her sayfa kendi 15s
   poll'unu yapıyor). `admin_run.html`'deki geri-dön linkleri `/admin/analysis`'e güncellendi.
   Eski `admin_dashboard.html` silindi. `tests/test_worker.py` içindeki 2 test yeni route'lara
   retarget edildi (`/admin/worker`, `/admin/analysis`); `tests/test_admin_incidents.py`
   değişmedi (Overview hâlâ aynı loader'ları çağırıyor). 305 backend test ✅, 5 route de dev
   server'da manuel doğrulandı (200 + doğru içerik + doğru nav-active state).
3. Durable task/run/attempt altyapısı — açık
4. Cihaz ve başarısız deneme görünümü — açık
5. Prototip onaylı altı regresyon düzeltmesi — **Semih'in prototip onayını bekliyor**
6. Most Loyal Fan canlı-veri teşhisi — açık
7. TMDB poster eşleştirmesi — açık
8. ShareCard hızlı görsel akışı — açık
9. Progressive Story ve performans düzeltmeleri — açık

## Notlar

- `0924309`'un diff'i, adım 5'teki altı düzeltmenin çoğu için zaten çalışan referans kod
  içeriyor (git history'de duruyor, henüz production'a uygulanmadı).
- Eski blocking consent modal (`fix/share-card-export-ux` dalındaki `PreResultsConsentModal.tsx`)
  kesinlikle geri getirilmeyecek — bkz. memory `feedback_no-consent-modals-ever`.
