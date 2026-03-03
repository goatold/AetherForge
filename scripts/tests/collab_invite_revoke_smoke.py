#!/usr/bin/env python3
"""TDD smoke: invite revoke authz + stale conflict + token invalidation."""
from __future__ import annotations

import argparse
import http.cookiejar
import json
import sys
import time
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
        url, data=body, method="POST", headers={"content-type": "application/x-www-form-urlencoded"}
    )
    return opener.open(req, timeout=45)


def post_json(opener, url: str, payload: dict[str, object]):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={"content-type": "application/json"})
    try:
        resp = opener.open(req, timeout=45)
        return resp.status, read_text(resp)
    except urllib.error.HTTPError as exc:
        return exc.code, read_text(exc)


def delete_json(opener, url: str):
    req = urllib.request.Request(url, method="DELETE")
    try:
        resp = opener.open(req, timeout=45)
        return resp.status, read_text(resp)
    except urllib.error.HTTPError as exc:
        return exc.code, read_text(exc)


def parse_json(raw: str):
    try:
        return json.loads(raw) if raw else {}
    except Exception:  # noqa: BLE001
        return {}


def run(base_url: str):
    checks: list[CheckResult] = []
    nonce = int(time.time() * 1000)
    editor_email = f"invite.revoke.editor.{nonce}@example.com"
    pending_email = f"invite.revoke.pending.{nonce}@example.com"

    owner = make_cookie_opener()
    editor = make_cookie_opener()
    pending_user = make_cookie_opener()

    post_form(owner, f"{base_url}/api/auth/sign-in", {"email": "alice.prephase3@example.com", "next": "/collab"})

    # Create and accept editor invite so we can assert non-owner revoke authorization.
    editor_invite_status, editor_invite_body = post_json(
        owner, f"{base_url}/api/collab/members", {"email": editor_email, "role": "editor"}
    )
    editor_invite_obj = parse_json(editor_invite_body)
    editor_invite_link = editor_invite_obj.get("invitedLinkPath") if isinstance(editor_invite_obj, dict) else None
    checks.append(
        CheckResult(
            "owner_invites_editor",
            editor_invite_status == 200 and isinstance(editor_invite_link, str),
            f"status={editor_invite_status}",
        )
    )
    if not isinstance(editor_invite_link, str):
        return checks

    editor_token = editor_invite_link.rsplit("/", 1)[-1]
    post_form(editor, f"{base_url}/api/auth/sign-in", {"email": editor_email, "next": "/collab"})
    editor_accept_status, _ = post_json(editor, f"{base_url}/api/collab/invites/accept", {"token": editor_token})
    checks.append(CheckResult("editor_accepts_invite", editor_accept_status == 200, f"status={editor_accept_status}"))

    # Create a pending invite that will be revoked.
    pending_invite_status, pending_invite_body = post_json(
        owner, f"{base_url}/api/collab/members", {"email": pending_email, "role": "viewer"}
    )
    pending_invite_obj = parse_json(pending_invite_body)
    pending_invite_link = pending_invite_obj.get("invitedLinkPath") if isinstance(pending_invite_obj, dict) else None
    pending_invites = pending_invite_obj.get("pendingInvites") if isinstance(pending_invite_obj, dict) else None
    pending_invite_id = None
    if isinstance(pending_invites, list):
        target = next(
            (
                row
                for row in pending_invites
                if isinstance(row, dict) and row.get("invited_email", "").lower() == pending_email.lower()
            ),
            None,
        )
        pending_invite_id = target.get("id") if isinstance(target, dict) else None

    checks.append(
        CheckResult(
            "owner_creates_pending_invite",
            pending_invite_status == 200 and isinstance(pending_invite_link, str) and isinstance(pending_invite_id, str),
            f"status={pending_invite_status}",
        )
    )
    if not isinstance(pending_invite_link, str) or not isinstance(pending_invite_id, str):
        return checks

    # Non-owner must not revoke invites.
    editor_revoke_status, editor_revoke_body = delete_json(editor, f"{base_url}/api/collab/invites/{pending_invite_id}")
    editor_revoke_obj = parse_json(editor_revoke_body)
    editor_revoke_error = editor_revoke_obj.get("error") if isinstance(editor_revoke_obj, dict) else None
    checks.append(
        CheckResult(
            "non_owner_revoke_hidden_not_found",
            editor_revoke_status == 404,
            f"status={editor_revoke_status}",
        )
    )
    checks.append(
        CheckResult(
            "non_owner_revoke_message",
            isinstance(editor_revoke_error, str) and "not found" in editor_revoke_error.lower(),
            str(editor_revoke_error),
        )
    )

    # Owner revoke should succeed.
    owner_revoke_status, owner_revoke_body = delete_json(owner, f"{base_url}/api/collab/invites/{pending_invite_id}")
    owner_revoke_obj = parse_json(owner_revoke_body)
    owner_pending_after_revoke = (
        owner_revoke_obj.get("pendingInvites") if isinstance(owner_revoke_obj, dict) else None
    )
    revoked_still_present = False
    if isinstance(owner_pending_after_revoke, list):
        revoked_still_present = any(
            isinstance(row, dict) and row.get("id") == pending_invite_id for row in owner_pending_after_revoke
        )
    checks.append(CheckResult("owner_revoke_pending_invite", owner_revoke_status == 200, f"status={owner_revoke_status}"))
    checks.append(
        CheckResult(
            "revoked_invite_removed_from_pending_list",
            isinstance(owner_pending_after_revoke, list) and not revoked_still_present,
            f"still_present={revoked_still_present}",
        )
    )

    # Revoked token must not be accepted.
    pending_token = pending_invite_link.rsplit("/", 1)[-1]
    post_form(
        pending_user,
        f"{base_url}/api/auth/sign-in",
        {"email": pending_email, "next": f"/invite/{pending_token}"},
    )
    revoked_accept_status, revoked_accept_body = post_json(
        pending_user,
        f"{base_url}/api/collab/invites/accept",
        {"token": pending_token},
    )
    revoked_accept_obj = parse_json(revoked_accept_body)
    revoked_accept_error = revoked_accept_obj.get("error") if isinstance(revoked_accept_obj, dict) else None
    checks.append(
        CheckResult(
            "revoked_invite_token_rejected",
            revoked_accept_status == 410,
            f"status={revoked_accept_status}",
        )
    )
    checks.append(
        CheckResult(
            "revoked_invite_token_message",
            isinstance(revoked_accept_error, str) and "revoked" in revoked_accept_error.lower(),
            str(revoked_accept_error),
        )
    )

    # Stale second revoke should surface deterministic conflict.
    stale_revoke_status, stale_revoke_body = delete_json(owner, f"{base_url}/api/collab/invites/{pending_invite_id}")
    stale_revoke_obj = parse_json(stale_revoke_body)
    stale_revoke_error = stale_revoke_obj.get("error") if isinstance(stale_revoke_obj, dict) else None
    checks.append(CheckResult("stale_revoke_conflict", stale_revoke_status == 409, f"status={stale_revoke_status}"))
    checks.append(
        CheckResult(
            "stale_revoke_conflict_message",
            isinstance(stale_revoke_error, str) and "no longer active" in stale_revoke_error.lower(),
            str(stale_revoke_error),
        )
    )

    # Unknown invite id should remain not-found.
    unknown_status, _ = delete_json(owner, f"{base_url}/api/collab/invites/00000000-0000-0000-0000-000000000000")
    checks.append(CheckResult("unknown_invite_not_found", unknown_status == 404, f"status={unknown_status}"))

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

    failed = [c for c in checks if not c.ok]
    for c in checks:
        state = "PASS" if c.ok else "FAIL"
        print(f"{c.name}: {state} ({c.detail})")
    print(f"Passed {len(checks)-len(failed)}/{len(checks)} checks")

    if failed:
        return 1
    print("COLLAB_INVITE_REVOKE_SMOKE_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
