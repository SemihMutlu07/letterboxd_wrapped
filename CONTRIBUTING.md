# Contributing to Movies Wrapped (Letterboxd Wrapped)

## Branch strategy

- **Fork-based**: Contributors fork the repo and work on their own fork. No direct pushes except by repo owner.
- **Owner branches**: Owner may use `main`, `desktop_server` (worker sync), or short-lived feature branches locally.

## Workflow for external PRs

1. Contributor forks → creates a feature branch (e.g. `feat/widget-redesign`)
2. Before opening a PR, contributor **rebases onto latest `origin/main`** and resolves all conflicts locally
   ```
   git fetch upstream
   git rebase upstream/main
   ```
3. PR is opened against `main`. Squash-merge preferred (single commit lands on main).
4. After merge, contributor deletes their remote feature branch.

## What went wrong before (so it doesn't repeat)

- **Dead code sweep done twice**: Once on main (`c2eae18`), once on Berdan's branch (`423648c`). The merge brought back old Test Lab files that main had already cleaned. Solution: always rebase before PR, and keep sweeping decisions on main, not in PR branches.
- **RSS subsystem resurrection**: The Berdan merge conflict resolution accidentally preserved dead files. Solution: after merging a PR, run a quick `find` check for known-dead patterns (RSS, Sentry, etc.).
- **Experimental tree vs redesign**: Berdan's PR (#11) replaced `results/page.tsx` with `WrappedBrutal.jsx`. Concurrent feedback features (FeedbackFab, ShareModal, PostHog) became dead code because they lived in the old page. Solution: **one PR = one scope**. If a PR rewrites the page shell, it must either integrate or explicitly defer existing features.

## PR readiness checklist

Before opening a PR, verify:
- [ ] `git rebase origin/main` done, no conflicts
- [ ] `cd frontend && npx tsc --noEmit` passes
- [ ] `cd backend && pytest` passes (or known pre-existing failures documented)
- [ ] No `.env`, secrets, or credentials in the diff
- [ ] Commit messages in English
- [ ] No deleted files that are still referenced by live code (check with `rg`)

## Local development

Frontend:
- `cd frontend && npm run dev:frontend`

Backend:
- Preferred: `npm run dev:backend` (from frontend scripts; defaults to port 8000, override with `BACKEND_PORT`)
- Alternative: `cd backend && python app/main.py` (port 8000)

Both:
- `npm run dev` (sets `NEXT_PUBLIC_API_BASE` from `BACKEND_PORT`)

## AI workflow

When implementing a change:
1. Locate and open the relevant file(s) first.
2. Propose the smallest safe change.
3. Implement and keep formatting consistent.
4. Update any related types/helpers/tests if applicable.
5. If the change touches analytics or DB: ensure consent gating and no secret leakage.

## Hard constraints

- `next.config.ts` has `output: 'export'`: do NOT add server-only features or assumptions.
- Never write `.env` values into files. Never commit secrets.
- Commit messages must be in English.
- Supabase: use ANON/public key only in frontend. Never introduce service_role keys.
- PostHog: client key only in frontend; keep consent gating consistent and default-safe.
- TMDB: key lives on backend; do not proxy it to the frontend.
