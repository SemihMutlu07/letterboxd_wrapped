# Share Card Overhaul — Spec (Phase 0: Audit + Spec)

Durum: TASLAK — kod değişikliği yok. Bu doküman, mevcut share-card sistemini
denetler ve Semih'in tldraw'da üreteceği pixel-perfect tasarımın implementasyona
nasıl aktarılacağını tarifler. Uygulama fazı bu dosya + tldraw SVG/PNG export'u
alıp kart bileşenlerini üretecek.

---

## 1. Semih'in ürün kararları (FINAL — tartışmaya açık değil)

1. **İki format:**
   - **(a) Instagram Story dikey** (~1080×1920, 9:16) — birincil hedef.
     Başarı kriteri: kullanıcı bunu **gönül rahatlığıyla ve İSTEKLE** paylaşsın.
     Bu bir "yeter ki paylaşılabilir olsun" işi değil, "kullanıcı gurur duysun"
     işi — tasarım kalitesi burada belirleyici.
   - **(b) Twitter/X yatay** (~1200×675, 16:9) — ikincil format.
2. **Varyant sayısı:** Mevcut 3 (gerçekte 4, bkz. §2.1) tasarım varyantı yerine
   **1 varyant (en fazla 2)** × **3 renk şeması** seçeneğine yakınsanacak.
3. **Mobil ve masaüstü için ayrı layout'lar** olacak (aynı bileşenin responsive
   ölçeklenmesi değil, bilinçli olarak ayrı düzenler).
4. **Pixel-perfect görsel tasarım Semih tarafından tldraw'da (offline AppImage)
   üretilecek** ve SVG/PNG export olarak teslim edilecek. İmplementasyon fazı bu
   tasarımı **birebir** yeniden üretmekle yükümlü — kendi yorumunu katmayacak.

---

## 2. Mevcut sistem denetimi (audit)

### 2.1 Dosyalar ve varyant sayısı — DÜZELTME

Görevde "mevcut 3 varyant" deniyor ama kodda **4 varyant** var:

| Key (`ShareVariant`) | Dosya | Etiket (UI) |
|---|---|---|
| `default` | `frontend/src/components/ShareCard.tsx` | "Wrapped" |
| `apple-hig` | `frontend/src/components/share/variants/AppleHIGShareCard.tsx` | "Apple" |
| `editorial` | `frontend/src/components/share/variants/EditorialShareCard.tsx` | "Editorial" |
| `variant-3` | `frontend/src/components/share/variants/Variant3ShareCard.tsx` | (label eksik/kesik satırda) |

`frontend/src/components/share/types.ts` içindeki `ShareVariant` union'ı bundan
da geniş — `'stat-hero' | 'narrative' | 'visual-first' | 'dense-data'` gibi
**hiç implement edilmemiş** değerler de tanımlı. Bunlar ölü tip tanımı; hiçbir
component bu key'leri render etmiyor. Yeni spec'te bu union daraltılacak.

### 2.2 Export mekanizması

- Kütüphane: **`html-to-image`** (`toBlob()`), canvas tabanlı değil — DOM'u
  doğrudan rasterize ediyor.
- Akış (`ShareModal.tsx: handleSavePNG`):
  1. Aktif export kökü `[data-active="true"] [data-export-root="true"]`
     seçicisiyle bulunuyor (her varyant kendi kök div'ine `data-export-root="true"`
     koyuyor).
  2. Export öncesi tüm `<img>` src'leri TMDB doğrudan URL'lerinden backend
     `tmdb-proxy` üzerinden geçirilen "safe" URL'lere değiştiriliyor
     (`shareSafeUrl()`), `crossOrigin="anonymous"` set ediliyor, `img.decode()`
     ile tüm görseller garanti yükleniyor — CORS/tainted-canvas riskini önlemek
     için.
  3. `document.fonts.ready` + 1 `requestAnimationFrame` beklenip `toBlob` çağrılıyor.
  4. Başarısızsa 80ms sonra tek retry.
  5. Sonrasında export sırasında değiştirilen `img.src`'ler orijinaline geri
     alınıyor (finally bloğu).
- Paylaşım/indirme sırası: Web Share API (`navigator.share`) → File System
  Access API (`showSaveFilePicker`) → klasik `<a download>` fallback (iOS'ta
  yeni sekmede açma).

### 2.3 Boyutlar / pixel ratio

- `target` boyutu `ShareModal.tsx:208-212`'de sabit:
  - `horizontal` → **1200×630** (bu OG-image / Facebook standardı, **16:9
    değil** — oran 1.905:1). Semih'in istediği 1200×675 (tam 16:9) ile
    **uyuşmuyor**, yeni spec'te düzeltilmeli.
  - `vertical` → **675×1200** (oran 9:16, doğru — ama hedef 1080×1920'in
    yarısı boyutunda taban alınıyor).
- Gerçek export çözünürlüğü `target.w/h × pixelRatio`. `pixelRatio`,
  `useAdaptivePixelRatio()` (`frontend/src/hooks/useDeviceMemory.ts`) ile
  cihaz belleğine göre adaptif: **1.1 (≤2GB) / 1.25 (≤4GB) / 1.4 (≤8GB) / 1.6
  (>8GB)**.
  - Dikey kartta en yüksek pixel ratio'da (1.6) çıktı **675×1.6=1080 ×
    1200×1.6=1920** — yani tam hedefe (1080×1920) sadece üst-bellek
    cihazlarda ulaşılıyor; düşük bellekli cihazlarda daha düşük çözünürlük
    çıkıyor (örn. 2GB cihazda 742×1320).
  - Bu, "Instagram Story'de gönül rahatlığıyla paylaşılabilir kalite"
    hedefiyle gerilimli: düşük bellekli telefonlarda kalite daha düşük.

### 2.4 Orientation nasıl yönetiliyor

- State `results/page.tsx`'te tutuluyor (`orientation`, default `'vertical'`),
  `ShareModal`'a prop olarak geçiliyor.
- Modal içinde `OrientationToggle.tsx` (46 satır) iki buton (`horizontal`/
  `vertical`) render ediyor; her varyant component'i `orientation` prop'unu
  alıp kendi içinde `isVertical` dalına göre tamamen ayrı JSX ağacı döndürüyor
  (kod tekrarı yüksek — her varyant dosyasında dikey/yatay için iki kez tüm
  layout yazılmış).
- `ScaledCard` wrapper'ı gerçek `target.w × target.h` boyutunda render edip
  `transform: scale()` ile modal içindeki küçük önizleme alanına sığdırıyor —
  export sırasında gerçek boyutta DOM kullanılıyor, transform export'u
  etkilemiyor (`toBlob` `width`/`height` parametreleriyle export köküne göre
  çalışıyor).

### 2.5 Her varyantın render ettiği veri alanları

Ortak veri tipi `ShareCardData` (`share/types.ts`):
`onScreenCrush`, `favoriteDirector` (isim + TMDB headshot + count),
`watchedFilms`, `spentDays`, `spentHours`, `timePercent`, `cinemaScale`,
`personaLabel`, `minutesAverage`, `mostCommonRating`, `peakDecade`,
`peakDecadeCount`, opsiyonel: `topActors[]`, `topDirectors[]` (swap UI için),
`topFilms[]` (poster strip), `topReviewWords[]`, `ratingOutlierFilm`,
`username`.

| Alan | default (ShareCard) | apple-hig | editorial | variant-3 |
|---|---|---|---|---|
| watchedFilms (hero sayı) | ✓ | ✓ | ✓ | ✓ |
| onScreenCrush / favoriteDirector portre | ✓ | ✓ (+PersonSquare dikeyde) | ✓ (VHS glitch efekti crush'ta) | ✓ |
| spentDays / spentHours / timePercent | ✓ (TimeCallout blok) | ✓ (StatTile) | ✓ (StatCell) | ✓ (metin içine gömülü + metrik hücre) |
| cinemaScale | ✓ | ✓ (+ProgressBar component'i var ama kullanılmıyor gibi — kontrol edilmeli) | ✓ | ✓ |
| mostCommonRating | ✓ | ✓ | ✓ | ✓ |
| peakDecade / peakDecadeCount | ✓ (review words yoksa) | ✓ (review words yoksa) | ✓ (her zaman ayrı blok) | ✓ (her zaman ayrı blok) |
| topReviewWords | ✓ (peakDecade yerine geçer) | ✓ (peakDecade yerine geçer) | ✓ (avgRuntime yerine geçer, dikeyde) | ✓ (timePercent yerine geçer, dikeyde) |
| topFilms (poster strip) | ✓ (component var, StatCard'da tanımlı ama JSX'te kullanılmadığını doğrulamak gerek) | ✓ (kullanılıyor, "Top this year") | ✗ kullanılmıyor | ✗ kullanılmıyor |
| ratingOutlierFilm | ✗ | ✓ (OutlierFilmCard) | ✗ | ✗ |
| personaLabel | ✗ kullanılmıyor | ✗ kullanılmıyor | ✗ kullanılmıyor | ✓ (yatayda badge) |
| minutesAverage | ✗ kullanılmıyor | ✗ kullanılmıyor | ✓ (yatayda StatCell, dikeyde review words yoksa) | ✓ (metrik hücre) |
| username | ✓ (@handle, hero'nun yanında) | ✗ kullanılmıyor | ✗ kullanılmıyor | ✗ kullanılmıyor |

Not: `ShareCard.tsx` içindeki `PosterStrip` component'i tanımlı ama JSX
gövdesinde çağrılan yer görünmüyor (satır 55-89 tanım, ama VERTICAL/HORIZONTAL
render bloklarında `<PosterStrip` çağrısı yok) — **muhtemelen ölü kod**,
implementasyon fazında dokunmadan önce doğrulanmalı.

### 2.6 jsdom / test kısıtları (`ShareModal.test.tsx`)

- `html-to-image` tamamen mock'lanıyor (`toBlob: vi.fn()`) — testler gerçek
  rasterization'ı hiç doğrulamıyor, sadece DOM/state doğruluğunu test ediyor.
- jsdom `clientWidth`/`clientHeight`/`getBoundingClientRect()` sıfır döndürdüğü
  için modal'ın rail ölçüm mantığı (`pageW`/`pageH`) manuel mock'lanmak
  zorunda (`beforeEach` içinde `Object.defineProperty` ile 400×700 sabitleniyor).
  Bu olmadan `data-active="true"` hiç set edilmiyor ve export kökü hiç DOM'a
  girmiyor.
- `next/image` mock'lanıyor (`<img>`'e indirgeniyor) — `fill`/`priority` gibi
  Next-specific prop'lar testte anlamsız.
- **Yeni implementasyon bu üç mock deseninden ayrılmamalı**: yeni varyant(lar)
  test edilecekse aynı `ResizeObserver`/`getBoundingClientRect`/`next/image`
  mock iskeletini kullanmalı.

---

## 3. Hangi varyant baz alınmalı? (öneri)

**Öneri: `default` (ShareCard.tsx / "Wrapped") baz alınsın.**

Gerekçe:
- Letterboxd Wrapped ürün kimliğiyle en tutarlı olan (Spotify Wrapped estetiği
  — mor/yeşil gradyan, `GiantNumber`, `TimeCallout`) — "wrapped" hissi en güçlü
  olan bu.
- Tek varyant içinde `username` (@handle) gösteriliyor — paylaşan kişinin
  kimliğini karta bastığı için "bu benim" hissini güçlendiriyor, ki bu tam
  olarak "gönül rahatlığıyla paylaşma" hedefiyle örtüşüyor.
- En sade component ağacı (diğerlerine göre en az özel efekt/hile —
  glitch/scanline gibi VHS efektleri `editorial`'da, apple-hig'in
  minimalizmi kendi başına iyi ama ürün kimliğinden kopuk).

**Kaybedilecekler (diğer 3 varyanttan):**
- `apple-hig`: `ratingOutlierFilm` (kullanıcı puanı vs topluluk ortalaması
  karşılaştırması) — hiçbir başka varyantta yok, veri modelinde mevcut ama
  görsel karşılığı sadece burada var. Ayrıca en disiplinli 8pt spacing/tip
  sistemine sahip; tldraw tasarımı için "sadelik" referansı olarak
  kullanılabilir.
- `editorial`: VHS glitch estetiği (crush portresinde) — kimseye
  zorunlu değil ama görsel olarak en "hatırlanır" olan; ayrıca serif/sans
  karışık tipografi.
- `variant-3`: Letterboxd'un kendi yeşil rengine (`#00c030`) en sadık,
  editoryal/kağıt gibi krem arka plan — kurumsal/"dergi" hissi veren tek
  varyant. Ayrıca `personaLabel` sadece burada gösteriliyor.

Bu üç kayıptan hangisinin yeni tek varyanta (veya renk şeması içine)
taşınacağı §5'teki açık sorularda.

---

## 4. Hedef mimari

### 4.1 Format matrisi

| Format | Boyut | Oran | Not |
|---|---|---|---|
| Instagram Story | 1080×1920 | 9:16 | Birincil; export pixel ratio ile değil, **taban boyut olarak 1080×1920** kullanılmalı (mevcut 675×1200 tabanı ve adaptif pixelRatio yaklaşımı düşük bellekli cihazlarda kaliteyi düşürüyor — bkz. §2.3). |
| Twitter/X | 1200×675 | 16:9 | İkincil; mevcut 1200×630 (OG-image oranı) yerine gerçek 16:9'a düzeltilmeli. |

### 4.2 Varyant × renk şeması

- **1 (max 2) layout varyantı** — Semih'in tldraw tasarımı kaynak.
- **3 renk şeması** — aynı layout, farklı palet (örn. karanlık/nötr, Letterboxd
  yeşili, Semih'in tldraw'da seçeceği 3. seçenek). Renk şeması bir `theme`
  prop'u olarak modellenmeli, ayrı component değil — layout tek yerde.
- Mobil ve masaüstü **ayrı layout** demek: aynı `theme`/veri modeliyle çalışan
  iki farklı JSX ağacı (mevcut sistemin dikey/yatay ayrımına benzer, ama bu
  sefer "hangi cihazdan paylaşılıyor" ekseninde, "hangi sosyal platform"
  ekseninde değil — §5'te netleştirilmesi gereken bir nokta).

### 4.3 Veri modeli

Mevcut `ShareCardData` tipi byüyük ölçüde korunabilir; öneri:
- `ShareVariant` union'ı gerçek kullanılan değerlere daraltılsın (`default`,
  `apple-hig`, `editorial`, `variant-3` yerine yeni tek/iki key + `theme`
  alanı).
- Kullanılmayan alanlar (`personaLabel` eğer yeni tasarımda yoksa) ya
  component'e taşınır ya da tipten çıkarılır — tldraw tasarımı netleşince
  karar verilir.

### 4.4 tldraw → SVG → implementasyon pipeline'ı

Önerilen akış (implementasyon fazı bu adımları izleyecek):
1. Semih tldraw'da (offline AppImage) her format × renk şeması için pixel-perfect
   çerçeveyi çizer (gerçek veri yerine placeholder metin/görsel olabilir).
2. Export: SVG (vektör/metin katmanları için) + PNG (referans/karşılaştırma için).
3. İmplementasyon agent'ı:
   a. SVG'yi ölçüp (Figma/tldraw koordinatları) tam pixel karşılıklarını çıkarır
      (x/y/genişlik/yükseklik/font-size/renk/radius) — bu spec'in "hedef
      mimari" bölümündeki format boyutlarına (1080×1920 / 1200×675) göre
      normalize eder.
   b. Bu ölçümleri React/Tailwind (veya inline style, mevcut kod tabanının
      alışkanlığı) bileşenine birebir aktarır — **yorum katmadan**, mevcut
      `data-export-root="true"` + `forwardRef` deseni korunarak (export
      mekanizması `html-to-image` ile aynı kalacaksa).
   c. Veri bağlama noktaları (hero sayı, crush/director portresi, stat
      hücreleri) `ShareCardData` alanlarına eşlenir; tldraw'daki placeholder
      metin gerçek veriyle değiştirilir.
   d. `ShareModal.test.tsx`'teki mock iskeleti (§2.6) yeni varyant için
      tekrar kullanılır/genişletilir.
4. Doğrulama: yeni component tldraw PNG export'u ile piksel/layout
   karşılaştırması yapılarak (yan yana görsel diff, otomatik olması
   şart değil) kabul edilir.

**Kritik kısıt implementasyon fazı için:** SVG'den birebir üretim demek,
implementasyon agent'ının kendi tasarım tercihini (renk, spacing, font)
katmaması demek — sadece SVG'nin ölçtüğü değerleri kodlaması demek.

---

## 5. Semih'e açık sorular

1. **Mobil/desktop ayrımı hangi eksende?** "Mobil layout" = Instagram Story
   formatının kendisi (zaten dikey, telefon-native), "desktop layout" = Twitter
   formatı mı? Yoksa her iki format da hem mobil hem masaüstü ekranda modal
   içinde önizlenip, "mobil/desktop" ayrı bir üçüncü eksen mi (örn. modal UI'ın
   kendisinin mobilde bottom-sheet, masaüstünde centered modal olması —ki bu
   zaten mevcut `ShareModal.tsx`'te var, §2.4)? Bu belirsizse implementasyon
   fazı yanlış ekseni inşa edebilir.
2. **`ratingOutlierFilm`, `personaLabel`, `topFilms` (poster strip) yeni tek
   varyanta taşınacak mı, yoksa bilinçli olarak feda mı ediliyor?** Bunlar
   §3'te "kayıp" olarak listelendi ama hangisinin gerçekten değerli olduğu
   ürün kararı — tldraw tasarımına başlamadan önce netleşmesi gerekiyor,
   yoksa tasarım veri modelini sığ bırakabilir.
3. **3 renk şeması sabit mi, kullanıcı seçilebilir mi?** Mevcut sistemde
   kullanıcı varyantlar arası swipe/dot-indicator ile geçiş yapabiliyordu
   (`ShareModal.tsx` rail + dots). Yeni sistemde 3 renk şeması arasında da
   aynı seçim UI'ı kalacak mı, yoksa otomatik mi atanacak (örn. kullanıcının
   Cinema Scale'ine göre)?
4. **`username` (@handle) gösterimi korunacak mı?** Sadece `default`
   varyantında var; "gönül rahatlığıyla paylaşma" hedefiyle örtüşüyor ama
   gizlilik açısından (herkese açık paylaşımda username ifşası) Semih'in
   onayı gerekir.
5. **Export mekanizması (`html-to-image` + adaptif pixelRatio) korunacak mı,
   yoksa 1080×1920 sabit taban + tek pixelRatio'ya mı geçilecek?** §2.3'teki
   düşük bellekli cihaz sorunu (Instagram Story kalitesi hedefiyle çelişen
   nokta) implementasyon fazında çözülecekse, bu spec'in kapsamı dışında bir
   performans/kalite kararı — ama onay olmadan varsayılan davranış
   değiştirilmemeli.
6. **Mevcut swap özelliği (crush/director arasında geçiş, `CrushDirectorSwap.tsx`)
   yeni tasarımda kalacak mı?** tldraw tasarımı statik bir çerçeve olacağı
   için, bu interaktif özelliğin yeni layout'ta nasıl yer alacağı (veya feda
   edileceği) belirsiz.

---

## 6. Dokunulmayan / Faz-0 kapsamı dışı

- Hiçbir component dosyası değiştirilmedi, silinmedi.
- `ShareModal.tsx`, `ShareCard.tsx`, `share/variants/*`, `share/types.ts`,
  `results/page.tsx` içindeki wiring aynen duruyor.
- `.gitignore` değişikliğine dokunulmadı (başka bir oturumun elindeki edit
  korunuyor).
- Bu dosya commit edilmedi — inceleme için uncommitted bırakıldı.
