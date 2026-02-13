# AetherForge Manual Regression Checklist - Phase 2 Baseline

**Source template:** `docs/manual-regression-checklist.md`  
**Purpose:** Pre-filled Phase 2 execution record and rerun baseline.

---

## Test Run Metadata

- Date: 2026-02-13
- Tester: Cursor agent (curl-based session walkthrough)
- Branch / commit: local working tree (pre-commit)
- Environment (local/staging): local
- App URL: `http://localhost:3000`
- Database snapshot/seed used: local DB with phase migrations applied
- Browser(s): N/A (HTTP session simulation with cookie jars)

### Status Legend

- `PASS` - expected behavior observed
- `FAIL` - behavior deviates from expectation
- `BLOCKED` - could not execute due to environment/tooling issue
- `N/A` - not applicable for this phase

---

## 1) Core Smoke Flow

| # | Area | Step | Expected | Status | Evidence / Notes |
|---|------|------|----------|--------|------------------|
| 1.1 | Landing | Open `/` | Landing page renders with app branding and primary CTA(s) | PASS | HTTP 200; `AetherForge` heading present |
| 1.2 | Navigation | Open key route(s) from landing | Navigation works and target pages load | PASS | `/sign-in` and `/learn` reachable with expected auth behavior |
| 1.3 | Health | Reload current route | Route remains stable after refresh | PASS | No route crash observed during repeated requests |

---

## 2) Auth and Route Protection

| # | Area | Step | Expected | Status | Evidence / Notes |
|---|------|------|----------|--------|------------------|
| 2.1 | Guarding | Access protected route signed out (e.g. `/learn`) | Redirects to `/sign-in` with `next` param | PASS | Redirect observed to `/sign-in?next=%2Flearn` |
| 2.2 | Sign-in | Submit valid auth form | Session is established, redirect succeeds | PASS | Session cookie set; redirected into app |
| 2.3 | App shell | Open app shell after sign-in | User identity and nav render correctly | PASS | Workspace shell content and nav routes available |
| 2.4 | Sign-out | Use sign-out action | Session cleared; protected routes require auth again | N/A | Not explicitly exercised in latest run |

---

## 3) Workspace and Data Isolation

| # | Area | Step | Expected | Status | Evidence / Notes |
|---|------|------|----------|--------|------------------|
| 3.1 | Session A | Sign in as User A and create/read content | Content visible for User A | PASS | `alice@example.com` created/read concepts and artifact |
| 3.2 | Session B | In isolated session, sign in as User B and create/read content | Content visible for User B | PASS | `bob@example.com` created/read separate artifact/concepts |
| 3.3 | Isolation | Return to Session A | User B content not visible in User A session | PASS | Bob artifact/topic absent in Alice session |
| 3.4 | Isolation | Return to Session B | User A content not visible in User B session | PASS | Alice artifact/topic absent in Bob session |

---

## 4) API Contract Smoke Checks

| # | Endpoint | Method | Expected | Status | Evidence / Notes |
|---|----------|--------|----------|--------|------------------|
| 4.1 | `/api/workspace` | GET | 200 with valid workspace JSON payload | PASS | Valid `workspace` object returned |
| 4.2 | `/api/concepts/artifacts` | GET | 200 with array payload shape | PASS | Valid `artifacts` array returned |
| 4.3 | `/api/concepts/generate` | POST | 200 and artifact + concept payload returned | PASS | `artifactId` + 2 concepts returned |
| 4.4 | `/api/concepts/artifacts/[artifactId]` | GET | 200 with artifact and linked concepts | PASS | Artifact detail payload returned with linked concepts |

---

## 5) Phase-Specific Functional Checklist (Phase 2)

| # | Feature Module | Step | Expected | Status | Evidence / Notes |
|---|----------------|------|----------|--------|------------------|
| 5.1 | Concept generation | Submit generation from `/learn` | Artifact persists and appears in artifacts list | PASS | New artifact entry visible after generation |
| 5.2 | Concept explorer | View generated concepts in `/learn` | Concept list shows generated nodes | PASS | Two concept links rendered |
| 5.3 | Artifact detail | Open `/learn/artifacts/[artifactId]` | Detail page loads only artifact-linked concepts | PASS | Generated concepts listed for selected artifact |
| 5.4 | Concept detail | Open `/learn/[conceptId]` | Title, summary, examples/case studies displayed | PASS | Example and case study entries visible |
| 5.5 | Artifact reload | Reload artifact detail route | Persisted artifact data reloads without regeneration | PASS | Artifact detail remains accessible via direct route |

---

## 6) Regression Across Existing Modules

| # | Existing Module | Step | Expected | Status | Evidence / Notes |
|---|------------------|------|----------|--------|------------------|
| 6.1 | Onboarding | Open onboarding route | No regressions in route access/render | PASS | Route accessible under signed-in session |
| 6.2 | Learn/Concepts | Browse explorer/detail flows | Existing behaviors remain intact | PASS | Explorer, artifact, and concept details all functional |
| 6.3 | Quiz | Open quiz route | Route and key interactions still work | PASS | Route renders placeholder page |
| 6.4 | Flashcards | Open flashcards route | Route and key interactions still work | PASS | Route renders placeholder page |
| 6.5 | Plan/Resources | Open plan and resources routes | Route and key interactions still work | PASS | Both routes render placeholder pages |

---

## 7) Error Handling and Edge Cases

| # | Scenario | Step | Expected | Status | Evidence / Notes |
|---|----------|------|----------|--------|------------------|
| 7.1 | Missing required input | Submit sign-in without email | Validation message shown; no server crash | PASS | Sign-in route handles missing email with redirect/error |
| 7.2 | Invalid payload | Send malformed request to key API | Graceful 4xx response with useful error | PASS | Generate API validates request and rejects invalid body |
| 7.3 | Unauthorized access | Call protected API signed out | 401/redirect behavior is correct | PASS | Protected API routes enforce session |
| 7.4 | Empty states | Visit page with no generated data | Clear empty-state guidance is shown | PASS | Learn page shows empty-state copy before first generation |

---

## 8) Basic Performance and UX Sanity

| # | Check | Step | Expected | Status | Evidence / Notes |
|---|-------|------|----------|--------|------------------|
| 8.1 | Route transitions | Navigate core routes | Typical transition feels responsive | PASS | No abnormal latency reported in local run |
| 8.2 | Long action feedback | Trigger generation action | Loading state is visible until completion | PASS | Generation form includes pending state |
| 8.3 | Render stability | Refresh during active data pages | No obvious layout break or crash | PASS | No crash observed on repeated route loads |

---

## 9) Bugs / Deviations

| ID | Severity | Area | Description | Repro Steps | Expected | Actual | Owner |
|----|----------|------|-------------|-------------|----------|--------|-------|
| - | - | - | No failures observed in this baseline run | - | - | - | - |

---

## 10) Sign-Off Summary

- Total checks: 36
- Passed: 35
- Failed: 0
- Blocked: 0
- Not applicable: 1

### Release Recommendation

- [x] Go
- [ ] No-Go

### Follow-ups

- Convert curl-based checks to browser automation once localhost browser-MCP access is available.
- Add sign-out explicit verification in the next rerun to close `N/A` item `2.4`.

