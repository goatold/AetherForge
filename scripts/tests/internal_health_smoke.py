#!/usr/bin/env python3
"""Smoke test for internal health endpoint auth + contract."""

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


def run(base_url: str, token: str) -> list[CheckResult]:
    checks: list[CheckResult] = []
    health_url = f"{base_url.rstrip('/')}/api/internal/health"

    unauth_status, _ = get_with_auth(health_url, None)
    checks.append(CheckResult("health_requires_auth", unauth_status == 401, f"status={unauth_status}"))

    bad_token_status, _ = get_with_auth(health_url, "definitely-wrong-token")
    checks.append(CheckResult("health_rejects_bad_token", bad_token_status == 401, f"status={bad_token_status}"))

    good_status, good_body = get_with_auth(health_url, token)
    checks.append(CheckResult("health_with_valid_token_status", good_status in (200, 503), f"status={good_status}"))

    parsed = json.loads(good_body) if good_body else {}
    status_value = parsed.get("status") if isinstance(parsed, dict) else None
    checks.append(
        CheckResult(
            "health_status_shape",
            status_value in ("ok", "degraded", "down"),
            str(status_value),
        )
    )

    database = parsed.get("database") if isinstance(parsed, dict) else None
    checks.append(
        CheckResult(
            "health_database_shape",
            isinstance(database, dict) and "ok" in database,
            "database keys",
        )
    )

    queue = parsed.get("flashcardsQueue") if isinstance(parsed, dict) else None
    checks.append(
        CheckResult(
            "health_queue_shape",
            isinstance(queue, dict),
            "flashcardsQueue object",
        )
    )

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

    print("INTERNAL_HEALTH_SMOKE_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
