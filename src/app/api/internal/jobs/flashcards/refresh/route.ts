import { NextResponse } from "next/server";

import { executeQuery } from "@/lib/db";
import { generateFlashcardsFromWeakConcepts } from "@/lib/flashcards/generate-from-weak-concepts";

const MAX_WORKSPACES_PER_RUN = 100;
const MAX_NEW_FLASHCARDS_PER_WORKSPACE = 8;

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

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  return NextResponse.json({
    processedWorkspaces: details.length,
    createdCount: details.reduce((sum, item) => sum + item.createdCount, 0),
    skippedCount: details.reduce((sum, item) => sum + item.skipped, 0),
    details
  });
}
