import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { executeQuery, workspaceQueries } from "@/lib/db";
import { generateFlashcardsFromWeakConcepts } from "@/lib/flashcards/generate-from-weak-concepts";

const MAX_NEW_FLASHCARDS = 8;

export async function POST() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceResult = await executeQuery<{ id: string; topic: string }>(
    workspaceQueries.listForUser(session.userId)
  );
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const result = await generateFlashcardsFromWeakConcepts(
    workspace.id,
    session.userId,
    MAX_NEW_FLASHCARDS
  );
  if (result.totalWeakConcepts === 0) {
    return NextResponse.json(
      { error: "No quiz misses yet. Submit a quiz attempt first to generate targeted flashcards." },
      { status: 400 }
    );
  }
  if (result.createdCount === 0) {
    return NextResponse.json({
      createdCount: 0,
      skipped: result.skipped,
      message: "Flashcards for current weak concepts already exist."
    });
  }

  return NextResponse.json({
    createdCount: result.createdCount,
    skipped: result.skipped
  });
}
