# Agent Instructions — Movies Wrapped (Letterboxd Wrapped)

You are working in a fork-based contribution repo. Read these two files before
making any change:

1. **[CONTRIBUTING.md](CONTRIBUTING.md)** — branch strategy, PR workflow,
   rebase-before-PR rule, PR readiness checklist, and the merge mistakes that
   must not repeat. This is the contract for every external PR.
2. **[CLAUDE.md](CLAUDE.md)** — repo map, API surface, environment variables,
   and hard constraints. Written for the maintainer's tooling but accurate for
   everyone.

## Non-negotiable rules (summary — details in the files above)

- One PR = one scope. If your PR rewrites a page shell, it must integrate or
  explicitly defer every feature that lived in the old shell.
- Rebase onto latest `origin/main` before opening a PR. Squash-merge lands it.
- `frontend/` is a static Next.js export (`output: 'export'`) — no SSR-only
  features, no runtime server dependencies.
- Never commit `.env` files, secrets, or API keys. TMDB key lives on the
  backend only; Supabase uses the anon (publishable) key only.
- Commit messages in English, conventional commits (`feat:`, `fix:`, ...).
- Before claiming done: `cd frontend && npx tsc --noEmit` and
  `cd backend && python3 -m pytest` must pass.
