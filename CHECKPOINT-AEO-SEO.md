# MOVIES WRAPPED SEO/AEO — DURUM (2026-08-05 güncelleme)

> Bu dosya 2026-08-01'de yazılmıştı (context sıfırlama checkpoint'i olarak).
> **08-05 tespiti: içerik artık geçersiz — SEO/AEO zaten kodda tamamlandı.**

## GÜNCEL DURUM (08-05)

- **PR #63 (feat/landing-seo), #64 (i18n results), #65 (AEO FAQ JSON-LD) → MERGED (08-03)**
- `app/robots.ts` + `app/sitemap.ts` (Next.js native, PR #63) — benim yazdığım
  public/robots.txt + sitemap.xml'i süperede etti; daha iyi (results Disallow,
  hreflang, Lighthouse SEO 100/100)
- `llms.txt` + `.well-known/ai.txt` → HEAD'de committed
- i18n: `/en` `/tr` route'ları + locale metadata → HEAD'de (PR #64)

## KALAN TEK İŞ: DEPLOY

Canlı site (movieswrapped.com) hâlâ eski:
- robots.txt/sitemap.xml/llms.txt/ai.txt → 404
- /en /tr → 404
- eski metadata (twitter:card=summary, eski title)

Netlify deploy tetiklenmeli → sonra curl doğrulama → geo audit skoru.

## GEÇMİŞ KAYIT (01-08 checkpoint, tarihsel)

- 4 AEO dosyası yazıldı (robots/llms/ai/sitemap) → PR #63 ile süperede edildi
- layout.tsx metadata → RootDocument + [locale]/layout.tsx'e taşındı
- Öncesi AEO skoru: 20/100 (critical) → deploy sonrası yeniden ölçülecek
- tsc + build temiz (defalarca doğrulandı)

## YAPILACAKLAR (orchestrator'a gitti)

1. Window 2 (revize): build doğrula → Netlify deploy → curl 200 kontrolü
2. Sonrası AEO skoru: `uvx --from geo-optimizer-skill geo audit --url https://movieswrapped.com`

## RE-VERIFY (08-07)

Kod tarafı doğrulandı — #63/#64/#65 + ea01675 hepsi main'in ancestor'ı
(`git merge-base --is-ancestor` ile teyit edildi). Canlı site hâlâ eski:

```
404   https://movieswrapped.com/robots.txt
404   https://movieswrapped.com/sitemap.xml
404   https://movieswrapped.com/llms.txt
404   https://movieswrapped.com/.well-known/ai.txt
404   https://movieswrapped.com/en
404   https://movieswrapped.com/tr
```

Ayrıca ana sayfa HTML'i hâlâ eski landing (period selector dropdown dahil —
bu session'da koddan zaten kaldırılmıştı) ve eski metadata (`twitter:card=summary`,
eski title) gösteriyor. Netlify auto-deploy GitHub push'una tepki vermiyor gibi
görünüyor — local'de netlify CLI/site linki yok, bu yüzden deploy tetiklemesi
Semih'in Netlify dashboard'undan yapılması gerekiyor.
