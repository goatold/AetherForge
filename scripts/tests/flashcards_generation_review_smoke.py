#!/usr/bin/env python3
"""TDD smoke: flashcards generation/review reliability contracts."""

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
        resp = opener.open(req, timeout=90)
        return resp.status, read_text(resp)
    except urllib.error.HTTPError as exc:
        return exc.code, read_text(exc)


def parse_json(raw: str):
    try:
        return json.loads(raw) if raw else {}
    except Exception:  # noqa: BLE001
        return {}


def build_submit_responses(start_obj: dict) -> list[dict[str, str]]:
    quiz_obj = start_obj.get("quiz") if isinstance(start_obj, dict) else None
    questions = quiz_obj.get("questions") if isinstance(quiz_obj, dict) else None
    if not isinstance(questions, list):
        return []
    responses: list[dict[str, str]] = []
    for question in questions:
        if not isinstance(question, dict):
            continue
        qid = question.get("id")
        qtype = question.get("type")
        options = question.get("options")
        if not isinstance(qid, str):
            continue
        if qtype == "short_answer":
            responses.append({"questionId": qid, "answerText": "weak-answer"})
        elif isinstance(options, list):
            selected = next((option for option in options if isinstance(option, dict) and option.get("id")), None)
            if selected and isinstance(selected.get("id"), str):
                responses.append({"questionId": qid, "selectedOptionId": selected["id"]})
    return responses


def run(base_url: str):
    checks: list[CheckResult] = []
    opener = make_cookie_opener()
    post_form(
        opener,
        f"{base_url}/api/auth/sign-in",
        {"email": "alice.prephase3@example.com", "next": "/flashcards"},
    )

    # Baseline generate is environment-dependent (seeded misses may already exist), so only enforce contract shape.
    baseline_status, baseline_body = request_json(opener, "POST", f"{base_url}/api/flashcards/generate")
    baseline_obj = parse_json(baseline_body)
    baseline_created_count = baseline_obj.get("createdCount") if isinstance(baseline_obj, dict) else None
    baseline_error = baseline_obj.get("error") if isinstance(baseline_obj, dict) else None
    checks.append(
        CheckResult(
            "generate_baseline_status",
            baseline_status in (200, 400),
            f"status={baseline_status}",
        )
    )
    checks.append(
        CheckResult(
            "generate_baseline_shape",
            (baseline_status == 200 and isinstance(baseline_created_count, int))
            or (baseline_status == 400 and isinstance(baseline_error, str)),
            f"createdCount={baseline_created_count},error={baseline_error}",
        )
    )

    # Build weak-concept signal via quiz attempt.
    request_json(
        opener,
        "POST",
        f"{base_url}/api/ai/session",
        {
            "providerKey": "chatgpt-web",
            "mode": "browser_ui",
            "modelHint": "flashcards-smoke",
            "loginUrl": "https://chatgpt.com",
        },
    )
    request_json(opener, "POST", f"{base_url}/api/concepts/generate", {"topic": "Flashcards Reliability", "difficulty": "intermediate"})
    quiz_status, quiz_body = request_json(opener, "POST", f"{base_url}/api/quiz/generate", {})
    quiz_obj = parse_json(quiz_body)
    quiz_id = quiz_obj.get("quizId") if isinstance(quiz_obj, dict) else None
    checks.append(CheckResult("quiz_generated_for_flashcards", quiz_status == 200 and isinstance(quiz_id, str), f"status={quiz_status}"))
    if not isinstance(quiz_id, str):
        return checks

    start_status, start_body = request_json(opener, "POST", f"{base_url}/api/quiz/attempts/start", {"quizId": quiz_id})
    start_obj = parse_json(start_body)
    attempt_obj = start_obj.get("attempt") if isinstance(start_obj, dict) else None
    attempt_id = attempt_obj.get("id") if isinstance(attempt_obj, dict) else None
    checks.append(CheckResult("quiz_attempt_started_for_flashcards", start_status == 200 and isinstance(attempt_id, str), f"status={start_status}"))
    if not isinstance(attempt_id, str):
        return checks
    responses = build_submit_responses(start_obj)
    submit_status, _ = request_json(
        opener,
        "POST",
        f"{base_url}/api/quiz/attempts/{attempt_id}/submit",
        {"responses": responses},
    )
    checks.append(CheckResult("quiz_attempt_submitted_for_flashcards", submit_status == 200, f"status={submit_status}"))

    generate_status, generate_body = request_json(opener, "POST", f"{base_url}/api/flashcards/generate")
    generate_obj = parse_json(generate_body)
    created_count = generate_obj.get("createdCount") if isinstance(generate_obj, dict) else None
    checks.append(
        CheckResult(
            "flashcards_generate_after_misses",
            generate_status == 200 and isinstance(created_count, int),
            f"status={generate_status},createdCount={created_count}",
        )
    )

    list_status, list_body = request_json(opener, "GET", f"{base_url}/api/flashcards")
    list_obj = parse_json(list_body)
    flashcards = list_obj.get("flashcards") if isinstance(list_obj, dict) else None
    checks.append(CheckResult("flashcards_list_contract", list_status == 200 and isinstance(flashcards, list), f"status={list_status}"))
    if not isinstance(flashcards, list) or len(flashcards) == 0 or not isinstance(flashcards[0], dict):
        return checks

    flashcard_id = flashcards[0].get("id")
    checks.append(CheckResult("flashcard_id_available", isinstance(flashcard_id, str), str(flashcard_id)))
    if not isinstance(flashcard_id, str):
        return checks

    invalid_recall_status, _ = request_json(
        opener,
        "POST",
        f"{base_url}/api/flashcards/review",
        {"flashcardId": flashcard_id, "recallScore": 9},
    )
    checks.append(
        CheckResult(
            "flashcard_review_invalid_recall_rejected",
            invalid_recall_status == 400,
            f"status={invalid_recall_status}",
        )
    )

    whitespace_id_status, whitespace_id_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/flashcards/review",
        {"flashcardId": f" {flashcard_id} ", "recallScore": 3},
    )
    whitespace_id_obj = parse_json(whitespace_id_body)
    whitespace_id_error = whitespace_id_obj.get("error") if isinstance(whitespace_id_obj, dict) else None
    checks.append(
        CheckResult(
            "flashcard_review_whitespace_id_rejected",
            whitespace_id_status == 400,
            f"status={whitespace_id_status}",
        )
    )
    checks.append(
        CheckResult(
            "flashcard_review_whitespace_id_message",
            isinstance(whitespace_id_error, str) and "flashcardid" in whitespace_id_error.lower(),
            str(whitespace_id_error),
        )
    )

    invalid_uuid_status, invalid_uuid_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/flashcards/review",
        {"flashcardId": "not-a-uuid", "recallScore": 3},
    )
    invalid_uuid_obj = parse_json(invalid_uuid_body)
    invalid_uuid_error = invalid_uuid_obj.get("error") if isinstance(invalid_uuid_obj, dict) else None
    checks.append(
        CheckResult(
            "flashcard_review_invalid_uuid_rejected",
            invalid_uuid_status == 400,
            f"status={invalid_uuid_status}",
        )
    )
    checks.append(
        CheckResult(
            "flashcard_review_invalid_uuid_message",
            isinstance(invalid_uuid_error, str) and "uuid" in invalid_uuid_error.lower(),
            str(invalid_uuid_error),
        )
    )

    review_status, review_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/flashcards/review",
        {"flashcardId": flashcard_id, "recallScore": 3},
    )
    review_obj = parse_json(review_body)
    flashcard_after = review_obj.get("flashcard") if isinstance(review_obj, dict) else None
    review_row = review_obj.get("review") if isinstance(review_obj, dict) else None
    checks.append(CheckResult("flashcard_review_success", review_status == 200, f"status={review_status}"))
    checks.append(
        CheckResult(
            "flashcard_review_response_shape",
            isinstance(flashcard_after, dict) and isinstance(review_row, dict),
            "flashcard/review objects",
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

    print("FLASHCARDS_GENERATION_REVIEW_SMOKE_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
