#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/../.."

if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -f "$REPO_ROOT/.env.local" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$REPO_ROOT/.env.local"
    set +a
  fi

  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "DATABASE_URL is required"
    exit 1
  fi
fi

MIGRATION_DIR="$SCRIPT_DIR/../../src/lib/db/migrations"

for migration in "$MIGRATION_DIR"/*.sql; do
  [[ -e "$migration" ]] || continue
  echo "Applying migration: $(basename "$migration")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

echo "Migrations complete."
