# Landing Page Refactor + Loading Screen Fun Messages

## 1. Landing Page (`frontend/src/components/LetterboxdLanding.tsx`)
- [ ] Username card'ı daha welcoming yap → başlık güncelle, vizual hierarchy
- [ ] Upload export butonunu landing page'den kaldır / minimal ghost link yap
- [ ] Compare watchlists linkini aynı satıra al
- [ ] ExportInstructions + UploadZone modal içinde kalıyor — dokunulmuyor

## 2. Loading Screen (`frontend/src/components/landing/LoadingScreen.tsx`)
- [ ] Scrape modunda `displayMessage` ile progress bar arasına rastgele mesaj yerleştir
- [ ] Her 6s bir rotate eden `funMessages` state + placeholder array
- [ ] Placeholder mesajlar: user sonradan ekleyecek

## 3. Verify
- [ ] `cd frontend && npx tsc --noEmit`
- [ ] `cd frontend && npm run build`
