#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/../.."

EXISTING_NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-}"
EXISTING_INTERNAL_JOB_TOKEN="${INTERNAL_JOB_TOKEN:-}"

if [[ -f "$REPO_ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env.local"
  set +a
fi

if [[ -n "$EXISTING_NEXT_PUBLIC_APP_URL" ]]; then
  NEXT_PUBLIC_APP_URL="$EXISTING_NEXT_PUBLIC_APP_URL"
fi

if [[ -n "$EXISTING_INTERNAL_JOB_TOKEN" ]]; then
  INTERNAL_JOB_TOKEN="$EXISTING_INTERNAL_JOB_TOKEN"
fi

if [[ -z "${NEXT_PUBLIC_APP_URL:-}" ]]; then
  echo "NEXT_PUBLIC_APP_URL is required"
  exit 1
fi

if [[ -z "${INTERNAL_JOB_TOKEN:-}" ]]; then
  echo "INTERNAL_JOB_TOKEN is required"
  exit 1
fi

HEALTH_URL="${NEXT_PUBLIC_APP_URL%/}/api/internal/health"

echo "Checking internal health endpoint: $HEALTH_URL"
curl --silent --show-error --fail-with-body \
  -H "authorization: Bearer ${INTERNAL_JOB_TOKEN}" \
  "$HEALTH_URL"
echo
echo "Internal health check complete."
