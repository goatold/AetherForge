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
- App server is running.

## Primary Commands

- Check internal health:
  - `npm run health:check`
- Trigger flashcard queue refresh:
  - `npm run job:flashcards:refresh`
- Validate app quality gates:
  - `npm run lint && npm run build`

## Health Endpoint Contract

- Endpoint: `GET /api/internal/health`
- Auth: `Authorization: Bearer <INTERNAL_JOB_TOKEN>`
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

Current tracked job name:

- `flashcards_queue_refresh`

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
