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
