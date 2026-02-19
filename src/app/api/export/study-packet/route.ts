import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import {
  conceptQueries,
  executeQuery,
  flashcardQueries,
  planMilestoneQueries,
  planQueries,
  quizQueries,
  quizQuestionOptionQueries,
  quizQuestionQueries,
  resourceQueries,
  workspaceQueries
} from "@/lib/db";

type ExportSection = "concepts" | "quiz" | "flashcards" | "plan" | "resources";

const ALL_SECTIONS: ExportSection[] = ["concepts", "quiz", "flashcards", "plan", "resources"];

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const parseSections = (searchParams: URLSearchParams): ExportSection[] => {
  const raw = searchParams.getAll("sections").flatMap((item) => item.split(","));
  if (raw.length === 0) {
    return ALL_SECTIONS;
  }
  const unique = [...new Set(raw.map((item) => item.trim().toLowerCase()).filter(Boolean))];
  return ALL_SECTIONS.filter((section) => unique.includes(section));
};

const parseBoolean = (value: string | null, fallback: boolean) => {
  if (value === null) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }
  return fallback;
};

const renderSectionTitle = (title: string) => `<h2>${escapeHtml(title)}</h2>`;

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceResult = await executeQuery<{
    id: string;
    topic: string;
    difficulty: string;
  }>(workspaceQueries.listForUser(session.userId));
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const sections = parseSections(searchParams);
  const includeAnswerKey = parseBoolean(searchParams.get("includeAnswerKey"), true);
  const compact = parseBoolean(searchParams.get("compact"), false);

  const chunks: string[] = [];
  const generatedAt = new Date().toISOString();
  chunks.push(`<h1>AetherForge Study Packet</h1>`);
  chunks.push(
    `<p><strong>Topic:</strong> ${escapeHtml(workspace.topic)} (${escapeHtml(workspace.difficulty)})</p>`
  );
  chunks.push(`<p><strong>Generated:</strong> ${escapeHtml(new Date(generatedAt).toLocaleString())}</p>`);

  if (sections.includes("concepts")) {
    const conceptsResult = await executeQuery<{
      id: string;
      title: string;
      summary: string;
    }>(conceptQueries.listByWorkspace(workspace.id));
    chunks.push(renderSectionTitle("Concept Summaries"));
    if (conceptsResult.rows.length === 0) {
      chunks.push("<p>No concepts available yet.</p>");
    } else {
      chunks.push("<ol>");
      conceptsResult.rows.slice(0, compact ? 12 : 30).forEach((concept) => {
        chunks.push("<li>");
        chunks.push(`<p><strong>${escapeHtml(concept.title)}</strong></p>`);
        chunks.push(`<p>${escapeHtml(concept.summary)}</p>`);
        chunks.push("</li>");
      });
      chunks.push("</ol>");
    }
  }

  if (sections.includes("quiz")) {
    const quizzesResult = await executeQuery<{ id: string; title: string }>(
      quizQueries.listByWorkspace(workspace.id)
    );
    const latestQuiz = quizzesResult.rows[0];
    chunks.push(renderSectionTitle("Quiz Booklet"));
    if (!latestQuiz) {
      chunks.push("<p>No quiz generated yet.</p>");
    } else {
      chunks.push(`<p><strong>${escapeHtml(latestQuiz.title)}</strong></p>`);
      const [questionsResult, optionsResult] = await Promise.all([
        executeQuery<{
          id: string;
          question_type: "mcq" | "true_false" | "short_answer";
          prompt: string;
          correct_answer_text: string;
          explanation: string;
          position: number;
        }>(quizQuestionQueries.listByQuiz(latestQuiz.id)),
        executeQuery<{
          quiz_question_id: string;
          option_text: string;
          option_key: string;
          is_correct: boolean;
          position: number;
        }>(quizQuestionOptionQueries.listByQuiz(latestQuiz.id))
      ]);
      chunks.push("<ol>");
      questionsResult.rows.slice(0, compact ? 12 : 40).forEach((question) => {
        chunks.push("<li>");
        chunks.push(`<p>${escapeHtml(question.prompt)}</p>`);
        const options = optionsResult.rows
          .filter((option) => option.quiz_question_id === question.id)
          .sort((a, b) => a.position - b.position);
        if (options.length > 0) {
          chunks.push("<ul>");
          options.forEach((option) => {
            chunks.push(`<li>${escapeHtml(option.option_text)}</li>`);
          });
          chunks.push("</ul>");
        }
        if (includeAnswerKey) {
          chunks.push(`<p><em>Answer:</em> ${escapeHtml(question.correct_answer_text)}</p>`);
          if (!compact) {
            chunks.push(`<p><em>Why:</em> ${escapeHtml(question.explanation)}</p>`);
          }
        }
        chunks.push("</li>");
      });
      chunks.push("</ol>");
    }
  }

  if (sections.includes("flashcards")) {
    const flashcardsResult = await executeQuery<{
      front: string;
      back: string;
      next_review_at: string;
    }>(flashcardQueries.listByWorkspace(workspace.id));
    chunks.push(renderSectionTitle("Flashcard Sheet"));
    if (flashcardsResult.rows.length === 0) {
      chunks.push("<p>No flashcards yet.</p>");
    } else {
      chunks.push("<table><thead><tr><th>Front</th><th>Back</th><th>Next review</th></tr></thead><tbody>");
      flashcardsResult.rows.slice(0, compact ? 20 : 60).forEach((card) => {
        chunks.push(
          `<tr><td>${escapeHtml(card.front)}</td><td>${escapeHtml(card.back)}</td><td>${escapeHtml(
            new Date(card.next_review_at).toLocaleDateString()
          )}</td></tr>`
        );
      });
      chunks.push("</tbody></table>");
    }
  }

  if (sections.includes("plan")) {
    const planResult = await executeQuery<{ id: string; title: string }>(planQueries.getByWorkspace(workspace.id));
    chunks.push(renderSectionTitle("Plan Tracker"));
    const plan = planResult.rows[0];
    if (!plan) {
      chunks.push("<p>No learning plan yet.</p>");
    } else {
      chunks.push(`<p><strong>${escapeHtml(plan.title)}</strong></p>`);
      const milestonesResult = await executeQuery<{
        title: string;
        due_date: string | null;
        completed_at: string | null;
      }>(planMilestoneQueries.listByPlan(plan.id));
      if (milestonesResult.rows.length === 0) {
        chunks.push("<p>No milestones yet.</p>");
      } else {
        chunks.push("<ul>");
        milestonesResult.rows.forEach((milestone) => {
          const status = milestone.completed_at ? "completed" : "open";
          const due = milestone.due_date ? ` due ${escapeHtml(milestone.due_date.slice(0, 10))}` : "";
          chunks.push(`<li>${escapeHtml(milestone.title)} (${status}${due})</li>`);
        });
        chunks.push("</ul>");
      }
    }
  }

  if (sections.includes("resources")) {
    const resourcesResult = await executeQuery<{
      title: string;
      url: string | null;
      note_text: string | null;
      tags: string[];
    }>(resourceQueries.listByWorkspace(workspace.id));
    chunks.push(renderSectionTitle("Resources"));
    if (resourcesResult.rows.length === 0) {
      chunks.push("<p>No resources saved yet.</p>");
    } else {
      chunks.push("<ul>");
      resourcesResult.rows.slice(0, compact ? 20 : 80).forEach((resource) => {
        const url = resource.url ? ` - ${escapeHtml(resource.url)}` : "";
        const tags = resource.tags.length > 0 ? ` [${escapeHtml(resource.tags.join(", "))}]` : "";
        const note = resource.note_text && !compact ? ` - ${escapeHtml(resource.note_text)}` : "";
        chunks.push(`<li>${escapeHtml(resource.title)}${url}${tags}${note}</li>`);
      });
      chunks.push("</ul>");
    }
  }

  chunks.push(
    `<hr /><p class="provenance">Provenance: generated by AetherForge export pipeline at ${escapeHtml(
      generatedAt
    )}.</p>`
  );

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>AetherForge Study Packet</title>
    <style>
      @page { margin: 14mm; }
      body { font-family: Arial, sans-serif; color: #111; }
      h1 { margin-bottom: 0.25rem; }
      h2 { margin-top: 1.4rem; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; }
      p, li, td, th { line-height: 1.4; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
      th, td { border: 1px solid #ddd; padding: 6px; vertical-align: top; }
      .provenance { font-size: 11px; color: #444; }
    </style>
  </head>
  <body>
    ${chunks.join("\n")}
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}
