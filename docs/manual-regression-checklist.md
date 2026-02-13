# AetherForge Manual Regression Checklist Template

**Purpose:** Reusable manual QA checklist for each phase release candidate.  
**How to use:** Copy this template section into a dated report, execute each step, mark status, and record evidence.  
**Run cadence:** At minimum once per phase milestone and before merge/release cut.

---

## Test Run Metadata

- Date:
- Tester:
- Branch / commit:
- Environment (local/staging):
- App URL:
- Database snapshot/seed used:
- Browser(s):

### Status Legend

- `PASS` - expected behavior observed
- `FAIL` - behavior deviates from expectation
- `BLOCKED` - could not execute due to environment/tooling issue
- `N/A` - not applicable for this phase

---

## 1) Core Smoke Flow

| # | Area | Step | Expected | Status | Evidence / Notes |
|---|------|------|----------|--------|------------------|
| 1.1 | Landing | Open `/` | Landing page renders with app branding and primary CTA(s) |  |  |
| 1.2 | Navigation | Open key route(s) from landing | Navigation works and target pages load |  |  |
| 1.3 | Health | Reload current route | Route remains stable after refresh |  |  |

---

## 2) Auth and Route Protection

| # | Area | Step | Expected | Status | Evidence / Notes |
|---|------|------|----------|--------|------------------|
| 2.1 | Guarding | Access protected route signed out (e.g. `/learn`) | Redirects to `/sign-in` with `next` param |  |  |
| 2.2 | Sign-in | Submit valid auth form | Session is established, redirect succeeds |  |  |
| 2.3 | App shell | Open app shell after sign-in | User identity and nav render correctly |  |  |
| 2.4 | Sign-out | Use sign-out action | Session cleared; protected routes require auth again |  |  |

---

## 3) Workspace and Data Isolation

| # | Area | Step | Expected | Status | Evidence / Notes |
|---|------|------|----------|--------|------------------|
| 3.1 | Session A | Sign in as User A and create/read content | Content visible for User A |  |  |
| 3.2 | Session B | In isolated session, sign in as User B and create/read content | Content visible for User B |  |  |
| 3.3 | Isolation | Return to Session A | User B content not visible in User A session |  |  |
| 3.4 | Isolation | Return to Session B | User A content not visible in User B session |  |  |

---

## 4) API Contract Smoke Checks

> Run these in a signed-in session and capture response snippets.

| # | Endpoint | Method | Expected | Status | Evidence / Notes |
|---|----------|--------|----------|--------|------------------|
| 4.1 | `/api/workspace` | GET | 200 with valid workspace JSON payload |  |  |
| 4.2 | `/api/concepts/artifacts` | GET | 200 with array payload shape |  |  |
| 4.3 | Primary phase endpoint #1 |  | Status + response schema valid |  |  |
| 4.4 | Primary phase endpoint #2 |  | Status + response schema valid |  |  |

---

## 5) Phase-Specific Functional Checklist

> Replace/add rows for the current phase. Keep flows user-visible and outcome-based.

| # | Feature Module | Step | Expected | Status | Evidence / Notes |
|---|----------------|------|----------|--------|------------------|
| 5.1 | Module A | Create new artifact/item | Item persists and appears in list view |  |  |
| 5.2 | Module A | Open detail view from list | Detail page loads correct record |  |  |
| 5.3 | Module B | Execute core action | User receives expected output/feedback |  |  |
| 5.4 | Module B | Reload app and revisit | Persisted state reloads without regeneration/re-entry |  |  |
| 5.5 | Permissions | Access with alternate role/session | Role boundaries enforced correctly |  |  |

---

## 6) Regression Across Existing Modules

> Ensure new phase work does not break prior phase workflows.

| # | Existing Module | Step | Expected | Status | Evidence / Notes |
|---|------------------|------|----------|--------|------------------|
| 6.1 | Onboarding | Open and complete baseline path | No regressions in prior UX flow |  |  |
| 6.2 | Learn/Concepts | Browse existing concept views | Existing behaviors remain intact |  |  |
| 6.3 | Quiz (if available) | Open/run smoke path | Route and key interactions still work |  |  |
| 6.4 | Flashcards (if available) | Open/run smoke path | Route and key interactions still work |  |  |
| 6.5 | Plan/Resources (if available) | Open/run smoke path | Route and key interactions still work |  |  |

---

## 7) Error Handling and Edge Cases

| # | Scenario | Step | Expected | Status | Evidence / Notes |
|---|----------|------|----------|--------|------------------|
| 7.1 | Missing required input | Submit form without required fields | Validation message shown; no server crash |  |  |
| 7.2 | Invalid payload | Send malformed request to key API | Graceful 4xx response with useful error |  |  |
| 7.3 | Unauthorized access | Call protected API signed out | 401/redirect behavior is correct |  |  |
| 7.4 | Empty states | Visit page with no data | Clear empty-state guidance is shown |  |  |

---

## 8) Basic Performance and UX Sanity

| # | Check | Step | Expected | Status | Evidence / Notes |
|---|-------|------|----------|--------|------------------|
| 8.1 | Route transitions | Navigate core routes | Typical transition feels responsive |  |  |
| 8.2 | Long action feedback | Trigger generation/process action | Loading state is visible until completion |  |  |
| 8.3 | Render stability | Refresh during active data pages | No obvious layout break or crash |  |  |

---

## 9) Bugs / Deviations

| ID | Severity | Area | Description | Repro Steps | Expected | Actual | Owner |
|----|----------|------|-------------|-------------|----------|--------|-------|
|  |  |  |  |  |  |  |  |

---

## 10) Sign-Off Summary

- Total checks:
- Passed:
- Failed:
- Blocked:
- Not applicable:

### Release Recommendation

- [ ] Go
- [ ] No-Go

### Follow-ups

- Required fixes before merge/release:
- Deferred items (with issue links):

---

## Optional: Quick Curl Session Script Snippets

> Useful when browser automation cannot reach local app.

- Session A cookie jar:
  - `curl -c /tmp/a.cookies -b /tmp/a.cookies -i http://localhost:3000/sign-in`
- Session B cookie jar:
  - `curl -c /tmp/b.cookies -b /tmp/b.cookies -i http://localhost:3000/sign-in`
- Signed-in API smoke:
  - `curl -c /tmp/a.cookies -b /tmp/a.cookies -i http://localhost:3000/api/workspace`

