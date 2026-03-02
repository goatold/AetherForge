#!/usr/bin/env python3
"""Extended MVP smoke: quiz, flashcards, plan, resources, export, collab."""
import argparse, json, sys, urllib.request, urllib.parse, urllib.error, http.cookiejar
from dataclasses import dataclass

@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str

def make_opener():
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

def read_text(resp):
    return resp.read().decode("utf-8", "ignore")

def post_form(opener, url, payload):
    body = urllib.parse.urlencode(payload).encode()
    req = urllib.request.Request(url, data=body, method="POST",
        headers={"content-type": "application/x-www-form-urlencoded"})
    return opener.open(req, timeout=45)

def post_json(opener, url, payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, method="POST",
        headers={"content-type": "application/json"})
    try:
        resp = opener.open(req, timeout=60)
        return resp.status, read_text(resp)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", "ignore")

def get(opener, url):
    resp = opener.open(urllib.request.Request(url, method="GET"), timeout=45)
    return resp.status, read_text(resp)

def run(base_url):
    base_url = base_url.rstrip("/")
    checks = []
    opener = make_opener()
    post_form(opener, base_url + "/api/auth/sign-in",
        {"email": "alice.prephase3@example.com", "next": "/learn"})
    post_json(opener, base_url + "/api/ai/session", {
        "providerKey": "chatgpt-web",
        "mode": "browser_ui",
        "modelHint": "web-default",
        "loginUrl": "https://chatgpt.com"
    })
    st, body = post_json(opener, base_url + "/api/concepts/generate",
        {"topic": "Distributed Systems", "difficulty": "intermediate"})
    gen = json.loads(body) if body else {}
    aid = gen.get("artifactId")
    if not isinstance(aid, str) or len(aid) < 10:
        checks.append(CheckResult("setup_artifact", False, "generate failed"))
        return checks
    checks.append(CheckResult("setup_artifact", True, "ok"))
    st, body = post_json(opener, base_url + "/api/quiz/generate", {})
    gen = json.loads(body) if body else {}
    qid = gen.get("quizId")
    if st != 200 or not isinstance(qid, str):
        checks.append(CheckResult("quiz_generate", False, "status=" + str(st)))
    else:
        checks.append(CheckResult("quiz_generate", True, "ok"))
        st, body = post_json(opener, base_url + "/api/quiz/attempts/start", {"quizId": qid})
        start = json.loads(body) if body else {}
        attempt = start.get("attempt", {})
        attempt_id = attempt.get("id") if isinstance(attempt, dict) else None
        questions = start.get("questions", []) if isinstance(start.get("questions"), list) else []
        if st != 200 or not attempt_id:
            checks.append(CheckResult("quiz_start", False, "status=" + str(st)))
        else:
            checks.append(CheckResult("quiz_start", True, "ok"))
            resp_list = []
            for q in questions:
                qid_q = q.get("id") if isinstance(q, dict) else None
                qtype = q.get("type") if isinstance(q, dict) else None
                opts = q.get("options") if isinstance(q, dict) else []
                if not qid_q: continue
                if qtype == "short_answer":
                    resp_list.append({"questionId": qid_q, "answerText": "answer"})
                elif opts and isinstance(opts[0], dict) and opts[0].get("id"):
                    resp_list.append({"questionId": qid_q, "selectedOptionId": opts[0].get("id")})
                else:
                    resp_list.append({"questionId": qid_q})
            st, _ = post_json(opener, base_url + "/api/quiz/attempts/" + attempt_id + "/submit", {"responses": resp_list})
            checks.append(CheckResult("quiz_submit", st in (200, 201), "status=" + str(st)))
    st, body = get(opener, base_url + "/api/flashcards")
    try:
        obj = json.loads(body) if body else {}
        checks.append(CheckResult("flashcards", st == 200 and "flashcards" in obj, str(st)))
    except: checks.append(CheckResult("flashcards", False, "parse error"))
    st, _ = get(opener, base_url + "/plan")
    checks.append(CheckResult("plan_page", st == 200, str(st)))
    st, _ = get(opener, base_url + "/resources")
    checks.append(CheckResult("resources_page", st == 200, str(st)))
    st, body = get(opener, base_url + "/api/export/study-packet?sections=concepts&includeAnswerKey=0&pageSize=a4")
    checks.append(CheckResult("export", st == 200 and len(body or "") > 100, str(st)))
    st, body = get(opener, base_url + "/api/collab/members")
    obj = json.loads(body) if body and st == 200 else {}
    checks.append(CheckResult("collab", st == 200 and "members" in obj and "pendingInvites" in obj, str(st)))
    return checks

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--base-url", default="http://localhost:3000")
    args = p.parse_args()
    try: checks = run(args.base_url)
    except Exception as e: print("Error:", e); return 1
    failed = [c for c in checks if not c.ok]
    for c in checks: print(c.name + ": " + ("PASS" if c.ok else "FAIL") + " (" + c.detail + ")")
    print("Passed " + str(len(checks)-len(failed)) + "/" + str(len(checks)))
    return 1 if failed else 0

if __name__ == "__main__": sys.exit(main())
