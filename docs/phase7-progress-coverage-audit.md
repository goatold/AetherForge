# Phase 7 Progress and Coverage Audit

Date: 2026-03-03

## Scope and Sources

- `docs/plan.md`
- `docs/reliability-runbook.md`
- `docs/pilot-release-checklist.md`
- `package.json`
- `scripts/tests/*.py`
- `scripts/tests/*.sh`

## 1) Unfinished Functionalities

### Explicitly Remaining

- AI redesign track still has one open item:
  - Implement additional browser drivers.
  - Execute OAuth/API provider track.
  - Source: `docs/plan.md` (AI Browser-Auth Redesign section).

### Still In Progress by Phase Status

- Phase 3 (quiz hardening/expansion) remains in progress.
- Phase 4 (flashcards/SRS hardening/expansion) remains in progress.
- Phase 5 (plan/progress/resources hardening/expansion) remains in progress.
- Phase 6 (export/collaboration hardening/expansion) remains in progress.
- Collaboration track remains in progress.
- Phase 7 (reliability + release hardening) remains in progress.
- Source: `docs/plan.md` (Status Snapshot).

### Release-Readiness Not Yet Closed

- Pilot release checklist items are still unchecked for:
  - Performance.
  - Reliability.
  - Security/privacy.
  - AI quality confirmation and path split review.
  - Usability/demo readiness.
  - Final sign-off items.
- Source: `docs/pilot-release-checklist.md`.

### Operational Limitation Still Present

- `oauth_api` is intentionally rejected for current MVP reliability until OAuth/API track is implemented.
- Browser automation has first implementation for `chatgpt-web`; unsupported providers currently fall back.
- Source: `docs/reliability-runbook.md`.

## 2) Current Test Coverage (Implemented)

### Core Product Smokes

- `scripts/tests/pre_phase3_smoke.py`
  - Auth/sign-in, concept generation, artifacts retrieval, workspace isolation checks.
- `scripts/tests/mvp_smoke.py`
  - End-to-end happy path across concepts, quiz start/submit, flashcards list, export, collab members.

### Phase 6 Hardening Smokes

- `scripts/tests/run_phase6_hardening_smoke.sh`
  - `resources_concurrency_smoke.py`
  - `milestones_concurrency_smoke.py`
  - `collab_least_privilege_smoke.py`
  - `collab_role_conflict_smoke.py`
  - `collab_revoke_conflict_smoke.py`

### Phase 7 Reliability Smokes

- `scripts/tests/run_phase7_reliability_smoke.sh`
  - `internal_health_smoke.py`
  - `internal_jobs_smoke.py`
  - `internal_jobs_overlap_smoke.py`

### AI Hardening and Quality

- `scripts/tests/ai_connection_required_smoke.py`
  - Session contract validation and reconnect gating.
  - Provider/login/modelHint contract hardening.
  - Fallback-path signaling and provider attribution checks.
- `scripts/tests/ai_quality_gate.py`
  - 95% threshold loop for concepts+quiz.
  - Reports `generationPath` split (`browser_driver` vs `fallback`) and validates provider presence.

## 3) Coverage Gaps (Unfinished Test Coverage)

### High-Risk Reliability Branches Missing Deterministic Tests

- Internal health route lacks full state-matrix coverage (`ok`/`degraded`/`down` branch forcing):
  - Target: `src/app/api/internal/health/route.ts`
- Internal jobs route lacks explicit failure-ledger smoke (`running -> failed` contract under forced error):
  - Target: `src/app/api/internal/jobs/flashcards/refresh/route.ts`

### Partial API Lifecycle Coverage

The following routes exist but are not covered by dedicated reliability-focused scripts:

- Quiz attempts detail/list/compare edge-state contracts:
  - `src/app/api/quiz/attempts/route.ts`
  - `src/app/api/quiz/attempts/[attemptId]/route.ts`
  - `src/app/api/quiz/attempts/compare/route.ts`
- Flashcard generation/review contract paths (error/edge-state assertions):
  - `src/app/api/flashcards/generate/route.ts`
  - `src/app/api/flashcards/review/route.ts`
- Invite revoke endpoint explicit contract smoke:
  - `src/app/api/collab/invites/[inviteId]/route.ts`
- Progress events contract smoke:
  - `src/app/api/progress/events/route.ts`
- Sign-out route contract smoke:
  - `src/app/api/auth/sign-out/route.ts`

### Unit/Spec-Level Gaps

- No substantial unit/spec harness coverage is present for:
  - `src/lib/observability/*`
  - Other core library contracts listed in testing strategy (unit/integration sections).
- Current automated safety net is predominantly script-level smoke coverage.

## 4) Prioritized Next Test Additions (Phase 7 Risk Reduction)

1. **Internal health state matrix smoke (P0)**
   - New script: `scripts/tests/internal_health_state_matrix_smoke.py`
   - Validate forced branches and status-code contract: `ok=200`, `degraded/down=503`.

2. **Internal jobs failure-ledger smoke (P0)**
   - New script: `scripts/tests/internal_jobs_failure_ledger_smoke.py`
   - Validate failure response and `internal_job_runs` failure persistence semantics.

3. **Quiz attempt lifecycle reliability smoke (P1)**
   - New script: `scripts/tests/quiz_attempt_lifecycle_smoke.py`
   - Cover list/detail/compare edge states and stale/conflict behavior.

4. **Flashcards generate+review reliability smoke (P1)**
   - New script: `scripts/tests/flashcards_generation_review_smoke.py`
   - Cover invalid payloads, empty/edge queue states, review update persistence.

5. **Invite revoke contract smoke (P2)**
   - New script: `scripts/tests/collab_invite_revoke_smoke.py`
   - Verify authz boundary and conflict/not-found behavior.

## 5) Summary

- The platform is functionally advanced and heavily smoke-tested for current hardening work.
- Remaining risk is concentrated in branch-completeness and lifecycle edge cases for internal reliability and selected API surfaces.
- Closing P0/P1 tests above gives the strongest near-term reduction in Phase 7 release risk while keeping existing test style and tooling.
