#!/usr/bin/env python3
"""AI quality gate: schema-valid concept+quiz generation success rate."""

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
class IterationResult:
    concept_ok: bool
    quiz_ok: bool
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


def post_json(opener, url: str, payload: dict[str, object]):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={"content-type": "application/json"})
    try:
        response = opener.open(req, timeout=120)
        return response.status, read_text(response)
    except urllib.error.HTTPError as exc:
        return exc.code, read_text(exc)


def get_json(opener, url: str):
    req = urllib.request.Request(url, method="GET")
    response = opener.open(req, timeout=60)
    return response.status, read_text(response)


def run(base_url: str, iterations: int, min_success_rate: float, require_connected_provider: bool):
    opener = make_cookie_opener()
    post_form(
        opener,
        f"{base_url}/api/auth/sign-in",
        {"email": "alice.prephase3@example.com", "next": "/learn"},
    )
    post_json(
        opener,
        f"{base_url}/api/ai/session",
        {
            "providerKey": "chatgpt-web",
            "mode": "browser_ui",
            "modelHint": "web-default",
            "loginUrl": "https://chatgpt.com",
        },
    )

    results: list[IterationResult] = []
    for i in range(iterations):
        topic = f"AI Quality Gate Topic {i + 1}"
        concept_status, concept_body = post_json(
            opener,
            f"{base_url}/api/concepts/generate",
            {"topic": topic, "difficulty": "intermediate"},
        )
        concept_obj = json.loads(concept_body) if concept_body else {}
        artifact_id = concept_obj.get("artifactId") if isinstance(concept_obj, dict) else None
        concepts = concept_obj.get("concepts") if isinstance(concept_obj, dict) else None
        concept_ok = concept_status == 200 and isinstance(artifact_id, str) and isinstance(concepts, list) and len(concepts) > 0
        detail = f"concept_status={concept_status}"

        if concept_ok and require_connected_provider:
            artifacts_status, artifacts_body = get_json(opener, f"{base_url}/api/concepts/artifacts")
            artifacts_obj = json.loads(artifacts_body) if artifacts_body else {}
            artifacts = artifacts_obj.get("artifacts") if isinstance(artifacts_obj, dict) else None
            provider = None
            if artifacts_status == 200 and isinstance(artifacts, list) and artifacts and isinstance(artifacts[0], dict):
                provider = artifacts[0].get("provider")
            concept_ok = isinstance(provider, str) and provider not in ("aetherforge-bootstrap", "")
            detail += f", provider={provider}"

        if not concept_ok:
            results.append(IterationResult(concept_ok=False, quiz_ok=False, detail=detail))
            continue

        quiz_status, quiz_body = post_json(opener, f"{base_url}/api/quiz/generate", {})
        quiz_obj = json.loads(quiz_body) if quiz_body else {}
        quiz_id = quiz_obj.get("quizId") if isinstance(quiz_obj, dict) else None
        quiz_ok = quiz_status == 200 and isinstance(quiz_id, str) and len(quiz_id) > 10
        results.append(
            IterationResult(
                concept_ok=True,
                quiz_ok=quiz_ok,
                detail=f"{detail}, quiz_status={quiz_status}",
            )
        )

    concept_successes = sum(1 for item in results if item.concept_ok)
    quiz_successes = sum(1 for item in results if item.quiz_ok)
    concept_rate = (concept_successes / iterations) * 100 if iterations else 0
    quiz_rate = (quiz_successes / iterations) * 100 if iterations else 0
    min_required = float(min_success_rate)
    passed = concept_rate >= min_required and quiz_rate >= min_required

    return passed, results, concept_rate, quiz_rate


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:3000")
    parser.add_argument("--iterations", type=int, default=20)
    parser.add_argument("--min-success-rate", type=float, default=95.0)
    parser.add_argument("--require-connected-provider", action="store_true")
    args = parser.parse_args()

    if args.iterations <= 0:
        print("iterations must be > 0")
        return 1

    try:
        passed, results, concept_rate, quiz_rate = run(
            args.base_url.rstrip("/"),
            args.iterations,
            args.min_success_rate,
            args.require_connected_provider,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"AI quality gate runtime error: {exc}")
        return 1

    for idx, result in enumerate(results, start=1):
        state = "PASS" if result.concept_ok and result.quiz_ok else "FAIL"
        print(f"iteration_{idx}: {state} ({result.detail})")

    print(f"concept_success_rate: {concept_rate:.2f}%")
    print(f"quiz_success_rate: {quiz_rate:.2f}%")
    print(f"required_min_success_rate: {args.min_success_rate:.2f}%")

    if not passed:
        return 1

    print("AI_QUALITY_GATE_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
