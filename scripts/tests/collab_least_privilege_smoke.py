#!/usr/bin/env python3
"""TDD smoke: non-owners must not see pending invite tokens."""
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


def get_json(opener, url: str):
    req = urllib.request.Request(url, method="GET")
    resp = opener.open(req, timeout=45)
    return resp.status, read_text(resp)


def run(base_url: str):
    checks: list[CheckResult] = []
    nonce = int(time.time() * 1000)
    editor_email = f"editor.lp.{nonce}@example.com"
    viewer_email = f"viewer.lp.{nonce}@example.com"

    owner = make_cookie_opener()
    editor = make_cookie_opener()

    # Owner session
    post_form(owner, f"{base_url}/api/auth/sign-in", {"email": "alice.prephase3@example.com", "next": "/collab"})

    # Invite editor user and accept as editor
    invite_status, invite_body = post_json(
        owner,
        f"{base_url}/api/collab/members",
        {"email": editor_email, "role": "editor"},
    )
    invite_obj = json.loads(invite_body) if invite_body else {}
    invite_link = invite_obj.get("invitedLinkPath") if isinstance(invite_obj, dict) else None
    checks.append(CheckResult("owner_invites_editor", invite_status == 200 and isinstance(invite_link, str), f"status={invite_status}"))
    if not isinstance(invite_link, str):
        return checks

    token = invite_link.rsplit("/", 1)[-1]

    post_form(editor, f"{base_url}/api/auth/sign-in", {"email": editor_email, "next": "/collab"})
    accept_status, accept_body = post_json(editor, f"{base_url}/api/collab/invites/accept", {"token": token})
    checks.append(CheckResult("editor_accepts_invite", accept_status == 200, f"status={accept_status}"))
    accept_obj = json.loads(accept_body) if accept_body else {}
    invited_workspace_id = accept_obj.get("workspaceId") if isinstance(accept_obj, dict) else None
    checks.append(
        CheckResult(
            "accept_returns_workspace_id",
            isinstance(invited_workspace_id, str) and len(invited_workspace_id) > 0,
            str(invited_workspace_id),
        )
    )
    if not isinstance(invited_workspace_id, str):
        return checks

    # Owner creates another pending invite that editor should not be able to read/copy
    second_status, second_body = post_json(
        owner,
        f"{base_url}/api/collab/members",
        {"email": viewer_email, "role": "viewer"},
    )
    second_obj = json.loads(second_body) if second_body else {}
    second_link = second_obj.get("invitedLinkPath") if isinstance(second_obj, dict) else None
    checks.append(CheckResult("owner_creates_pending_invite", second_status == 200 and isinstance(second_link, str), f"status={second_status}"))

    # Editor should not see pending invite details/token
    list_status, list_body = get_json(
        editor,
        f"{base_url}/api/collab/members?workspaceId={urllib.parse.quote(invited_workspace_id)}",
    )
    list_obj = json.loads(list_body) if list_body else {}
    can_manage = list_obj.get("canManage") if isinstance(list_obj, dict) else None
    pending = list_obj.get("pendingInvites") if isinstance(list_obj, dict) else None

    checks.append(CheckResult("editor_can_manage_false", can_manage is False, str(can_manage)))
    checks.append(CheckResult("editor_pending_invites_hidden", isinstance(pending, list) and len(pending) == 0, f"pending_count={len(pending) if isinstance(pending, list) else 'n/a'}"))

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
    print("COLLAB_LEAST_PRIVILEGE_SMOKE_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
