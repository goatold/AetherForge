#!/usr/bin/env python3
"""TDD smoke: conflict-safe member role updates using expectedCurrentRole."""
from __future__ import annotations

import argparse
import http.cookiejar
import json
import time
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
    try:
        resp = opener.open(req, timeout=45)
        return resp.status, read_text(resp)
    except urllib.error.HTTPError as exc:
        return exc.code, read_text(exc)


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


def get_json(opener, url: str):
    req = urllib.request.Request(url, method="GET")
    resp = opener.open(req, timeout=45)
    return resp.status, read_text(resp)


def run(base_url: str):
    checks: list[CheckResult] = []
    nonce = int(time.time() * 1000)
    editor_email = f"role.conflict.{nonce}@example.com"

    owner = make_cookie_opener()
    editor = make_cookie_opener()

    post_form(owner, f"{base_url}/api/auth/sign-in", {"email": "alice.prephase3@example.com", "next": "/collab"})

    invite_status, invite_body = post_json(owner, f"{base_url}/api/collab/members", {"email": editor_email, "role": "editor"})
    invite_obj = json.loads(invite_body) if invite_body else {}
    invite_link = invite_obj.get("invitedLinkPath") if isinstance(invite_obj, dict) else None
    checks.append(CheckResult("owner_invites_editor", invite_status == 200 and isinstance(invite_link, str), f"status={invite_status}"))
    if not isinstance(invite_link, str):
        return checks

    token = invite_link.rsplit("/", 1)[-1]
    post_form(editor, f"{base_url}/api/auth/sign-in", {"email": editor_email, "next": "/collab"})
    accept_status, _ = post_json(editor, f"{base_url}/api/collab/invites/accept", {"token": token})
    checks.append(CheckResult("editor_accepts_invite", accept_status == 200, f"status={accept_status}"))

    list_status, list_body = get_json(owner, f"{base_url}/api/collab/members")
    list_obj = json.loads(list_body) if list_body else {}
    members = list_obj.get("members") if isinstance(list_obj, dict) else None
    checks.append(CheckResult("owner_lists_members", list_status == 200 and isinstance(members, list), f"status={list_status}"))
    if not isinstance(members, list):
        return checks

    target = next((m for m in members if isinstance(m, dict) and m.get("email") == editor_email), None)
    user_id = target.get("user_id") if isinstance(target, dict) else None
    checks.append(CheckResult("find_editor_member", isinstance(user_id, str) and len(user_id) > 0, str(user_id)))
    if not isinstance(user_id, str):
        return checks

    ok_status, _ = patch_json(
        owner,
        f"{base_url}/api/collab/members/{user_id}",
        {"role": "viewer", "expectedCurrentRole": "editor"},
    )
    checks.append(CheckResult("patch_role_with_current_expected", ok_status == 200, f"status={ok_status}"))

    stale_status, stale_body = patch_json(
        owner,
        f"{base_url}/api/collab/members/{user_id}",
        {"role": "editor", "expectedCurrentRole": "editor"},
    )
    stale_obj = json.loads(stale_body) if stale_body else {}
    stale_error = stale_obj.get("error") if isinstance(stale_obj, dict) else None
    checks.append(CheckResult("patch_role_stale_conflict", stale_status == 409, f"status={stale_status}"))
    checks.append(CheckResult("patch_role_stale_message", isinstance(stale_error, str) and "changed" in stale_error.lower(), str(stale_error)))

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
    print("COLLAB_ROLE_CONFLICT_SMOKE_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
