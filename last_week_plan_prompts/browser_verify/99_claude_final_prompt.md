# 🎯 Claude'a atılacak son prompt — kalan işler

Şu an `letterboxd_wrapped` repo'sunda `main` branch'indeyiz. Şunlar yapıldı:

- ✅ `desktop_server` (2 share card commit'i) → main'e merge
- ✅ Tech debt: dead code sweep, utcnow fix, print→logger, errors.ts, doc drift, task manager ceiling
- ✅ Working tree temizlendi (smt fixtures, share card spec, gitignore)
- ✅ Story Mode experiment'ten port edildi → main'e merge (265bae9)
- ✅ `main` push edildi, remote güncel

**Kalan işler (sıralı):**

## 1. Render manuel redeploy (ben yapacağım)
Render dashboard → wrapped-backend → Manual Deploy → Deploy latest commit (265bae9). Sonra: `curl https://wrapped-backend.onrender.com/health` ile `backend_git_sha`'yı kontrol et.

## 2. Experiment branch kararı
Story Mode cherry-pick'lendi (`866688c`). Kalan 15 commit ya silinecek ya da tag'le arşivlenecek:
```
git tag archive/experiment-20260721 experiment
git branch -D experiment
git push origin --delete experiment
```

## 3. Windows worker restart (fiziksel makine)
`last_week_plan_prompts/desktop_worker/01_windows_restart.md`'yi aç, adım adım uygula.

## 4. Render env kontrol
Render dashboard'da `WORKER_TOKEN`, `ADMIN_SECRET`, `TMDB_API_KEY` set mi kontrol et.

## 5. Browser E2E (Claude Desktop ile)
`https://movieswrapped.netlify.app`'i aç:
- `semihmutsuz` ile scrape çalıştır
- Results sayfasında tüm bölümler render olmuş mu?
- Story mode (`/story` sayfası) — animasyonlar çalışıyor mu?
- Poster'lar geliyor mu? Console error var mı?
- Mobile viewport'ta responsive mi?
- Her adımda screenshot al

---

**Bir sonraki büyük iş:** Share card redesign + tldraw ile görsel planlama. Bunu Claude Desktop veya AGY üzerinden yapacağım (görsel okuyup anlaman gerektiği için).
