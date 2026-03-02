#!/usr/bin/env python3
"""TDD smoke: optimistic concurrency for plan milestone PATCH."""
from __future__ import annotations

import argparse
import http.cookiejar
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str


def make_cookie_opener():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def read_text(response):
    return response.read().decode("utf-8", "ignore")


def post_form(opener, url: str, payload: dict[str, str]):
    body = urllib.parse.urlencode(payload).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    return opener.open(req, timeout=45)


def post_json(opener, url: str, payload: dict[str, object]):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"content-type": "application/json"},
    )
    resp = opener.open(req, timeout=45)
    return resp.status, read_text(resp)


def patch_json(opener, url: str, payload: dict[str, object]):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="PATCH",
        headers={"content-type": "application/json"},
    )
    try:
        resp = opener.open(req, timeout=45)
        return resp.status, read_text(resp)
    except urllib.error.HTTPError as exc:
        return exc.code, read_text(exc)


def run(base_url: str):
    checks: list[CheckResult] = []
    opener = make_cookie_opener()

    post_form(
        opener,
        f"{base_url}/api/auth/sign-in",
        {"email": "alice.prephase3@example.com", "next": "/plan"},
    )

    create_status, create_body = post_json(
        opener,
        f"{base_url}/api/plan/milestones",
        {"title": "Concurrency milestone", "dueDate": "2030-01-01"},
    )
    create_obj = json.loads(create_body) if create_body else {}
    milestone = create_obj.get("milestone") if isinstance(create_obj, dict) else None
    checks.append(
        CheckResult(
            "create_milestone",
            create_status == 200 and isinstance(milestone, dict),
            f"status={create_status}",
        )
    )
    if not isinstance(milestone, dict):
        return checks

    milestone_id = milestone.get("id")
    initial_updated_at = milestone.get("updated_at")
    checks.append(
        CheckResult(
            "milestone_has_updated_at",
            isinstance(initial_updated_at, str) and len(initial_updated_at) > 0,
            str(initial_updated_at),
        )
    )
    if not isinstance(milestone_id, str) or not isinstance(initial_updated_at, str):
        return checks

    ok_status, ok_body = patch_json(
        opener,
        f"{base_url}/api/plan/milestones/{milestone_id}",
        {
            "title": "Concurrency milestone (v2)",
            "dueDate": "2030-02-01",
            "expectedUpdatedAt": initial_updated_at,
        },
    )
    ok_obj = json.loads(ok_body) if ok_body else {}
    ok_milestone = ok_obj.get("milestone") if isinstance(ok_obj, dict) else None
    checks.append(
        CheckResult(
            "patch_with_current_version",
            ok_status == 200 and isinstance(ok_milestone, dict),
            f"status={ok_status}",
        )
    )

    stale_status, stale_body = patch_json(
        opener,
        f"{base_url}/api/plan/milestones/{milestone_id}",
        {
            "title": "Concurrency milestone (stale)",
            "dueDate": "2030-03-01",
            "expectedUpdatedAt": initial_updated_at,
        },
    )
    stale_obj = json.loads(stale_body) if stale_body else {}
    stale_error = stale_obj.get("error") if isinstance(stale_obj, dict) else None
    checks.append(CheckResult("stale_version_conflict", stale_status == 409, f"status={stale_status}"))
    checks.append(
        CheckResult(
            "stale_version_error_message",
            isinstance(stale_error, str) and "updated" in stale_error.lower(),
            str(stale_error),
        )
    )

    return checks


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:3000")
    args = parser.parse_args()

    try:
        checks = run(args.base_url.rstrip("/"))
    except Exception as exc:
        print(f"Smoke test runtime error: {exc}")
        return 1

    failed = [check for check in checks if not check.ok]
    for check in checks:
        state = "PASS" if check.ok else "FAIL"
        print(f"{check.name}: {state} ({check.detail})")
    print(f"Passed {len(checks)-len(failed)}/{len(checks)} checks")

    if failed:
        return 1
    print("MILESTONES_CONCURRENCY_SMOKE_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
