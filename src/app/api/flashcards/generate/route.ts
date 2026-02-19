import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { executeQuery, flashcardQueries, workspaceQueries } from "@/lib/db";

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

  const weakConceptsResult = await executeQuery<{
    concept_id: string;
    concept_title: string;
    concept_summary: string;
    incorrect_count: string;
  }>({
    text: `
      select
        c.id as concept_id,
        c.title as concept_title,
        c.summary as concept_summary,
        count(*)::int::text as incorrect_count
      from quiz_attempt_answers a
      join quiz_attempts qa on qa.id = a.quiz_attempt_id
      join quiz_questions q on q.id = a.quiz_question_id
      join quizzes z on z.id = qa.quiz_id
      join concepts c on c.id = q.concept_id
      where
        z.workspace_id = $1
        and qa.user_id = $2
        and qa.status = 'submitted'
        and a.is_correct = false
      group by c.id, c.title, c.summary
      order by count(*) desc, max(qa.submitted_at) desc
      limit $3
    `,
    values: [workspace.id, session.userId, MAX_NEW_FLASHCARDS]
  });

  const weakConcepts = weakConceptsResult.rows;
  if (weakConcepts.length === 0) {
    return NextResponse.json(
      { error: "No quiz misses yet. Submit a quiz attempt first to generate targeted flashcards." },
      { status: 400 }
    );
  }

  const conceptIds = weakConcepts.map((concept) => concept.concept_id);
  const existingFlashcardsResult = await executeQuery<{ concept_id: string }>({
    text: `
      select concept_id
      from flashcards
      where workspace_id = $1 and source = 'quiz_miss' and concept_id = any($2::uuid[])
    `,
    values: [workspace.id, conceptIds]
  });
  const existingConceptIds = new Set(existingFlashcardsResult.rows.map((row) => row.concept_id));

  const candidates = weakConcepts.filter((concept) => !existingConceptIds.has(concept.concept_id));
  if (candidates.length === 0) {
    return NextResponse.json({
      createdCount: 0,
      skipped: conceptIds.length,
      message: "Flashcards for current weak concepts already exist."
    });
  }

  await Promise.all(
    candidates.map((concept) =>
      executeQuery(
        flashcardQueries.insert(
          workspace.id,
          `Explain: ${concept.concept_title}`,
          `${concept.concept_summary}\n\nRecent misses: ${concept.incorrect_count}. Focus on this concept before your next quiz.`,
          concept.concept_id,
          "quiz_miss"
        )
      )
    )
  );

  return NextResponse.json({
    createdCount: candidates.length,
    skipped: conceptIds.length - candidates.length
  });
}
