# intent — chore/repo-hygiene

## Bağlam
Repo root’ta ürün kodu olmayan agent/tool/scratch dosyaları birikmiş; GitHub
dosya ağacı kalabalık. Ayrı olarak `/smt` local fixture eksik medya yüzünden
canlı test zorunlu kılıyordu.

## Hedef
1. Semih’in bu branch’te root hygiene temizliği yapabilmesi.
2. `/smt` offline: semihmutsuz analiz + poster/profil medyası local.

## Kullanıcı
Repo sahibi (Semih) — local Story/Results QA.

## Başarı kriteri
- Branch push edilmiş, Semih checkout edip çalışabiliyor.
- `/smt` → results: film posterleri, yönetmen portreleri local `/demo/smt-media`.
- Root clutter silinmeden önce listelenmiş (bu dosyada).

## Kapsam dışı (şimdilik silme yok — Semih onayı)
Aday clutter (main’de duruyor, bu branch’te temizlenebilir):
- `.agent/`, `.claude/`, `.cursor/`, `.deepsec/`, `.foglamp/`, `.pi/`, `.planning/`
- `_screenshots/`, `SCRATCHPAD.md`, `CHECKPOINT-AEO-SEO.md`, `NOTES.md`
- `TECH_DEBT_AUDIT.md` (taşınabilir `docs/`), boş `grep` dosyası
- root `node_modules/` (gitignore’a eklenmeli), `tmdb_cache/`, `uploads/`, `runs/` (zaten local artifact)

Tutulmalı: `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, `backend/`, `frontend/`, `docs/`, `.github/`, `netlify.toml`

## Riskler
- Büyük `public/demo/smt-media` commit boyutu (~26MB).
- Actor profile_path scrape’te boş olanlar local’de de boş kalır (kaynak veri).

## Durum
- [x] Branch: `chore/repo-hygiene`
- [x] Fixture refresh + full media localize
- [ ] Root clutter silme (Semih)
