import { NextResponse } from "next/server";

import { executeQuery, internalJobRunQueries } from "@/lib/db";

const JOB_NAME = "flashcards_queue_refresh";
const STALE_SUCCESS_HOURS = 24;
type HealthStatus = "ok" | "degraded" | "down";
type HealthTestMode = "force_ok" | "force_degraded" | "force_down";

const authorized = (request: Request): boolean => {
  const token = process.env.INTERNAL_JOB_TOKEN;
  if (!token) {
    return false;
  }
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }
  const provided = authHeader.slice("Bearer ".length).trim();
  return provided.length > 0 && provided === token;
};

const toIsoOrNull = (value: string | null | undefined) => (value ? new Date(value).toISOString() : null);
const parseTestMode = (request: Request): HealthTestMode | null => {
  const mode = new URL(request.url).searchParams.get("testMode");
  if (mode === "force_ok" || mode === "force_degraded" || mode === "force_down") {
    return mode;
  }
  return null;
};

const simulatedResponse = (status: HealthStatus, checkedAt: string) =>
  NextResponse.json(
    {
      status,
      checkedAt,
      simulated: true,
      database:
        status === "down"
          ? {
              ok: false,
              error: "Simulated down status for deterministic smoke testing."
            }
          : {
              ok: true,
              nowUtc: checkedAt
            },
      flashcardsQueue:
        status === "down"
          ? null
          : {
              totalFlashcards: 0,
              dueFlashcards: 0,
              workspaceCount: 0,
              latestRun: null,
              latestSuccessAt: null,
              staleThresholdHours: STALE_SUCCESS_HOURS,
              hasRecentSuccess: status === "ok",
              error:
                status === "degraded"
                  ? "Simulated degraded status for deterministic smoke testing."
                  : null
            }
    },
    { status: status === "ok" ? 200 : 503 }
  );

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkedAt = new Date().toISOString();
  const testMode = parseTestMode(request);
  if (testMode === "force_ok") {
    return simulatedResponse("ok", checkedAt);
  }
  if (testMode === "force_degraded") {
    return simulatedResponse("degraded", checkedAt);
  }
  if (testMode === "force_down") {
    return simulatedResponse("down", checkedAt);
  }

  try {
    const dbProbe = await executeQuery<{ now_utc: string }>({
      text: "select now()::text as now_utc"
    });
    const dbNow = dbProbe.rows[0]?.now_utc ?? null;

    let queueStats:
      | {
          totalFlashcards: number;
          dueFlashcards: number;
          workspaceCount: number;
        }
      | null = null;
    let queueStatsError: string | null = null;
    try {
      const queueResult = await executeQuery<{
        total_flashcards: string;
        due_flashcards: string;
        workspace_count: string;
      }>({
        text: `
          select
            count(*)::int::text as total_flashcards,
            count(*) filter (where next_review_at <= now())::int::text as due_flashcards,
            count(distinct workspace_id)::int::text as workspace_count
          from flashcards
        `
      });
      queueStats = {
        totalFlashcards: Number(queueResult.rows[0]?.total_flashcards ?? "0"),
        dueFlashcards: Number(queueResult.rows[0]?.due_flashcards ?? "0"),
        workspaceCount: Number(queueResult.rows[0]?.workspace_count ?? "0")
      };
    } catch (error) {
      queueStatsError = error instanceof Error ? error.message : "Failed to load queue stats";
    }

    let latestRun:
      | {
          status: "running" | "succeeded" | "failed";
          startedAt: string | null;
          finishedAt: string | null;
          errorMessage: string | null;
        }
      | null = null;
    let latestSuccessAt: string | null = null;
    let jobStatusError: string | null = null;
    try {
      const [latestRunResult, latestSuccessResult] = await Promise.all([
        executeQuery<{
          status: "running" | "succeeded" | "failed";
          started_at: string;
          finished_at: string | null;
          error_message: string | null;
        }>(internalJobRunQueries.latestByJob(JOB_NAME)),
        executeQuery<{ finished_at: string | null }>(internalJobRunQueries.latestSuccessByJob(JOB_NAME))
      ]);
      const run = latestRunResult.rows[0];
      latestRun = run
        ? {
            status: run.status,
            startedAt: toIsoOrNull(run.started_at),
            finishedAt: toIsoOrNull(run.finished_at),
            errorMessage: run.error_message
          }
        : null;
      latestSuccessAt = toIsoOrNull(latestSuccessResult.rows[0]?.finished_at);
    } catch (error) {
      jobStatusError = error instanceof Error ? error.message : "Failed to load internal job status";
    }

    const staleCutoffMs = Date.now() - STALE_SUCCESS_HOURS * 60 * 60 * 1000;
    const hasRecentSuccess = latestSuccessAt
      ? new Date(latestSuccessAt).getTime() >= staleCutoffMs
      : false;

    const status: HealthStatus =
      !jobStatusError && latestRun?.status === "failed" && !hasRecentSuccess
        ? "degraded"
        : !jobStatusError && latestSuccessAt && !hasRecentSuccess
          ? "degraded"
          : jobStatusError || queueStatsError
            ? "degraded"
            : "ok";

    const responseBody = {
      status,
      checkedAt,
      database: {
        ok: true,
        nowUtc: dbNow
      },
      flashcardsQueue: {
        ...queueStats,
        latestRun,
        latestSuccessAt,
        staleThresholdHours: STALE_SUCCESS_HOURS,
        hasRecentSuccess,
        error: queueStatsError ?? jobStatusError
      }
    };

    return NextResponse.json(responseBody, { status: status === "ok" ? 200 : 503 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database health probe failed";
    return NextResponse.json(
      {
        status: "down",
        checkedAt,
        database: {
          ok: false,
          error: message
        }
      },
      { status: 503 }
    );
  }
}
