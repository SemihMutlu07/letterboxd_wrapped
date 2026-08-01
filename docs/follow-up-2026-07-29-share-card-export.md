# Follow-up — Movies Wrapped ShareCard Export

> Tarih: 2026-07-29
> Branch: `fix/share-card-export-ux`
> Durum: Kod review'u yeşil; manuel `/smt` kontrolü ve commit kararı bekliyor.

## Amaç

Mevcut ShareCard export düzeltmesini güvenle kapat. Görsel varyant kararını veya
yedi kartlık sistemi yeniden tasarlama; bu dalın kapsamı yalnız export
güvenilirliği ve doğru analytics davranışı.

Buradaki **Focus adımı** ayrı bir ürün özelliği değil: terminali açınca yapılacak
tek somut hareket, `/smt` üzerinde Story ve X export'unu elle doğrulamak.

## Mevcut diff

Takip edilen dört dosya:

- `frontend/src/components/ShareModal.tsx`
- `frontend/src/components/share/ShareModal.test.tsx`
- `frontend/src/containers/results/ResultsContent.tsx`
- `frontend/src/containers/results/sections/ShareModalDynamic.test.tsx`

Yapılanlar:

- Sistem paylaşımı veya dosya seçici iptali artık başarı sayılmıyor.
- `share_export_started/succeeded/failed/cancelled` gerçek export sonucunda
  ve tek yerden üretiliyor; modal açılışı `share_modal_opened`.
- Export hatası kullanıcıya tekrar denenebilir mesaj olarak gösteriliyor.
- Export sürerken modalı kapatan veya aktif kartı değiştiren kontroller kilitli.
- Restore işlemi export başlangıcında yakalanan aynı DOM köküne uygulanıyor.
- Story/X ve aktif varyant etiketi daha açık; ilgili native durumlar
  `aria-pressed` / `aria-current` ile belirtiliyor.

## Bu oturumda doğrulanan

```bash
cd /home/parkermutsuz/dev/letterboxd_wrapped/frontend
npx vitest run src/components/share/ShareModal.test.tsx src/containers/results/sections/ShareModalDynamic.test.tsx
# 2 test dosyası, 15/15 test geçti

npx tsc --noEmit
# exit 0

cd ..
git diff --check
# exit 0
```

Önceki checkpoint'te Playwright export matrisi 14/14 geçmişti; doğru PNG
boyutlarını kontrol ediyor fakat committed görsellerle pixel karşılaştırması
yapmıyor. Bu oturumda Playwright yeniden çalıştırılmadı.

## Terminali açınca

```bash
cd /home/parkermutsuz/dev/letterboxd_wrapped
git status --short --branch
nvim docs/follow-up-2026-07-29-share-card-export.md

cd frontend
npm run dev:frontend
```

Tarayıcıda `http://localhost:3000/smt`:

1. Story ve X formatında birer PNG üret.
2. Doğru aktif kartın export edildiğini ve görsellerin export sonrası
   bozulmadan geri geldiğini kontrol et.
3. Export sürerken kapatma, varyant ve orientation kontrollerinin kilitli
   kaldığını gözle.
4. Başarılı export'un feedback yüzeyini yalnız bir kez açtığını kontrol et.
5. Mobil paylaşım veya masaüstü dosya seçiciyi iptal edebiliyorsan iptalin
   başarı/feedback üretmediğini kontrol et.

## Commit sınırı

Kullanıcıya ait aşağıdaki untracked çalışmalar bu fix'e eklenmeyecek,
silinmeyecek veya düzenlenmeyecek:

- `frontend/scripts/capture-after.mjs`
- `frontend/scripts/capture-audit-screenshots.mjs`
- `frontend/scripts/capture-before.mjs`
- `frontend/scripts/capture-mockups.mjs`
- `frontend/scripts/capture-redesign-after.mjs`
- `frontend/src/app/dev/hero-mockups/`
- `graphify-out/`

Manuel kontrol geçerse dar testleri tekrar çalıştır, yalnız ilgili diff'i
incele ve commit için Semih'in açık kararını al. Push/deploy ayrı onay ister.

Analytics notu: bağlı PostHog projesi hâlâ Madlen Teacher olabilir. Event
kodunun doğruluğu bu fix'in parçası; Movies Wrapped kullanım verisini gerçekten
ölçmek için doğru PostHog proje bağlantısı ayrıca doğrulanmalı.

## Bu işten sonra — repo dışı gündem

`/ultra` açmadan, kısa ve kanıta bağlı biçimde:

1. Mevcut otomasyon süreçlerinde hangilerinin gerçekten finalize edilmesi
   gerektiğini çıkar.
2. AgentMemory'nin zayıf temellerini — source-of-truth, stale durum,
   onaysız write ve eksik outcome kanıtı — tek tek sağlamlaştır.
3. AgentMemory'nin otomasyona faydasını “daha çok agent” olarak değil;
   doğru aday, insan review'u, güvenli Focus ve kanıtlı Outcome hattı olarak
   değerlendir.
