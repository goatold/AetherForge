#!/usr/bin/env python3
"""TDD smoke: auth sign-out redirect + session invalidation contract."""
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


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def build_openers():
    jar = http.cookiejar.CookieJar()
    default = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    no_redirect = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar), NoRedirect())
    return default, no_redirect


def read_text(response):
    return response.read().decode("utf-8", "ignore")


def post_form(opener, url: str, payload: dict[str, str]):
    body = urllib.parse.urlencode(payload).encode()
    req = urllib.request.Request(
        url, data=body, method="POST", headers={"content-type": "application/x-www-form-urlencoded"}
    )
    return opener.open(req, timeout=60)


def request_json(opener, method: str, url: str, payload: dict[str, object] | None = None):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"content-type": "application/json"} if payload is not None else {}
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        response = opener.open(req, timeout=60)
        return response.status, read_text(response), dict(response.headers)
    except urllib.error.HTTPError as exc:
        return exc.code, read_text(exc), dict(exc.headers)


def run(base_url: str):
    checks: list[CheckResult] = []
    opener, no_redirect = build_openers()

    post_form(opener, f"{base_url}/api/auth/sign-in", {"email": "alice.prephase3@example.com", "next": "/learn"})

    workspace_status, _, _ = request_json(opener, "GET", f"{base_url}/api/workspace")
    checks.append(CheckResult("workspace_access_before_signout", workspace_status == 200, f"status={workspace_status}"))

    signout_status, _, signout_headers = request_json(no_redirect, "POST", f"{base_url}/api/auth/sign-out")
    location = signout_headers.get("Location") or signout_headers.get("location") or ""
    checks.append(CheckResult("signout_redirect_status", signout_status == 303, f"status={signout_status}"))
    checks.append(
        CheckResult(
            "signout_redirect_location",
            isinstance(location, str) and location.endswith("/sign-in"),
            str(location),
        )
    )

    post_signout_workspace_status, post_signout_workspace_body, _ = request_json(
        opener, "GET", f"{base_url}/api/workspace"
    )
    post_signout_obj = {}
    try:
        post_signout_obj = json.loads(post_signout_workspace_body) if post_signout_workspace_body else {}
    except Exception:  # noqa: BLE001
        post_signout_obj = {}
    post_signout_error = post_signout_obj.get("error") if isinstance(post_signout_obj, dict) else None

    checks.append(
        CheckResult(
            "workspace_access_revoked_after_signout",
            post_signout_workspace_status == 401,
            f"status={post_signout_workspace_status}",
        )
    )
    checks.append(
        CheckResult(
            "workspace_unauthorized_message_after_signout",
            isinstance(post_signout_error, str) and "unauthorized" in post_signout_error.lower(),
            str(post_signout_error),
        )
    )

    return checks


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:3000")
    args = parser.parse_args()

    try:
        checks = run(args.base_url.rstrip("/"))
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
    print("AUTH_SIGNOUT_CONTRACT_SMOKE_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
