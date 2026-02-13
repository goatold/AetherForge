#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_DIR="$SCRIPT_DIR/../../src/lib/db/seed"

for seed_file in "$SEED_DIR"/*.sql; do
  [[ -e "$seed_file" ]] || continue
  echo "Applying seed: $(basename "$seed_file")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$seed_file"
done

echo "Seed complete."
