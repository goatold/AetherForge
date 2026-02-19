#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/../.."

if [[ -f "$REPO_ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env.local"
  set +a
fi

if [[ -z "${NEXT_PUBLIC_APP_URL:-}" ]]; then
  echo "NEXT_PUBLIC_APP_URL is required"
  exit 1
fi

if [[ -z "${INTERNAL_JOB_TOKEN:-}" ]]; then
  echo "INTERNAL_JOB_TOKEN is required"
  exit 1
fi

JOB_URL="${NEXT_PUBLIC_APP_URL%/}/api/internal/jobs/flashcards/refresh"

echo "Triggering flashcard queue refresh job: $JOB_URL"
curl --silent --show-error --fail-with-body \
  -X POST \
  -H "authorization: Bearer ${INTERNAL_JOB_TOKEN}" \
  "$JOB_URL"
echo
echo "Flashcard queue refresh job complete."
