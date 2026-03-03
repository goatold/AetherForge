#!/usr/bin/env python3
"""Deterministic smoke test for internal health state matrix."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str


def get_with_auth(url: str, token: str | None) -> tuple[int, str]:
    headers = {}
    if token is not None:
        headers["authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, method="GET", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            return response.status, response.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", "ignore")


def parse_json(raw: str):
    try:
        return json.loads(raw) if raw else {}
    except Exception:  # noqa: BLE001
        return {}


def run(base_url: str, token: str) -> list[CheckResult]:
    checks: list[CheckResult] = []
    root = f"{base_url.rstrip('/')}/api/internal/health"

    ok_status, ok_body = get_with_auth(f"{root}?testMode=force_ok", token)
    ok_obj = parse_json(ok_body)
    ok_value = ok_obj.get("status") if isinstance(ok_obj, dict) else None
    checks.append(CheckResult("health_force_ok_http_status", ok_status == 200, f"status={ok_status}"))
    checks.append(CheckResult("health_force_ok_status_value", ok_value == "ok", str(ok_value)))

    degraded_status, degraded_body = get_with_auth(f"{root}?testMode=force_degraded", token)
    degraded_obj = parse_json(degraded_body)
    degraded_value = degraded_obj.get("status") if isinstance(degraded_obj, dict) else None
    checks.append(
        CheckResult(
            "health_force_degraded_http_status",
            degraded_status == 503,
            f"status={degraded_status}",
        )
    )
    checks.append(
        CheckResult(
            "health_force_degraded_status_value",
            degraded_value == "degraded",
            str(degraded_value),
        )
    )

    down_status, down_body = get_with_auth(f"{root}?testMode=force_down", token)
    down_obj = parse_json(down_body)
    down_value = down_obj.get("status") if isinstance(down_obj, dict) else None
    db_obj = down_obj.get("database") if isinstance(down_obj, dict) else None
    db_ok = db_obj.get("ok") if isinstance(db_obj, dict) else None
    checks.append(CheckResult("health_force_down_http_status", down_status == 503, f"status={down_status}"))
    checks.append(CheckResult("health_force_down_status_value", down_value == "down", str(down_value)))
    checks.append(CheckResult("health_force_down_database_ok_false", db_ok is False, str(db_ok)))

    return checks


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.environ.get("NEXT_PUBLIC_APP_URL", "http://localhost:3000"))
    parser.add_argument("--token", default=os.environ.get("INTERNAL_JOB_TOKEN", ""))
    args = parser.parse_args()

    if not args.token:
        print("Missing token. Provide --token or set INTERNAL_JOB_TOKEN.")
        return 1

    try:
        checks = run(args.base_url, args.token)
    except Exception as exc:  # noqa: BLE001
        print(f"Smoke test runtime error: {exc}")
        return 1

    failed = [check for check in checks if not check.ok]
    for check in checks:
        state = "PASS" if check.ok else "FAIL"
        print(f"{check.name}: {state} ({check.detail})")
    print(f"Passed {len(checks) - len(failed)}/{len(checks)} checks")

    if failed:
        return 1

    print("INTERNAL_HEALTH_STATE_MATRIX_SMOKE_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
