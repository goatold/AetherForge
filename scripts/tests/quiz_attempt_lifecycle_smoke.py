#!/usr/bin/env python3
"""TDD smoke: quiz attempt lifecycle + compare reliability contracts."""

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


def build_responses(questions: list[dict]) -> list[dict[str, str]]:
    responses: list[dict[str, str]] = []
    for question in questions:
        qid = question.get("id")
        qtype = question.get("type")
        options = question.get("options")
        if not isinstance(qid, str):
            continue
        if qtype == "short_answer":
            responses.append({"questionId": qid, "answerText": "deterministic answer"})
        elif isinstance(options, list):
            selected = next((option for option in options if isinstance(option, dict) and option.get("id")), None)
            if selected and isinstance(selected.get("id"), str):
                responses.append({"questionId": qid, "selectedOptionId": selected["id"]})
    return responses


def run(base_url: str):
    checks: list[CheckResult] = []
    opener = make_cookie_opener()
    post_form(opener, f"{base_url}/api/auth/sign-in", {"email": "alice.prephase3@example.com", "next": "/quiz"})

    request_json(
        opener,
        "POST",
        f"{base_url}/api/ai/session",
        {
            "providerKey": "chatgpt-web",
            "mode": "browser_ui",
            "modelHint": "quiz-lifecycle-smoke",
            "loginUrl": "https://chatgpt.com",
        },
    )
    request_json(opener, "POST", f"{base_url}/api/concepts/generate", {"topic": "Quiz Lifecycle", "difficulty": "intermediate"})

    quiz_status, quiz_body = request_json(opener, "POST", f"{base_url}/api/quiz/generate", {})
    quiz_obj = parse_json(quiz_body)
    quiz_id = quiz_obj.get("quizId") if isinstance(quiz_obj, dict) else None
    checks.append(CheckResult("quiz_generated_for_lifecycle", quiz_status == 200 and isinstance(quiz_id, str), f"status={quiz_status}"))
    if not isinstance(quiz_id, str):
        return checks

    start_status, start_body = request_json(opener, "POST", f"{base_url}/api/quiz/attempts/start", {"quizId": quiz_id})
    start_obj = parse_json(start_body)
    attempt = start_obj.get("attempt") if isinstance(start_obj, dict) else None
    attempt_id = attempt.get("id") if isinstance(attempt, dict) else None
    quiz_obj_start = start_obj.get("quiz") if isinstance(start_obj, dict) else None
    questions = quiz_obj_start.get("questions") if isinstance(quiz_obj_start, dict) else None
    checks.append(CheckResult("attempt_started", start_status == 200 and isinstance(attempt_id, str), f"status={start_status}"))
    checks.append(CheckResult("attempt_start_includes_questions", isinstance(questions, list) and len(questions) > 0, f"count={0 if not isinstance(questions, list) else len(questions)}"))
    if not isinstance(attempt_id, str) or not isinstance(questions, list) or not questions:
        return checks

    review_before_status, _ = request_json(opener, "GET", f"{base_url}/api/quiz/attempts/{attempt_id}")
    checks.append(CheckResult("review_before_submit_rejected", review_before_status == 409, f"status={review_before_status}"))

    valid_responses = build_responses(questions)
    checks.append(CheckResult("valid_response_payload_built", len(valid_responses) > 0, f"count={len(valid_responses)}"))
    if not valid_responses:
        return checks

    duplicated = [valid_responses[0], valid_responses[0], *valid_responses[1:]]
    duplicate_status, duplicate_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/quiz/attempts/{attempt_id}/submit",
        {"responses": duplicated},
    )
    duplicate_obj = parse_json(duplicate_body)
    duplicate_error = duplicate_obj.get("error") if isinstance(duplicate_obj, dict) else None
    checks.append(CheckResult("duplicate_question_response_rejected", duplicate_status == 400, f"status={duplicate_status}"))
    checks.append(
        CheckResult(
            "duplicate_question_response_error_message",
            isinstance(duplicate_error, str) and "duplicate" in duplicate_error.lower(),
            str(duplicate_error),
        )
    )

    submit_status, submit_body = request_json(
        opener,
        "POST",
        f"{base_url}/api/quiz/attempts/{attempt_id}/submit",
        {"responses": valid_responses},
    )
    submit_obj = parse_json(submit_body)
    feedback = submit_obj.get("feedback") if isinstance(submit_obj, dict) else None
    checks.append(CheckResult("attempt_submitted", submit_status == 200, f"status={submit_status}"))
    checks.append(CheckResult("attempt_submit_feedback_shape", isinstance(feedback, dict), "feedback object"))

    review_after_status, review_after_body = request_json(opener, "GET", f"{base_url}/api/quiz/attempts/{attempt_id}")
    review_after_obj = parse_json(review_after_body)
    review_rows = review_after_obj.get("review") if isinstance(review_after_obj, dict) else None
    checks.append(CheckResult("review_after_submit_available", review_after_status == 200, f"status={review_after_status}"))
    checks.append(CheckResult("review_after_submit_rows", isinstance(review_rows, list) and len(review_rows) > 0, f"count={0 if not isinstance(review_rows, list) else len(review_rows)}"))

    list_status, list_body = request_json(opener, "GET", f"{base_url}/api/quiz/attempts?timeframeDays=999")
    list_obj = parse_json(list_body)
    timeframe = list_obj.get("timeframeDays") if isinstance(list_obj, dict) else None
    attempts = list_obj.get("attempts") if isinstance(list_obj, dict) else None
    checks.append(CheckResult("attempts_list_invalid_timeframe_defaults", list_status == 200 and timeframe == 30, f"timeframe={timeframe},status={list_status}"))
    checks.append(CheckResult("attempts_list_shape", isinstance(attempts, list), f"type={type(attempts).__name__}"))

    second_start_status, second_start_body = request_json(opener, "POST", f"{base_url}/api/quiz/attempts/start", {"quizId": quiz_id})
    second_start_obj = parse_json(second_start_body)
    second_attempt = second_start_obj.get("attempt") if isinstance(second_start_obj, dict) else None
    second_attempt_id = second_attempt.get("id") if isinstance(second_attempt, dict) else None
    second_quiz_obj = second_start_obj.get("quiz") if isinstance(second_start_obj, dict) else None
    second_questions = second_quiz_obj.get("questions") if isinstance(second_quiz_obj, dict) else []
    checks.append(CheckResult("second_attempt_started", second_start_status == 200 and isinstance(second_attempt_id, str), f"status={second_start_status}"))
    if not isinstance(second_attempt_id, str):
        return checks

    second_responses = build_responses(second_questions if isinstance(second_questions, list) else [])
    second_submit_status, _ = request_json(
        opener,
        "POST",
        f"{base_url}/api/quiz/attempts/{second_attempt_id}/submit",
        {"responses": second_responses},
    )
    checks.append(CheckResult("second_attempt_submitted", second_submit_status == 200, f"status={second_submit_status}"))

    compare_status, compare_body = request_json(opener, "GET", f"{base_url}/api/quiz/attempts/compare?timeframeDays=30")
    compare_obj = parse_json(compare_body)
    comparison = compare_obj.get("comparison") if isinstance(compare_obj, dict) else None
    checks.append(CheckResult("attempt_compare_status", compare_status == 200, f"status={compare_status}"))
    checks.append(CheckResult("attempt_compare_available_after_two_submits", isinstance(comparison, dict), f"type={type(comparison).__name__}"))

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

    print("QUIZ_ATTEMPT_LIFECYCLE_SMOKE_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
