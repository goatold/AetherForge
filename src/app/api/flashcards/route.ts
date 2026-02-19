import { NextResponse } from "next/server";

import { executeQuery, flashcardQueries, workspaceQueries } from "@/lib/db";
import { readSession } from "@/lib/auth/session";

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceResult = await executeQuery<{ id: string }>(workspaceQueries.listForUser(session.userId));
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return NextResponse.json({ flashcards: [], dueNowCount: 0 });
  }

  const [flashcardsResult, dueResult] = await Promise.all([
    executeQuery<{
      id: string;
      front: string;
      back: string;
      concept_id: string | null;
      concept_title: string | null;
      source: "quiz_miss" | "concept";
      ease_factor: string;
      interval_days: number;
      repetition_count: number;
      next_review_at: string;
      last_reviewed_at: string | null;
    }>(flashcardQueries.listByWorkspaceForUser(workspace.id, session.userId, 100)),
    executeQuery<{ id: string }>(flashcardQueries.listDueByWorkspaceForUser(workspace.id, session.userId, 500))
  ]);

  return NextResponse.json({
    flashcards: flashcardsResult.rows,
    dueNowCount: dueResult.rows.length
  });
}
