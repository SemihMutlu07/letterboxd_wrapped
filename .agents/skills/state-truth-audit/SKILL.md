---
name: state-truth-audit
description: Truth-first startup audit for letterboxd_wrapped and similar repos. Use when beginning repo work, resuming a task, implementing changes, checking readiness, preparing a push or deploy, or when the user mentions unknown state, half-finished work, unpushed commits, stale docs, deploy reality, broken tests, or "once soyle" / "once raporla" expectations.
---

# State Truth Audit

## Purpose

Surface broken, half-finished, stale, or unknown project state before doing implementation work. The first user-visible update must say what is broken, incomplete, or unverified, not just what the agent plans to change.

This skill exists because silent state gaps are costly: unpushed commits, stale docs saying the wrong deploy status, and tests that were assumed green but had never been run.

## Startup Audit

Run this before code changes unless the user asks a tiny self-contained question.

1. Check repo state:
   - `git status --short --branch`
   - `git log --oneline @{u}..HEAD` when an upstream exists
   - `git log --oneline HEAD..@{u}` when an upstream exists
   - If there is no upstream, say that push status is unknown until a remote/branch target is chosen.
2. Check tests by actually running the relevant gate:
   - Frontend change: `cd frontend && npm test` or a targeted Vitest file plus explain if the full suite was not run.
   - Backend change: `cd backend && pytest` or targeted pytest plus explain if the full suite was not run.
   - Cross-stack or readiness task: run both practical gates when time and environment permit.
   - If tests fail, report the failing test names and whether failures pre-existed or came from the current edit, based on available evidence.
3. Check real runtime/deploy health instead of trusting docs:
   - Local backend: `curl -sS http://localhost:8000/health` or the configured backend port.
   - Production backend for this repo: `curl -sS https://wrapped-backend.onrender.com/health`.
   - Frontend live site when relevant: `curl -I -sS https://movieswrapped.netlify.app/`.
   - If network or sandbox blocks curl, say health is unverified and name the blocked command.
4. Check doc freshness:
   - Compare `README.md`, `CLAUDE.md`, and relevant `docs/` files against source code and live health.
   - Flag stale claims explicitly, especially deploy status, branch policy, worker model, setup commands, and test instructions.
5. Report before editing:
   - Start with `Broken / Partial / Unknown`.
   - Include unpushed work count, dirty files, test result or unrun reason, live health result or unverified reason, and stale-doc findings.
   - Then state the smallest next action.

## Helper Script

Prefer running `scripts/audit_state.sh` from the repo root for the mechanical checks:

```bash
.agents/skills/state-truth-audit/scripts/audit_state.sh
```

The script is a starting point, not a substitute for judgment. Read relevant files yourself and run deeper tests when the task demands it.

## Output Shape

Use this compact format in the first update:

```text
Broken / Partial / Unknown:
- Git: <dirty files, unpushed commits, upstream divergence>
- Tests: <passed/failed/not run yet + command>
- Health: <local/prod curl result or blocked/unverified>
- Docs: <stale or unknown claims>

Next: <smallest concrete action>
```

Do not bury failures after implementation details. If state is unknown, call it unknown and say what would verify it.
