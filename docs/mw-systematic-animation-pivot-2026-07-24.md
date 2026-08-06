# Movies Wrapped — Systematic Animation/Interaction Pivot (2026-07-24)

Raw request, saved verbatim-in-spirit before implementation starts, so it can be
picked up in a fresh chat/session without re-deriving context (same pattern as
`docs/desktop-server-feedback-2026-07-12.md`).

## Why this doc exists

We spent a session building 6 standalone HTML/JS "test bench" artifacts in the
sibling repo `~/dev/design-tool-lab` to evaluate design tools (Canvas UI,
itshover, Amicro, UI Presentation Lab, Impeccable, Emil Kowalski's
`review-animations` skill) in isolation. User feedback on that work: the
isolated benches don't test the real product — this repo's actual buttons,
transitions, and animations have not been systematically gone through. Pivoting
from "evaluate tools in a lab" to "apply what's validated directly to this
repo's real UI."

## What's already validated (usable now, don't re-litigate)

From `~/dev/design-tool-lab/docs/decision-matrix.md` and 6 published bench
artifacts:

- **Canvas UI** (real lib: 24 WebGL/canvas components, shadcn-CLI installable,
  `canvasui.dev`) — MERGE, but only as a **single** signature effect on a
  hero/marketing surface, never multiple GPU-heavy effects stacked on one page.
- **itshover** (real lib: 186+ animated icons, shadcn-CLI installable,
  `itshover.com`) — MERGE, but the vendored icon components need a patch:
  duration 500ms→300ms budget, `easeInOut`→`ease-out`, and
  `prefers-reduced-motion` support added (none of the vendored icons have it).
- **Amicro** (real lib: small, ~4 interaction types — slide-arrow/sparkle/
  morph/magnetic — plus stiffness/damping spring controls; this is the whole
  library, not a partial sample) — MERGE, patched version only (the `padding`
  animation in the original is layout-triggering, not GPU-safe; use the
  `layout` prop / transform-based fix instead).
- **`review-animations` skill** (Emil Kowalski's 10 non-negotiable standards:
  responsive easing, physicality, interruptibility, GPU-only properties,
  reduced-motion, asymmetric enter/exit, etc.) — use this as the actual quality
  gate for any animation work in this repo, not an invented rubric.
- **Impeccable** (real tool: `pbakaus/impeccable`, its own 12-verb framework —
  harden/onboard/animate/colorize/typeset/layout/delight/overdrive/clarify/
  adapt/optimize/live — plus an explicit anti-pattern list) — NOT properly
  tested yet in the design-tool-lab bench (that bench used Nielsen heuristics
  instead of Impeccable's own framework by mistake). If Impeccable is going to
  be used as an audit tool here, test it on its own terms first.
- **UI Presentation Lab** — this is our own idea, not an external library.
  Already fully explored; nothing more to extract from it.

## Known repo complexity to resolve BEFORE touching UI (do not skip)

1. **Canonical frontend is `frontend/`**: it is documented in this repo's
   `CLAUDE.md`, is the production static-export Next.js app, and is live on
   Netlify. The abandoned parallel `frontend_v2/` experiment was removed on
   2026-07-25; do not recreate or target a second frontend tree.
2. **Branch state**: current branch is `feat/wrapped-ux-rebuild`. `experiment`
   is 17 commits ahead of `main`. `desktop_server` — per this repo's own
   `CLAUDE.md` "Resolved" section, `origin/desktop_server` and `origin/main`
   were made identical via PR #24 — **re-verify this is still true** (a local
   `desktop_server` branch showing commits ahead of main may just be a stale
   local ref, not a real divergence) before assuming there's a distinct
   "desktop_server version" of the UI to merge in.
3. **This repo has already been burned by careless tree-combining once**, per
   its own `CLAUDE.md` "What went wrong before" section: dead code resurrected
   twice by merges, an experimental page (`WrappedBrutal.jsx`) silently
   orphaning concurrent features because a PR rewrote the page shell without
   integrating what was already there. The documented fix is **"one PR = one
   scope"** — don't combine `experiment` + whatever `desktop_server` turns out
   to be + the canonical frontend in one sweeping motion. Reconcile branch/tree state as
   its own first step, separate from any animation work.

## Real surfaces to eventually deep-dive (once tree/branch state is clear)

From `frontend/src`:
- `app/story` — the wrapped narrative/reveal sequence (likely the highest
  density of transition decisions: what animates in, in what order, on scroll
  vs on tap).
- `components/share/variants/` — 9 share-card variants (`AdmitOneShareCard`,
  `WrappedHeroShareCard`, `DossierShareCard`, `ContactSheetShareCard`,
  `EditorialShareCard`, `MinimalOutlierShareCard`, `DoubleFeatureShareCard`,
  `AppleHIGShareCard`, `Variant3ShareCard`) — each is a candidate for exactly
  one Canvas UI signature effect + itshover icon set + Amicro button, applied
  with real content, not a demo.
- `results` / `watchlist` / `findfilm` routes — general button/interaction
  inventory not yet audited against the `review-animations` 10 standards.
- Separately, `docs/desktop-server-feedback-2026-07-12.md` already lists open
  polish requests (loading screen, glow/pulse repeat on Directors/Cast grid,
  contrast fixes) that overlap with this animation work — check it before
  duplicating a request that's already written down.

## Workflow requirement

User wants **tldraw-offline** included as part of this workflow — as the
visual layer for iterating on animation/transition decisions with AI
(mockups, sequencing diagrams, before/after comparisons), not a separate
unrelated track. Fold it in rather than treating it as optional.

## Suggested first step for whoever picks this up

Don't start editing UI yet. First:
1. Confirm the real `experiment`/`desktop_server` branch state (`git fetch`,
   diff against `origin/main`, don't trust local stale branches). The canonical
   frontend tree is `frontend/`.
2. Write a short plan (per this repo's own "propose smallest safe change"
   AI-workflow rule) for how `experiment`'s 17 commits and any real
   `desktop_server` divergence get reconciled — one scope at a time.
3. Only then pick ONE real surface (story flow vs share-card variants vs
   general button audit) to deep-dive first, applying the validated
   Canvas UI/itshover/Amicro patterns + `review-animations` standards as the
   quality gate.
