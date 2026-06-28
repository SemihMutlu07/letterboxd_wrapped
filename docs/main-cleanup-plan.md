# Main Branch Cleanup — Berdan Kodlarını Ayırma Planı

## Hedef
Main branch'te yalnızca repo sahibinin (Semih) kodlarını bırakmak, Berdan'ın PR'larını `origin/berdan` branch'ine taşımak.

## Mevcut Durum (2026-06-28)

Main'de karışık olan commit'ler:

| Commit Aralığı | Kime Ait | İçerik |
|---|---|---|
| `4f112e2` → `54c99eb` | Berdan 🟠 | PR #11: neo-brutalist design (WrappedBrutal.jsx, landing/watchlist redesign) |
| `423648c` → `0f5baee` | Berdan 🟠 | Dead code sweep (main'deki c2eae18 ile çakıştı) |
| `3519d53` | Fix ⚪ | Merge sonrası temizlik (PersonFilmsModal sil, page.tsx trim) |
| `b15d915` → `70364d2` (24 commits) | Semih 🟢 | Feedback work: data integrity, share modals, analytics, wait UX |
| `c2eae18`, `7751ce8`, `902c8c2`, `b76ca3f`, `e2ed510`, `120929d` | Semih 🟢 | Dead code sweep, worker controls, admin dashboard |
| `f9ed69c` (via `e44b8ab`) | Semih 🟢 | desktop_server merge (worker guide, null guards) |
| `b58586e` | Semih 🟢 | CLAUDE.md contribution workflow |

## Kritik Bilgiler

- Feedback branch (`70364d2`) base'i = `29e1517` — **Berdan'dan bağımsız**, eski results page üzerine yazılmış
- Feedback branch eski results page'e FeedbackFab, ShareModal, PostHog eklemiş — WrappedBrutal kullanmıyor
- 44ba95a (pre-Berdan) = 29e1517 + README docs

## Adım Adım Cleanup

### 1. Yedekle
```bash
git tag backup/main-temizlik-oncesi main
git push origin backup/main-temizlik-oncesi
```

### 2. Eski main'i Berdan branch'ine kopyala
```bash
git branch -f berdan-temizlik main
git push origin berdan-temizlik
```

### 3. Temiz main oluştur (pre-Berdan + feedback work + admin/worker)
```bash
# Pre-Berdan state'den başla
git checkout -b clean-main 44ba95a

# Feedback branch'ini merge et (ortak ancestor = 29e1517)
# Conflict olursa: README.md ve backend/.env.example'de (44ba95a vs 8f1bb1f)
# Feedback branch'in versiyonlarını tercih et (daha kapsamlı)
git merge 70364d2

# Admin/worker/dead-code-sweep commit'lerini cherry-pick
git cherry-pick c2eae18
git cherry-pick 7751ce8
git cherry-pick 902c8c2
git cherry-pick b76ca3f
git cherry-pick e2ed510
git cherry-pick 120929d
git cherry-pick f9ed69c
git cherry-pick b58586e

# Her adımda derleme kontrolü
cd frontend && npx tsc --noEmit
cd backend && pytest
```

### 4. Force-push
```bash
# clean-main'i main olarak force-pushla
git push origin clean-main:main --force

# Berdan'ın eski branch'ini güncelle
git push origin berdan-temizlik:berdan --force
```

### 5. Temizlik
```bash
git checkout main
git branch -D clean-main
```

## Beklenen Sonuç

- `main` → eski results page + FeedbackFab/ShareModal/PostHog çalışır ✅
- `origin/berdan` → WrappedBrutal.jsx + neo-brutalist design ✅
- Berdan branch'ine sonra `git merge origin/berdan` ile temiz merge yapılabilir

## Riskler

- Force push: Berdan'ın local clone'u bozulur. Ona haber verilmeli.
- README.md conflict çözümü: feedback branch versiyonu tercih edilmeli.
- Bunu yapmadan ÖNCE backend/.env'deki gerçek API key'lerin yedeğini al.