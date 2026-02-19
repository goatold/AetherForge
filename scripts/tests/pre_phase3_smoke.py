#!/usr/bin/env python3
"""Pre-Phase-3 regression smoke test for AetherForge.

Usage:
  python3 scripts/tests/pre_phase3_smoke.py
  python3 scripts/tests/pre_phase3_smoke.py --base-url http://localhost:3002
"""

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


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        return None


def make_cookie_opener() -> urllib.request.OpenerDirector:
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def read_text(response: urllib.response.addinfourl) -> str:
    return response.read().decode("utf-8", "ignore")


def post_form(
    opener: urllib.request.OpenerDirector, url: str, payload: dict[str, str]
) -> urllib.response.addinfourl:
    body = urllib.parse.urlencode(payload).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    return opener.open(req, timeout=45)


def post_json(
    opener: urllib.request.OpenerDirector, url: str, payload: dict[str, object]
) -> urllib.response.addinfourl:
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"content-type": "application/json"},
    )
    return opener.open(req, timeout=45)


def run(base_url: str) -> list[CheckResult]:
    checks: list[CheckResult] = []

    landing = urllib.request.urlopen(f"{base_url}/", timeout=45)
    landing_html = read_text(landing)
    checks.append(CheckResult("landing_200", landing.status == 200, str(landing.status)))
    checks.append(CheckResult("landing_brand", "AetherForge" in landing_html, "AetherForge in body"))

    guard_opener = urllib.request.build_opener(NoRedirect())
    try:
        guard_opener.open(urllib.request.Request(f"{base_url}/learn", method="GET"), timeout=45)
        checks.append(CheckResult("guard_redirect", False, "expected redirect"))
    except urllib.error.HTTPError as exc:
        location = exc.headers.get("Location", "")
        checks.append(
            CheckResult(
                "guard_redirect",
                exc.code in (302, 303, 307, 308) and "/sign-in?next=%2Flearn" in location,
                f"{exc.code} {location}",
            )
        )

    alice = make_cookie_opener()
    alice_signin = post_form(
        alice, f"{base_url}/api/auth/sign-in", {"email": "alice.prephase3@example.com", "next": "/learn"}
    )
    checks.append(CheckResult("alice_signin", alice_signin.status == 200, str(alice_signin.status)))

    alice_learn = alice.open(f"{base_url}/learn", timeout=45)
    alice_learn_html = read_text(alice_learn)
    checks.append(CheckResult("alice_learn_200", alice_learn.status == 200, str(alice_learn.status)))
    checks.append(
        CheckResult(
            "learn_sections",
            all(
                section in alice_learn_html
                for section in ("Generate concept graph artifact", "Artifacts", "Concept explorer")
            ),
            "learn sections visible",
        )
    )

    generated = post_json(
        alice,
        f"{base_url}/api/concepts/generate",
        {"topic": "Distributed Systems", "difficulty": "intermediate"},
    )
    generated_obj = json.loads(read_text(generated))
    artifact_id = generated_obj.get("artifactId")
    checks.append(
        CheckResult(
            "generate_artifact",
            isinstance(artifact_id, str) and len(artifact_id) > 10,
            str(artifact_id),
        )
    )
    if not isinstance(artifact_id, str):
        return checks

    artifact_page = alice.open(f"{base_url}/learn/artifacts/{artifact_id}", timeout=45)
    artifact_html = read_text(artifact_page)
    artifact_reload = alice.open(f"{base_url}/learn/artifacts/{artifact_id}", timeout=45)
    _ = read_text(artifact_reload)
    checks.append(CheckResult("artifact_200", artifact_page.status == 200, str(artifact_page.status)))
    checks.append(
        CheckResult("artifact_reload_200", artifact_reload.status == 200, str(artifact_reload.status))
    )
    checks.append(
        CheckResult(
            "artifact_sections",
            all(marker in artifact_html for marker in ("Artifact v", "Concept graph", "Generated concepts", "Source:")),
            "artifact sections visible",
        )
    )

    artifact_api = alice.open(f"{base_url}/api/concepts/artifacts/{artifact_id}", timeout=45)
    artifact_api_obj = json.loads(read_text(artifact_api))
    concepts = artifact_api_obj.get("concepts", [])
    checks.append(
        CheckResult(
            "artifact_api_shape",
            isinstance(artifact_api_obj.get("artifact"), dict) and isinstance(concepts, list),
            "artifact + concepts payload",
        )
    )

    concept_id = concepts[0]["id"] if concepts else None
    if isinstance(concept_id, str):
        concept_page = alice.open(f"{base_url}/learn/{concept_id}", timeout=45)
        concept_html = read_text(concept_page)
        checks.append(CheckResult("concept_200", concept_page.status == 200, str(concept_page.status)))
        checks.append(
            CheckResult(
                "concept_examples",
                "Examples and case studies" in concept_html,
                "examples section visible",
            )
        )
    else:
        checks.append(CheckResult("concept_200", False, "no concept id returned"))
        checks.append(CheckResult("concept_examples", False, "no concept id returned"))

    bob = make_cookie_opener()
    _ = post_form(bob, f"{base_url}/api/auth/sign-in", {"email": "bob.prephase3@example.com", "next": "/learn"})
    bob_artifacts = read_text(bob.open(f"{base_url}/api/concepts/artifacts", timeout=45))
    checks.append(
        CheckResult(
            "isolation",
            artifact_id not in bob_artifacts,
            "alice artifact hidden from bob",
        )
    )

    workspace = alice.open(f"{base_url}/api/workspace", timeout=45)
    workspace_obj = json.loads(read_text(workspace))
    checks.append(CheckResult("workspace_200", workspace.status == 200, str(workspace.status)))
    checks.append(
        CheckResult("workspace_shape", isinstance(workspace_obj.get("workspace"), dict), "workspace object")
    )

    return checks


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--base-url",
        default="http://localhost:3000",
        help="App base URL (default: http://localhost:3000)",
    )
    args = parser.parse_args()

    try:
        checks = run(args.base_url.rstrip("/"))
    except Exception as exc:  # noqa: BLE001
        print(f"Smoke test failed with runtime error: {exc}")
        return 1

    failed = [check for check in checks if not check.ok]
    for check in checks:
        state = "PASS" if check.ok else "FAIL"
        print(f"{check.name}: {state} ({check.detail})")
    print(f"Passed {len(checks) - len(failed)}/{len(checks)} checks")

    if failed:
        return 1

    print("PRE_PHASE3_SMOKE_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
