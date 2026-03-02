#!/usr/bin/env python3
"""TDD smoke: optimistic concurrency for resources PATCH."""
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
    req = urllib.request.Request(url, data=body, method="POST", headers={"content-type": "application/x-www-form-urlencoded"})
    return opener.open(req, timeout=45)

def post_json(opener, url: str, payload: dict[str, object]):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={"content-type": "application/json"})
    resp = opener.open(req, timeout=45)
    return resp.status, read_text(resp)

def patch_json(opener, url: str, payload: dict[str, object]):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, method="PATCH", headers={"content-type": "application/json"})
    try:
        resp = opener.open(req, timeout=45)
        return resp.status, read_text(resp)
    except urllib.error.HTTPError as exc:
        return exc.code, read_text(exc)

def run(base_url: str):
    checks: list[CheckResult] = []
    opener = make_cookie_opener()

    post_form(opener, f"{base_url}/api/auth/sign-in", {"email": "alice.prephase3@example.com", "next": "/resources"})

    created_status, created_body = post_json(opener, f"{base_url}/api/resources", {
        "title": "Concurrency test resource",
        "url": "https://example.com/resource",
        "noteText": "initial note",
        "tags": ["tdd", "concurrency"]
    })
    created = json.loads(created_body) if created_body else {}
    resource = created.get("resource") if isinstance(created, dict) else None
    checks.append(CheckResult("create_resource", created_status == 200 and isinstance(resource, dict), f"status={created_status}"))
    if not isinstance(resource, dict):
        return checks

    resource_id = resource.get("id")
    initial_updated_at = resource.get("updated_at")
    checks.append(CheckResult("resource_has_updated_at", isinstance(initial_updated_at, str) and len(initial_updated_at) > 0, str(initial_updated_at)))
    if not isinstance(resource_id, str) or not isinstance(initial_updated_at, str):
        return checks

    ok_status, ok_body = patch_json(opener, f"{base_url}/api/resources/{resource_id}", {
        "title": "Concurrency test resource (v2)",
        "expectedUpdatedAt": initial_updated_at
    })
    ok_obj = json.loads(ok_body) if ok_body else {}
    ok_resource = ok_obj.get("resource") if isinstance(ok_obj, dict) else None
    checks.append(CheckResult("patch_with_current_version", ok_status == 200 and isinstance(ok_resource, dict), f"status={ok_status}"))

    stale_status, stale_body = patch_json(opener, f"{base_url}/api/resources/{resource_id}", {
        "title": "Concurrency test resource (stale write)",
        "expectedUpdatedAt": initial_updated_at
    })
    stale_obj = json.loads(stale_body) if stale_body else {}
    stale_error = stale_obj.get("error") if isinstance(stale_obj, dict) else None
    checks.append(CheckResult("stale_version_conflict", stale_status == 409, f"status={stale_status}"))
    checks.append(CheckResult("stale_version_error_message", isinstance(stale_error, str) and "updated" in stale_error.lower(), str(stale_error)))

    return checks

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:3000")
    args = parser.parse_args()

    try:
        checks = run(args.base_url.rstrip('/'))
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
    print("RESOURCES_CONCURRENCY_SMOKE_PASS")
    return 0

if __name__ == "__main__":
    sys.exit(main())
