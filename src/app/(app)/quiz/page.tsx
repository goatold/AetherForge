import { QuizWorkspace } from "@/components/quiz-workspace";
import { readSession } from "@/lib/auth/session";
import {
  executeQuery,
  quizAttemptQueries,
  quizQueries,
  quizQuestionOptionQueries,
  quizQuestionQueries,
  workspaceQueries
} from "@/lib/db";

export default async function QuizPage() {
  const session = await readSession();
  if (!session) {
    return (
      <section className="panel">
        <h2>Quiz practice</h2>
        <p>Sign in to generate quizzes and track attempts.</p>
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
        <h2>Quiz practice</h2>
        <p>Create a workspace first to unlock quiz generation.</p>
      </section>
    );
  }

  const [quizzesResult, attemptsResult] = await Promise.all([
    executeQuery<{
      id: string;
      title: string;
      created_at: string;
    }>(quizQueries.listByWorkspace(workspace.id)),
    executeQuery<{
      id: string;
      score_percent: string | null;
      submitted_at: string | null;
    }>(quizAttemptQueries.listRecentByWorkspace(workspace.id, 8))
  ]);

  const latestQuiz = quizzesResult.rows[0];
  const latestQuizQuestions = latestQuiz
    ? await Promise.all([
        executeQuery<{
          id: string;
          question_type: "mcq" | "true_false" | "short_answer";
          prompt: string;
          explanation: string;
          position: number;
        }>(quizQuestionQueries.listByQuiz(latestQuiz.id)),
        executeQuery<{
          id: string;
          quiz_question_id: string;
          option_key: string;
          option_text: string;
          position: number;
        }>(quizQuestionOptionQueries.listByQuiz(latestQuiz.id))
      ]).then(([questions, options]) =>
        questions.rows.map((question) => ({
          id: question.id,
          type: question.question_type,
          prompt: question.prompt,
          explanation: question.explanation,
          position: question.position,
          options: options.rows
            .filter((option) => option.quiz_question_id === question.id)
            .map((option) => ({
              id: option.id,
              key: option.option_key,
              text: option.option_text,
              position: option.position
            }))
        }))
      )
    : [];

  return (
    <QuizWorkspace
      latestQuiz={
        latestQuiz
          ? {
              id: latestQuiz.id,
              title: latestQuiz.title,
              createdAt: latestQuiz.created_at,
              questionCount: latestQuizQuestions.length
            }
          : null
      }
      latestQuizQuestions={latestQuizQuestions}
      initialRecentAttempts={attemptsResult.rows.map((attempt) => ({
        id: attempt.id,
        scorePercent:
          attempt.score_percent === null ? null : Number.parseFloat(attempt.score_percent),
        submittedAt: attempt.submitted_at
      }))}
    />
  );
}
