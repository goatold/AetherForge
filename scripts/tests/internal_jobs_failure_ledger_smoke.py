#!/usr/bin/env python3
"""TDD smoke: forced internal job failure records failed run ledger."""

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


def post_with_auth(url: str, token: str | None) -> tuple[int, str]:
    headers = {}
    if token is not None:
        headers["authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            return response.status, response.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", "ignore")


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
    root = base_url.rstrip("/")
    failure_url = f"{root}/api/internal/jobs/flashcards/refresh?testMode=force_failure"
    health_url = f"{root}/api/internal/health"

    failure_status, failure_body = post_with_auth(failure_url, token)
    failure_obj = parse_json(failure_body)
    failure_error = failure_obj.get("error") if isinstance(failure_obj, dict) else None
    checks.append(
        CheckResult(
            "forced_job_failure_returns_500",
            failure_status == 500,
            f"status={failure_status}",
        )
    )
    checks.append(
        CheckResult(
            "forced_job_failure_error_message_shape",
            isinstance(failure_error, str) and "failed to refresh flashcard queue" in failure_error.lower(),
            str(failure_error),
        )
    )

    health_status, health_body = get_with_auth(health_url, token)
    health_obj = parse_json(health_body)
    queue_obj = health_obj.get("flashcardsQueue") if isinstance(health_obj, dict) else None
    latest_run = queue_obj.get("latestRun") if isinstance(queue_obj, dict) else None
    latest_status = latest_run.get("status") if isinstance(latest_run, dict) else None
    latest_error = latest_run.get("errorMessage") if isinstance(latest_run, dict) else None

    checks.append(
        CheckResult(
            "health_read_after_forced_failure_status",
            health_status in (200, 503),
            f"status={health_status}",
        )
    )
    checks.append(
        CheckResult(
            "latest_run_marked_failed",
            latest_status == "failed",
            str(latest_status),
        )
    )
    checks.append(
        CheckResult(
            "latest_run_error_message_persisted",
            isinstance(latest_error, str) and "simulated internal job failure" in latest_error.lower(),
            str(latest_error),
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

    print("INTERNAL_JOBS_FAILURE_LEDGER_SMOKE_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
