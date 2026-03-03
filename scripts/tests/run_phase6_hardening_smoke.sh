#!/usr/bin/env bash
set -euo pipefail

echo "[phase6] resources optimistic lock"
python3 scripts/tests/resources_concurrency_smoke.py "$@"

echo "[phase6] milestones optimistic lock"
python3 scripts/tests/milestones_concurrency_smoke.py "$@"

echo "[phase6] collaboration least privilege"
python3 scripts/tests/collab_least_privilege_smoke.py "$@"

echo "[phase6] collaboration role conflict"
python3 scripts/tests/collab_role_conflict_smoke.py "$@"

echo "[phase6] collaboration revoke conflict"
python3 scripts/tests/collab_revoke_conflict_smoke.py "$@"

echo "[phase6] collaboration invite revoke contract"
python3 scripts/tests/collab_invite_revoke_smoke.py "$@"

echo "PHASE6_HARDENING_SMOKE_PASS"
