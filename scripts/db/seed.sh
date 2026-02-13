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

SEED_DIR="$SCRIPT_DIR/../../src/lib/db/seed"

for seed_file in "$SEED_DIR"/*.sql; do
  [[ -e "$seed_file" ]] || continue
  echo "Applying seed: $(basename "$seed_file")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$seed_file"
done

echo "Seed complete."
