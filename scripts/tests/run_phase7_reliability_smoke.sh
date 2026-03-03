#!/usr/bin/env bash
set -euo pipefail

HOLD_MS="2500"
COMMON_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hold-ms)
      if [[ $# -lt 2 ]]; then
        echo "--hold-ms requires a value"
        exit 1
      fi
      HOLD_MS="$2"
      shift 2
      ;;
    *)
      COMMON_ARGS+=("$1")
      shift
      ;;
  esac
done

echo "[phase7] internal health contract"
python3 scripts/tests/internal_health_smoke.py "${COMMON_ARGS[@]}"

echo "[phase7] internal health state matrix contract"
python3 scripts/tests/internal_health_state_matrix_smoke.py "${COMMON_ARGS[@]}"

echo "[phase7] internal jobs contract"
python3 scripts/tests/internal_jobs_smoke.py "${COMMON_ARGS[@]}"

echo "[phase7] internal jobs overlap contract"
python3 scripts/tests/internal_jobs_overlap_smoke.py "${COMMON_ARGS[@]}" --hold-ms "$HOLD_MS"

echo "PHASE7_RELIABILITY_SMOKE_PASS"
