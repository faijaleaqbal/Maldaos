#!/usr/bin/env bash
# ============================================================
# campus-pulse-backend — reproducible test bootstrap
#
# Guarantees a clean, deterministic backend test run:
#   stack up → migrations → grants → seed → full vitest suite
#
# Usage:
#   ./scripts/test-bootstrap.sh          # full reset + all tests
#   ./scripts/test-bootstrap.sh --fast   # skip reset (tests only)
# Environment: .env must exist (see .env.example). Local Supabase
# stack keys are read from `supabase status` when needed.
# Exit code = vitest exit code (0 = all green).
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

FAST=0
[[ "${1:-}" == "--fast" ]] && FAST=1

# ---- 0. .env present? (fail closed) ----
if [[ ! -f .env ]]; then
  echo "ERROR: .env missing. Copy .env.example and fill keys from 'supabase status' first." >&2
  exit 1
fi
# shellcheck disable=SC1091
source .env 2>/dev/null || true

echo "=== [1/5] Supabase stack ==="
if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker daemon is not running. Start Docker first." >&2
  exit 1
fi

if ! supabase status >/dev/null 2>&1; then
  echo "Stack down — starting (first run may pull images)..."
  supabase start
else
  echo "Stack already running."
fi
if [[ $FAST -eq 0 ]]; then
  # refresh env values from the live stack (idempotent local dev keys)
  URL=$(supabase status -o env 2>/dev/null | grep -m1 '^API_URL=' | cut -d'"' -f2)
  ANON=$(supabase status -o env 2>/dev/null | grep -m1 ANON_KEY | cut -d'"' -f2)
  SERVICE=$(supabase status -o env 2>/dev/null | grep -m1 SERVICE_ROLE_KEY | cut -d'"' -f2)
  DB=$(supabase status -o env 2>/dev/null | grep -m1 '^DB_URL=' | cut -d'"' -f2)
  cat > .env <<EOF
SUPABASE_URL=${URL:-http://127.0.0.1:54321}
SUPABASE_ANON_KEY=${ANON}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE}
DATABASE_URL=${DB:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}
SEED_PASSWORD=${SEED_PASSWORD:-TestPass123!}
EOF
fi

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

echo "=== [2/5] Health check ==="
psql "$DB_URL" -tAc 'select 1;' >/dev/null

if [[ $FAST -eq 0 ]]; then
  echo "=== [3/5] Migrations (clean schema) ==="
  psql "$DB_URL" -q -c 'drop schema if exists public cascade; create schema public;' >/dev/null
  for f in supabase/migrations/*.sql; do
    echo "  applying $f"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null || { echo "MIGRATION FAILED: $f" >&2; exit 1; }
  done
  psql "$DB_URL" -q -c 'grant usage on schema public to postgres, anon, authenticated, service_role;
    grant all privileges on all tables in schema public to postgres, anon, authenticated, service_role;
    grant all privileges on all sequences in schema public to postgres, anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;' >/dev/null

  echo "=== [4/5] Seed ==="
  npm run seed >/dev/null || { echo "SEED FAILED" >&2; exit 1; }
else
  echo "=== [3-4/5] Skipped (--fast) ==="
fi

echo "=== [5/5] Test suite ==="
npm test
