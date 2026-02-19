import { FlashcardsWorkspace } from "@/components/flashcards-workspace";
import { readSession } from "@/lib/auth/session";
import { executeQuery, flashcardQueries, workspaceQueries } from "@/lib/db";

export default async function FlashcardsPage() {
  const session = await readSession();
  if (!session) {
    return (
      <section className="panel">
        <h2>Flashcards and review queue</h2>
        <p>Sign in to generate flashcards and run your review queue.</p>
      </section>
    );
  }

  const workspaceResult = await executeQuery<{ id: string }>(
    workspaceQueries.listForUser(session.userId)
  );
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return (
      <section className="panel">
        <h2>Flashcards and review queue</h2>
        <p>Create a workspace first to unlock spaced-repetition practice.</p>
      </section>
    );
  }

  const flashcardsResult = await executeQuery<{
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
  }>(flashcardQueries.listByWorkspaceForUser(workspace.id, session.userId, 100));

  return <FlashcardsWorkspace initialFlashcards={flashcardsResult.rows} />;
}
