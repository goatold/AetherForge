import { NextResponse } from "next/server";

import { executeQuery, internalJobRunQueries } from "@/lib/db";
import { generateFlashcardsFromWeakConcepts } from "@/lib/flashcards/generate-from-weak-concepts";

const MAX_WORKSPACES_PER_RUN = 100;
const MAX_NEW_FLASHCARDS_PER_WORKSPACE = 8;
const JOB_NAME = "flashcards_queue_refresh";
const MAX_HOLD_MS = 15000;
type JobTestMode = "force_failure";

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

const sleep = async (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const parseHoldMs = (request: Request): number => {
  const raw = new URL(request.url).searchParams.get("holdMs");
  if (!raw) {
    return 0;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.min(parsed, MAX_HOLD_MS);
};

const isDryRun = (request: Request): boolean => {
  const raw = new URL(request.url).searchParams.get("dryRun");
  return raw === "1" || raw === "true";
};
const parseTestMode = (request: Request): JobTestMode | null => {
  const raw = new URL(request.url).searchParams.get("testMode");
  return raw === "force_failure" ? raw : null;
};

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "23505";

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let startedRun: { rows: Array<{ id: string }> };
  try {
    startedRun = await executeQuery<{ id: string }>(
      internalJobRunQueries.insert(
        JOB_NAME,
        "running",
        JSON.stringify({
          maxWorkspacesPerRun: MAX_WORKSPACES_PER_RUN,
          maxNewFlashcardsPerWorkspace: MAX_NEW_FLASHCARDS_PER_WORKSPACE
        })
      )
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "A refresh run is already running" }, { status: 409 });
    }
    throw error;
  }

  const runId = startedRun.rows[0]?.id;
  const holdMs = parseHoldMs(request);
  const dryRun = isDryRun(request);
  const testMode = parseTestMode(request);

  try {
    if (holdMs > 0) {
      await sleep(holdMs);
    }
    if (testMode === "force_failure") {
      throw new Error("Simulated internal job failure for deterministic smoke testing.");
    }

    if (dryRun) {
      const result = {
        processedWorkspaces: 0,
        createdCount: 0,
        skippedCount: 0,
        details: []
      };
      if (runId) {
        await executeQuery(internalJobRunQueries.completeSuccess(runId, JSON.stringify(result)));
      }
      return NextResponse.json(result);
    }

    const targetsResult = await executeQuery<{ workspace_id: string; user_id: string }>({
      text: `
        select distinct
          z.workspace_id,
          qa.user_id
        from quiz_attempt_answers a
        join quiz_attempts qa on qa.id = a.quiz_attempt_id
        join quizzes z on z.id = qa.quiz_id
        where
          qa.status = 'submitted'
          and a.is_correct = false
        order by z.workspace_id asc
        limit $1
      `,
      values: [MAX_WORKSPACES_PER_RUN]
    });

    const details = await Promise.all(
      targetsResult.rows.map(async (target) => {
        const generated = await generateFlashcardsFromWeakConcepts(
          target.workspace_id,
          target.user_id,
          MAX_NEW_FLASHCARDS_PER_WORKSPACE
        );
        return {
          workspaceId: target.workspace_id,
          userId: target.user_id,
          createdCount: generated.createdCount,
          skipped: generated.skipped,
          totalWeakConcepts: generated.totalWeakConcepts
        };
      })
    );

    const result = {
      processedWorkspaces: details.length,
      createdCount: details.reduce((sum, item) => sum + item.createdCount, 0),
      skippedCount: details.reduce((sum, item) => sum + item.skipped, 0),
      details
    };

    if (runId) {
      await executeQuery(internalJobRunQueries.completeSuccess(runId, JSON.stringify(result)));
    }

    return NextResponse.json(result);
  } catch (error) {
    if (runId) {
      const message = error instanceof Error ? error.message : "Unexpected internal job error";
      await executeQuery(
        internalJobRunQueries.completeFailure(
          runId,
          JSON.stringify({
            maxWorkspacesPerRun: MAX_WORKSPACES_PER_RUN,
            maxNewFlashcardsPerWorkspace: MAX_NEW_FLASHCARDS_PER_WORKSPACE
          }),
          message
        )
      );
    }
    return NextResponse.json({ error: "Failed to refresh flashcard queue" }, { status: 500 });
  }
}
