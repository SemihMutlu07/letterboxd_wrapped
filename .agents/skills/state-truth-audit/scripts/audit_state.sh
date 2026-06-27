#!/usr/bin/env bash
set -u

ROOT="${1:-$(pwd)}"
cd "$ROOT" || exit 2

echo "== state-truth-audit =="
echo "repo: $(pwd)"
echo

echo "== git =="
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git status --short --branch
  upstream=""
  if upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)"; then
    ahead_count="$(git rev-list --count "${upstream}..HEAD" 2>/dev/null || printf '?')"
    behind_count="$(git rev-list --count "HEAD..${upstream}" 2>/dev/null || printf '?')"
    echo "upstream: ${upstream}"
    echo "unpushed_commits: ${ahead_count}"
    echo "unpulled_commits: ${behind_count}"
    if [ "${ahead_count}" != "0" ] && [ "${ahead_count}" != "?" ]; then
      echo "unpushed_subjects:"
      git log --oneline --decorate "${upstream}..HEAD" | sed 's/^/  /'
    fi
  else
    echo "upstream: none"
    echo "push_status: unknown"
  fi
else
  echo "not a git repository"
fi
echo

echo "== test commands detected =="
if [ -f frontend/package.json ]; then
  echo "frontend: cd frontend && npm test"
fi
if [ -f backend/pytest.ini ] || [ -d backend/tests ]; then
  echo "backend: cd backend && pytest"
fi
echo "status: detected only; run the relevant gate before reporting green"
echo

echo "== health probes =="
probe() {
  label="$1"
  url="$2"
  if command -v curl >/dev/null 2>&1; then
    printf "%s: " "$label"
    curl -fsS --max-time 8 "$url" || printf "unverified_or_failed"
    printf '\n'
  else
    echo "$label: curl unavailable"
  fi
}
probe "local_backend_8000" "http://localhost:8000/health"
probe "prod_backend" "https://wrapped-backend.onrender.com/health"
if command -v curl >/dev/null 2>&1; then
  printf "prod_frontend_headers: "
  curl -I -sS --max-time 8 "https://movieswrapped.netlify.app/" | sed -n '1p' || printf "unverified_or_failed"
  printf '\n'
fi
echo

echo "== doc freshness hints =="
for file in README.md CLAUDE.md docs/desktop-worker-setup.md docs/desktop-worker-guide.md; do
  if [ -f "$file" ]; then
    printf "%s: " "$file"
    grep -nEi "not yet deployed|local-only|render|netlify|desktop worker|health|test|pytest|npm test" "$file" | head -n 8 || true
  fi
done
