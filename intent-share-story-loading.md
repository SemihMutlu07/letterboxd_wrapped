# intent — share / story / loading (park 2026-08-14)

Pazartesi dönüş notu. Branch: `fix/share-card-legibility`. Commit var, PR yok (karışık scope).

## Bağlam
Letterboxd scrape → loading → story → results. Bu turda poster/yönetmen bug’ları, story görselleri, worker stage’lerini loading bar’a bağlama ve mobil lab konuşuldu.

## Hedef
- Share kartı okunabilir
- Yanlış/eksik poster ve yönetmen fotoğrafı düzelsin
- Story posterleri dikey aksın, yönetmen sahnesi label → portre → split
- Loading, 30 sn saat değil worker `trace_events` sırası
- Mobil kompozisyon lab’de seçilsin, sonra ürüne girsin

## Kullanıcı
Tek el telefon: scrape beklerken “ne oluyor?” görünsün. Story kişisel slayt — analiz bitmeden başlamaz.

## Başarı
- Highest Rated’de yönetmen/oyuncu fotoğrafı (cached `onLoad` dahil)
- Yeraltı / Kader doğru TMDB poster
- Story: dikey akış, sarı tap-zone yok, pause animasyonu durdurur
- Scrape bar stage’den dolar; “Kalan 30s” yok
- Mobil kazanan lab’de seçilmiş, ürün koduna henüz girmemiş

## Kapsam dışı
- Story-as-loading: **KILL**. Stats yokken kişisel story yok.
- p50/p90 ETA etiketi: **DEFER**
- Bu branch’ten tek PR: hayır, split et

## Durum ve kanıt
Kod diskte + bu branch commit’inde.

**Bitti (unverified on device)**
1. Share: tune popover Story/Landscape’i örtmesin (`FloatingPanel` + test)
2. `mergePersonProfiles` + PersonCard cached image
3. TMDB: slug + Türkçe `_norm_title` fold; fixture Yeraltı/Kader
4. Story: `VerticalPosterFlow`, yönetmen timing, sarı outline, w342 / lazy
5. Loading: `scrapeProgress.ts` — diary∥grid∥reviews ağırlıklı bar; i18n stage metinleri

**Yarım — pazartesi ilk iş**
1. Lab’de kazanan seç: 390 Loading → Dock mu HUD mu? (aday: 390 Dock, 768+ Split)
2. Lab dosyası (movieswrapped repo’sunda değil):
   `/home/parkermutsuz/dev/design-tool-lab/public/mw-mobile-lab.html`
   Aç: `xdg-open /home/parkermutsuz/dev/design-tool-lab/public/mw-mobile-lab.html`
   design-tool-lab index kirli; HTML ayrı commit / dosya olarak duruyor. `page.tsx`/`layout.tsx` lab restyle’ına karışmasın.
3. tldraw Desktop kapalıydı (`localhost:7236` yok). Akış çizimi için uygulamayı aç, sonra agent’a söyle.
4. PR öncesi split: share-card | TMDB+photos | story visuals | loading stages
5. Görsel QA: `/smt` story + gerçek scrape loading

## Risk
- Branch adı share-card; içinde dört konu var. Squash-merge = scope karmaşası.
- design-tool-lab `main`’de başka dirty work var — sadece `mw-mobile-lab.html` bu işe ait.
