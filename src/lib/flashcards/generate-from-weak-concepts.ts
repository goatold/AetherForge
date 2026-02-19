import { executeQuery, flashcardQueries } from "@/lib/db";

interface WeakConceptRow extends Record<string, unknown> {
  concept_id: string;
  concept_title: string;
  concept_summary: string;
  incorrect_count: string;
}

interface GenerateFromWeakConceptsResult {
  createdCount: number;
  skipped: number;
  totalWeakConcepts: number;
}

export const generateFlashcardsFromWeakConcepts = async (
  workspaceId: string,
  userId: string,
  maxNewFlashcards: number
): Promise<GenerateFromWeakConceptsResult> => {
  const weakConceptsResult = await executeQuery<WeakConceptRow>({
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
    values: [workspaceId, userId, maxNewFlashcards]
  });

  const weakConcepts = weakConceptsResult.rows;
  if (weakConcepts.length === 0) {
    return {
      createdCount: 0,
      skipped: 0,
      totalWeakConcepts: 0
    };
  }

  const conceptIds = weakConcepts.map((concept) => concept.concept_id);
  const existingFlashcardsResult = await executeQuery<{ concept_id: string }>({
    text: `
      select concept_id
      from flashcards
      where workspace_id = $1 and source = 'quiz_miss' and concept_id = any($2::uuid[])
    `,
    values: [workspaceId, conceptIds]
  });
  const existingConceptIds = new Set(existingFlashcardsResult.rows.map((row) => row.concept_id));

  const candidates = weakConcepts.filter((concept) => !existingConceptIds.has(concept.concept_id));
  await Promise.all(
    candidates.map((concept) =>
      executeQuery(
        flashcardQueries.insert(
          workspaceId,
          `Explain: ${concept.concept_title}`,
          `${concept.concept_summary}\n\nRecent misses: ${concept.incorrect_count}. Focus on this concept before your next quiz.`,
          concept.concept_id,
          "quiz_miss"
        )
      )
    )
  );

  return {
    createdCount: candidates.length,
    skipped: weakConcepts.length - candidates.length,
    totalWeakConcepts: weakConcepts.length
  };
};
