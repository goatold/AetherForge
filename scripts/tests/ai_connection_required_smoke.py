#!/usr/bin/env python3
"""TDD smoke: AI generation requires manual browser-provider connection."""

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
        url, data=body, method="POST", headers={"content-type": "application/x-www-form-urlencoded"}
    )
    return opener.open(req, timeout=45)


def request_json(opener, method: str, url: str, payload: dict[str, object] | None = None):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"content-type": "application/json"} if payload is not None else {}
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        resp = opener.open(req, timeout=60)
        return resp.status, read_text(resp)
    except urllib.error.HTTPError as exc:
        return exc.code, read_text(exc)


def parse_json(value: str):
    try:
        return json.loads(value) if value else {}
    except Exception:  # noqa: BLE001
        return {}


def run(base_url: str):
    checks: list[CheckResult] = []
    opener = make_cookie_opener()
    post_form(opener, f"{base_url}/api/auth/sign-in", {"email": "alice.prephase3@example.com", "next": "/learn"})

    oauth_status, oauth_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/ai/session",
        {
            "providerKey": "chatgpt-web",
            "mode": "oauth_api",
            "modelHint": "oauth-deferred-test",
            "loginUrl": "https://chatgpt.com",
        },
    )
    oauth_obj = parse_json(oauth_body)
    oauth_error = oauth_obj.get("error") if isinstance(oauth_obj, dict) else None
    checks.append(
        CheckResult(
            "oauth_mode_rejected_until_implemented",
            oauth_status == 400,
            f"status={oauth_status}",
        )
    )
    checks.append(
        CheckResult(
            "oauth_mode_rejection_message",
            isinstance(oauth_error, str) and "not yet implemented" in oauth_error.lower(),
            str(oauth_error),
        )
    )

    whitespace_provider_status, whitespace_provider_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/ai/session",
        {
            "providerKey": " chatgpt-web ",
            "mode": "browser_ui",
            "modelHint": "provider-whitespace-test",
            "loginUrl": "https://chatgpt.com",
        },
    )
    whitespace_provider_obj = parse_json(whitespace_provider_body)
    whitespace_provider_error = (
        whitespace_provider_obj.get("error") if isinstance(whitespace_provider_obj, dict) else None
    )
    checks.append(
        CheckResult(
            "provider_key_whitespace_rejected",
            whitespace_provider_status == 400,
            f"status={whitespace_provider_status}",
        )
    )
    checks.append(
        CheckResult(
            "provider_key_whitespace_message",
            isinstance(whitespace_provider_error, str) and "providerkey" in whitespace_provider_error.lower(),
            str(whitespace_provider_error),
        )
    )

    unknown_status, unknown_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/ai/session",
        {
            "providerKey": "unknown-web",
            "mode": "browser_ui",
            "modelHint": "unknown-provider-test",
            "loginUrl": "https://example.com",
        },
    )
    unknown_obj = parse_json(unknown_body)
    unknown_error = unknown_obj.get("error") if isinstance(unknown_obj, dict) else None
    checks.append(
        CheckResult(
            "unknown_provider_rejected",
            unknown_status == 400,
            f"status={unknown_status}",
        )
    )
    checks.append(
        CheckResult(
            "unknown_provider_rejection_message",
            isinstance(unknown_error, str) and "supported provider" in unknown_error.lower(),
            str(unknown_error),
        )
    )

    mismatched_url_status, mismatched_url_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/ai/session",
        {
            "providerKey": "chatgpt-web",
            "mode": "browser_ui",
            "modelHint": "mismatched-login-url-test",
            "loginUrl": "https://example.com",
        },
    )
    mismatched_url_obj = parse_json(mismatched_url_body)
    mismatched_url_error = (
        mismatched_url_obj.get("error") if isinstance(mismatched_url_obj, dict) else None
    )
    checks.append(
        CheckResult(
            "provider_login_url_mismatch_rejected",
            mismatched_url_status == 400,
            f"status={mismatched_url_status}",
        )
    )
    checks.append(
        CheckResult(
            "provider_login_url_mismatch_message",
            isinstance(mismatched_url_error, str) and "canonical login url" in mismatched_url_error.lower(),
            str(mismatched_url_error),
        )
    )

    non_canonical_url_status, non_canonical_url_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/ai/session",
        {
            "providerKey": "chatgpt-web",
            "mode": "browser_ui",
            "modelHint": "non-canonical-login-url-test",
            "loginUrl": "https://chatgpt.com/login",
        },
    )
    non_canonical_url_obj = parse_json(non_canonical_url_body)
    non_canonical_url_error = (
        non_canonical_url_obj.get("error") if isinstance(non_canonical_url_obj, dict) else None
    )
    checks.append(
        CheckResult(
            "provider_login_url_non_canonical_rejected",
            non_canonical_url_status == 400,
            f"status={non_canonical_url_status}",
        )
    )
    checks.append(
        CheckResult(
            "provider_login_url_non_canonical_message",
            isinstance(non_canonical_url_error, str) and "canonical login url" in non_canonical_url_error.lower(),
            str(non_canonical_url_error),
        )
    )

    trailing_slash_url_status, trailing_slash_url_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/ai/session",
        {
            "providerKey": "chatgpt-web",
            "mode": "browser_ui",
            "modelHint": "trailing-slash-login-url-test",
            "loginUrl": "https://chatgpt.com/",
        },
    )
    trailing_slash_url_obj = parse_json(trailing_slash_url_body)
    trailing_slash_url_error = (
        trailing_slash_url_obj.get("error") if isinstance(trailing_slash_url_obj, dict) else None
    )
    checks.append(
        CheckResult(
            "provider_login_url_trailing_slash_rejected",
            trailing_slash_url_status == 400,
            f"status={trailing_slash_url_status}",
        )
    )
    checks.append(
        CheckResult(
            "provider_login_url_trailing_slash_message",
            isinstance(trailing_slash_url_error, str) and "canonical login url" in trailing_slash_url_error.lower(),
            str(trailing_slash_url_error),
        )
    )

    oversized_model_hint_status, oversized_model_hint_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/ai/session",
        {
            "providerKey": "chatgpt-web",
            "mode": "browser_ui",
            "modelHint": "x" * 300,
            "loginUrl": "https://chatgpt.com",
        },
    )
    oversized_model_hint_obj = parse_json(oversized_model_hint_body)
    oversized_model_hint_error = (
        oversized_model_hint_obj.get("error")
        if isinstance(oversized_model_hint_obj, dict)
        else None
    )
    checks.append(
        CheckResult(
            "model_hint_too_long_rejected",
            oversized_model_hint_status == 400,
            f"status={oversized_model_hint_status}",
        )
    )
    checks.append(
        CheckResult(
            "model_hint_too_long_message",
            isinstance(oversized_model_hint_error, str) and "modelhint" in oversized_model_hint_error.lower(),
            str(oversized_model_hint_error),
        )
    )

    invalid_model_hint_status, invalid_model_hint_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/ai/session",
        {
            "providerKey": "chatgpt-web",
            "mode": "browser_ui",
            "modelHint": "gpt-4o\nunsafe",
            "loginUrl": "https://chatgpt.com",
        },
    )
    invalid_model_hint_obj = parse_json(invalid_model_hint_body)
    invalid_model_hint_error = (
        invalid_model_hint_obj.get("error")
        if isinstance(invalid_model_hint_obj, dict)
        else None
    )
    checks.append(
        CheckResult(
            "model_hint_invalid_chars_rejected",
            invalid_model_hint_status == 400,
            f"status={invalid_model_hint_status}",
        )
    )
    checks.append(
        CheckResult(
            "model_hint_invalid_chars_message",
            isinstance(invalid_model_hint_error, str) and "modelhint" in invalid_model_hint_error.lower(),
            str(invalid_model_hint_error),
        )
    )

    # Ensure a clean state before assertions.
    request_json(opener, "DELETE", f"{base_url}/api/ai/session")

    blocked_status, blocked_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/concepts/generate",
        {"topic": "Connection Required Topic", "difficulty": "intermediate"},
    )
    blocked_obj = parse_json(blocked_body)
    blocked_error = blocked_obj.get("error") if isinstance(blocked_obj, dict) else None
    checks.append(CheckResult("concept_generation_requires_connection", blocked_status == 409, f"status={blocked_status}"))
    checks.append(
        CheckResult(
            "concept_generation_connection_error",
            isinstance(blocked_error, str) and "connect" in blocked_error.lower(),
            str(blocked_error),
        )
    )

    connect_status, connect_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/ai/session",
        {
            "providerKey": "chatgpt-web",
            "mode": "browser_ui",
            "modelHint": "gpt-4o",
            "loginUrl": "https://chatgpt.com"
        },
    )
    connect_obj = parse_json(connect_body)
    connected = connect_obj.get("connected") if isinstance(connect_obj, dict) else None
    checks.append(
        CheckResult(
            "manual_provider_connect",
            connect_status == 200 and connected is True,
            f"status={connect_status}",
        )
    )

    concept_status, concept_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/concepts/generate",
        {"topic": "Connected Topic", "difficulty": "intermediate"},
    )
    concept_obj = parse_json(concept_body)
    artifact_id = concept_obj.get("artifactId") if isinstance(concept_obj, dict) else None
    checks.append(
        CheckResult(
            "concept_generation_after_connect",
            concept_status == 200 and isinstance(artifact_id, str),
            f"status={concept_status}",
        )
    )

    artifacts_status, artifacts_body = request_json(opener, "GET", f"{base_url}/api/concepts/artifacts")
    artifacts_obj = parse_json(artifacts_body)
    artifacts = artifacts_obj.get("artifacts") if isinstance(artifacts_obj, dict) else None
    latest_provider = None
    if isinstance(artifacts, list) and artifacts and isinstance(artifacts[0], dict):
        latest_provider = artifacts[0].get("provider")
    checks.append(
        CheckResult(
            "artifact_provider_reflects_connection",
            artifacts_status == 200 and latest_provider == "chatgpt-web",
            str(latest_provider),
        )
    )

    quiz_status, quiz_body = request_json(opener, "POST", f"{base_url}/api/quiz/generate", {})
    quiz_obj = parse_json(quiz_body)
    quiz_id = quiz_obj.get("quizId") if isinstance(quiz_obj, dict) else None
    checks.append(
        CheckResult(
            "quiz_generation_after_connect",
            quiz_status == 200 and isinstance(quiz_id, str),
            f"status={quiz_status}",
        )
    )

    # Connect an unsupported browser driver provider and ensure generation explicitly reports fallback path.
    request_json(opener, "DELETE", f"{base_url}/api/ai/session")
    claude_connect_status, claude_connect_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/ai/session",
        {
            "providerKey": "claude-web",
            "mode": "browser_ui",
            "modelHint": "claude-web-sonnet",
            "loginUrl": "https://claude.ai",
        },
    )
    claude_connect_obj = parse_json(claude_connect_body)
    claude_connected = claude_connect_obj.get("connected") if isinstance(claude_connect_obj, dict) else None
    checks.append(
        CheckResult(
            "manual_provider_connect_claude",
            claude_connect_status == 200 and claude_connected is True,
            f"status={claude_connect_status}",
        )
    )

    claude_concept_status, claude_concept_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/concepts/generate",
        {"topic": "Fallback Path Topic", "difficulty": "intermediate"},
    )
    claude_concept_obj = parse_json(claude_concept_body)
    claude_generation_path = (
        claude_concept_obj.get("generationPath") if isinstance(claude_concept_obj, dict) else None
    )
    checks.append(
        CheckResult(
            "concept_generation_path_reports_fallback_for_unsupported_provider",
            claude_concept_status == 200 and claude_generation_path == "fallback",
            f"status={claude_concept_status}, generationPath={claude_generation_path}",
        )
    )

    claude_quiz_status, claude_quiz_body = request_json(opener, "POST", f"{base_url}/api/quiz/generate", {})
    claude_quiz_obj = parse_json(claude_quiz_body)
    claude_quiz_id = claude_quiz_obj.get("quizId") if isinstance(claude_quiz_obj, dict) else None
    claude_quiz_generation_path = (
        claude_quiz_obj.get("generationPath") if isinstance(claude_quiz_obj, dict) else None
    )
    checks.append(
        CheckResult(
            "quiz_generation_path_reports_fallback_for_unsupported_provider",
            claude_quiz_status == 200
            and isinstance(claude_quiz_id, str)
            and claude_quiz_generation_path == "fallback",
            f"status={claude_quiz_status}, generationPath={claude_quiz_generation_path}",
        )
    )

    disconnect_status, disconnect_body = request_json(opener, "DELETE", f"{base_url}/api/ai/session")
    disconnect_obj = parse_json(disconnect_body)
    disconnected = disconnect_obj.get("disconnected") if isinstance(disconnect_obj, dict) else None
    checks.append(
        CheckResult(
            "manual_provider_disconnect",
            disconnect_status == 200 and disconnected is True,
            f"status={disconnect_status}",
        )
    )

    post_disconnect_status, post_disconnect_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/concepts/generate",
        {"topic": "Disconnected Topic", "difficulty": "intermediate"},
    )
    post_disconnect_obj = parse_json(post_disconnect_body)
    post_disconnect_error = (
        post_disconnect_obj.get("error") if isinstance(post_disconnect_obj, dict) else None
    )
    checks.append(
        CheckResult(
            "concept_generation_requires_reconnect_after_disconnect",
            post_disconnect_status == 409,
            f"status={post_disconnect_status}",
        )
    )
    checks.append(
        CheckResult(
            "concept_generation_reconnect_error_after_disconnect",
            isinstance(post_disconnect_error, str) and "connect" in post_disconnect_error.lower(),
            str(post_disconnect_error),
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

    print("AI_CONNECTION_REQUIRED_SMOKE_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
