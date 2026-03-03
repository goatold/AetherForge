# AetherForge Reliability Runbook (Baseline)

This runbook covers first-response checks for the MVP reliability path.

## Scope

- Internal health endpoint for runtime checks.
- Flashcard queue refresh job execution and history.
- Common recovery steps for degraded states.

## Preconditions

- `.env.local` includes:
  - `NEXT_PUBLIC_APP_URL`
  - `INTERNAL_JOB_TOKEN`
  - `DATABASE_URL`
- For experimental browser automation path:
  - `AI_BROWSER_AUTOMATION=1`
  - Playwright browser installed: `npx playwright install chromium`
- App server is running.

## Primary Commands

- Check internal health:
  - `npm run health:check`
  - Override target safely per run (without editing `.env.local`):
    - `NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000 INTERNAL_JOB_TOKEN=... npm run health:check`
- Smoke-check internal health auth + response contract:
  - `npm run test:smoke:internal-health`
- Smoke-check deterministic internal health state matrix (`ok`/`degraded`/`down`):
  - `npm run test:smoke:internal-health-state-matrix`
- Trigger flashcard queue refresh:
  - `npm run job:flashcards:refresh`
- Smoke-check internal job auth + response contract:
  - `npm run test:smoke:internal-jobs`
- Smoke-check internal job failure-ledger contract:
  - `npm run test:smoke:internal-jobs-failure-ledger`
- Smoke-check internal job overlap rejection contract:
  - `npm run test:smoke:internal-jobs-overlap`
- Smoke-check AI provider manual-connection contract:
  - `npm run test:smoke:ai-connection-required`
- Smoke-check flashcards generation/review reliability contract:
  - `npm run test:smoke:flashcards-generation-review`
- Run consolidated Phase 7 reliability smoke gate:
  - `npm run test:smoke:phase7-reliability`
- Run AI schema quality gate (95% minimum, real provider):
  - `npm run test:quality:ai-schema`
- Validate app quality gates:
  - `npm run lint && npm run build`

## Health Endpoint Contract

- Endpoint: `GET /api/internal/health`
- Auth: `Authorization: Bearer <INTERNAL_JOB_TOKEN>`
- Deterministic test mode (token-authenticated): optional `testMode` query for smoke coverage:
  - `force_ok` -> returns `status: "ok"` with HTTP `200`
  - `force_degraded` -> returns `status: "degraded"` with HTTP `503`
  - `force_down` -> returns `status: "down"` with HTTP `503`
- Status values:
  - `ok`: DB probe passes and no detected degradation.
  - `degraded`: DB probe passes but queue/job diagnostics indicate risk.
  - `down`: DB probe fails.
- HTTP status:
  - `200` when `ok`
  - `503` when `degraded` or `down`

## Job Run Ledger

The `internal_job_runs` table records internal job execution lifecycle:

- `running` at job start.
- `succeeded` on completion with result payload.
- `failed` on exception with captured error message.
- Deterministic failure smoke mode (token-authenticated):
  - `POST /api/internal/jobs/flashcards/refresh?testMode=force_failure`
  - Forces a controlled run failure to validate `running -> failed` ledger transitions and failure response contracts.

Current tracked job name:

- `flashcards_queue_refresh`
- Overlapping `running` rows per job are blocked by a unique partial index to prevent duplicate concurrent executions.

## AI Connection Contract

- Endpoint: `GET/POST/DELETE /api/ai/session`
- Auth: signed-in app session.
- `POST /api/ai/session` currently enforces a provider allowlist: `chatgpt-web`, `claude-web`, `gemini-web`.
- `POST /api/ai/session` requires canonical `providerKey` formatting (no leading/trailing whitespace).
- `POST /api/ai/session` also validates `loginUrl` as an exact canonical HTTPS provider URL string (no trailing slash, path/query/hash, or alternate host form).
- `POST /api/ai/session` enforces a bounded `modelHint` length (`<=120` chars) to keep persisted provider metadata constrained and stable.
- `POST /api/ai/session` enforces safe `modelHint` characters (alphanumeric plus `._:/-` and spaces) and rejects control/special characters.
- `POST /api/ai/session` currently accepts only `mode: "browser_ui"` for MVP reliability. `oauth_api` is intentionally rejected (`400`) until the OAuth/API provider track is implemented.
- `DELETE /api/ai/session` immediately clears active provider connection state; subsequent generation requests should fail with reconnect guidance (`409`).
- Generation routes (`/api/concepts/generate`, `/api/quiz/generate`) now require an active connected AI provider session.
- If missing, generation returns `409` with reconnect guidance to `/ai-connect`.
- Generation responses now include `generationPath` (`browser_driver` or `fallback`) and resolved `provider` attribution so reliability validation can explicitly separate real browser-driver runs from fallback behavior and verify provider lineage deterministically.
- Browser automation currently has a first implementation for `chatgpt-web`; unsupported providers fall back to deterministic payload generation while preserving provider lineage.

## Flashcards Review Contract

- Endpoint: `POST /api/flashcards/review`
- Auth: signed-in app session.
- `flashcardId` must be canonical (no leading/trailing whitespace) and must be a valid UUID.
- Invalid `flashcardId` shape returns `400` instead of propagating DB errors as `500`.
- `recallScore` must be numeric in range `0..5`.

## Triage Playbook

### Health endpoint returns `down`

1. Confirm app process is up and serving requests.
2. Verify `DATABASE_URL` is present and reachable.
3. Re-run `npm run health:check`.
4. If still down, pause background job execution and investigate DB/network path.

### Health endpoint returns `degraded`

1. Inspect `flashcardsQueue.latestRun` and `latestSuccessAt`.
2. If latest run failed:
   - Re-run `npm run job:flashcards:refresh`.
   - Re-check health.
3. If success is stale:
   - Trigger refresh job and confirm new successful run.
4. If queue stats are unavailable:
   - Ensure latest migrations were applied:
     - `npm run db:migrate`
   - Re-check health.

### Flashcard refresh job fails repeatedly

1. Confirm `INTERNAL_JOB_TOKEN` matches app env.
2. Run with verbose shell tracing locally if needed:
   - `bash -x scripts/jobs/refresh_flashcards_queue.sh`
3. Check app server logs around `/api/internal/jobs/flashcards/refresh`.
4. Capture the failure window and error response for follow-up fix.

## Recovery Verification

After remediation:

1. `npm run health:check` should report `ok`.
2. Execute one manual refresh run.
3. Verify lint/build still pass before shipping:
   - `npm run lint && npm run build`
