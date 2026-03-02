#!/usr/bin/env python3
"""TDD smoke: reject overlapping internal flashcard refresh runs."""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str


def post_with_auth(url: str, token: str) -> tuple[int, str]:
    req = urllib.request.Request(
        url,
        method="POST",
        headers={"authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            return response.status, response.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", "ignore")


def run(base_url: str, token: str, hold_ms: int) -> list[CheckResult]:
    checks: list[CheckResult] = []
    first_result: dict[str, object] = {}
    job_url = f"{base_url.rstrip('/')}/api/internal/jobs/flashcards/refresh?holdMs={hold_ms}&dryRun=1"

    def first_call() -> None:
        status, body = post_with_auth(job_url, token)
        first_result["status"] = status
        first_result["body"] = body

    thread = threading.Thread(target=first_call, daemon=True)
    thread.start()

    # Keep overlap deterministic by giving the first request a short head start.
    time.sleep(0.2)
    second_status, second_body = post_with_auth(job_url, token)
    thread.join(timeout=120)

    first_status = int(first_result.get("status", 0))
    first_body = first_result.get("body", "")
    statuses = sorted([first_status, second_status])
    checks.append(
        CheckResult(
            "overlap_status_pair",
            statuses == [200, 409],
            f"statuses={[first_status, second_status]}",
        )
    )

    success_body = first_body if first_status == 200 else second_body
    conflict_body = first_body if first_status == 409 else second_body
    conflict_obj = json.loads(conflict_body) if conflict_body else {}
    conflict_error = conflict_obj.get("error") if isinstance(conflict_obj, dict) else None
    checks.append(
        CheckResult(
            "overlap_error_message",
            isinstance(conflict_error, str) and "running" in conflict_error.lower(),
            str(conflict_error),
        )
    )

    success_obj = json.loads(success_body) if isinstance(success_body, str) and success_body else {}
    checks.append(
        CheckResult(
            "success_response_shape",
            isinstance(success_obj, dict)
            and isinstance(success_obj.get("processedWorkspaces"), int)
            and isinstance(success_obj.get("createdCount"), int)
            and isinstance(success_obj.get("skippedCount"), int),
            "processedWorkspaces/createdCount/skippedCount ints",
        )
    )

    return checks


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.environ.get("NEXT_PUBLIC_APP_URL", "http://localhost:3000"))
    parser.add_argument("--token", default=os.environ.get("INTERNAL_JOB_TOKEN", ""))
    parser.add_argument("--hold-ms", type=int, default=2500)
    args = parser.parse_args()

    if not args.token:
        print("Missing token. Provide --token or set INTERNAL_JOB_TOKEN.")
        return 1

    try:
        checks = run(args.base_url, args.token, args.hold_ms)
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

    print("INTERNAL_JOBS_OVERLAP_SMOKE_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
