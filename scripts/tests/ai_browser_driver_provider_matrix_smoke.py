#!/usr/bin/env python3
"""TDD smoke: browser-driver provider matrix (chatgpt/claude/gemini)."""
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
    return opener.open(req, timeout=60)


def request_json(opener, method: str, url: str, payload: dict[str, object] | None = None):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"content-type": "application/json"} if payload is not None else {}
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        resp = opener.open(req, timeout=120)
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

    providers = [
        ("chatgpt-web", "https://chatgpt.com", "chatgpt-web-ui"),
        ("claude-web", "https://claude.ai", "claude-web-ui"),
        ("gemini-web", "https://gemini.google.com", "gemini-web-ui"),
    ]
    for provider_key, login_url, model_hint in providers:
        request_json(opener, "DELETE", f"{base_url}/api/ai/session")

        connect_status, connect_body = request_json(
            opener,
            "POST",
            f"{base_url}/api/ai/session",
            {
                "providerKey": provider_key,
                "mode": "browser_ui",
                "modelHint": model_hint,
                "loginUrl": login_url,
            },
        )
        connect_obj = parse_json(connect_body)
        connected = connect_obj.get("connected") if isinstance(connect_obj, dict) else None
        checks.append(
            CheckResult(
                f"{provider_key}_connect",
                connect_status == 200 and connected is True,
                f"status={connect_status}",
            )
        )
        if not (connect_status == 200 and connected is True):
            continue

        concept_status, concept_body = request_json(
            opener,
            "POST",
            f"{base_url}/api/concepts/generate",
            {"topic": f"{provider_key} matrix topic", "difficulty": "intermediate"},
        )
        concept_obj = parse_json(concept_body)
        concept_path = concept_obj.get("generationPath") if isinstance(concept_obj, dict) else None
        concept_provider = concept_obj.get("provider") if isinstance(concept_obj, dict) else None
        checks.append(
            CheckResult(
                f"{provider_key}_concept_browser_driver",
                concept_status == 200 and concept_path == "browser_driver",
                f"status={concept_status}, path={concept_path}",
            )
        )
        checks.append(
            CheckResult(
                f"{provider_key}_concept_provider_attribution",
                concept_status == 200 and concept_provider == provider_key,
                str(concept_provider),
            )
        )

        quiz_status, quiz_body = request_json(opener, "POST", f"{base_url}/api/quiz/generate", {})
        quiz_obj = parse_json(quiz_body)
        quiz_id = quiz_obj.get("quizId") if isinstance(quiz_obj, dict) else None
        quiz_path = quiz_obj.get("generationPath") if isinstance(quiz_obj, dict) else None
        quiz_provider = quiz_obj.get("provider") if isinstance(quiz_obj, dict) else None
        checks.append(
            CheckResult(
                f"{provider_key}_quiz_browser_driver",
                quiz_status == 200 and isinstance(quiz_id, str) and quiz_path == "browser_driver",
                f"status={quiz_status}, path={quiz_path}",
            )
        )
        checks.append(
            CheckResult(
                f"{provider_key}_quiz_provider_attribution",
                quiz_status == 200 and isinstance(quiz_id, str) and quiz_provider == provider_key,
                str(quiz_provider),
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
    print("AI_BROWSER_DRIVER_PROVIDER_MATRIX_SMOKE_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
