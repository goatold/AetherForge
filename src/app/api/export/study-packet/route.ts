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
type PageSize = "a4" | "letter";

const ALL_SECTIONS: ExportSection[] = ["concepts", "quiz", "flashcards", "plan", "resources"];
const ALL_PAGE_SIZES: PageSize[] = ["a4", "letter"];

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

const parsePageSize = (value: string | null): PageSize => {
  if (!value) {
    return "a4";
  }
  const normalized = value.trim().toLowerCase();
  return ALL_PAGE_SIZES.includes(normalized as PageSize) ? (normalized as PageSize) : "a4";
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
  const pageSize = parsePageSize(searchParams.get("pageSize"));
  const pageCssSize = pageSize === "letter" ? "Letter" : "A4";
  const pageMargin = compact ? "11mm" : "14mm";

  const chunks: string[] = [];
  const generatedAt = new Date().toISOString();
  chunks.push(`<h1>AetherForge Study Packet</h1>`);
  chunks.push(
    `<p><strong>Topic:</strong> ${escapeHtml(workspace.topic)} (${escapeHtml(workspace.difficulty)})</p>`
  );
  chunks.push(`<p><strong>Generated:</strong> ${escapeHtml(new Date(generatedAt).toLocaleString())}</p>`);
  chunks.push(`<p><strong>Layout:</strong> ${escapeHtml(pageCssSize)} (${compact ? "compact" : "detailed"})</p>`);

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
      @page { size: ${pageCssSize}; margin: ${pageMargin}; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #111;
      }
      body {
        font-family: Arial, Helvetica, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .packet {
        width: 100%;
        margin: 0 auto;
      }
      h1 { margin: 0 0 0.35rem; line-height: 1.25; }
      h2 {
        margin: 1.4rem 0 0.55rem;
        border-bottom: 1px solid #222;
        padding-bottom: 0.25rem;
        break-after: avoid-page;
        page-break-after: avoid;
      }
      p, li, td, th {
        line-height: 1.45;
        font-size: 12px;
        orphans: 3;
        widows: 3;
      }
      ol, ul {
        margin: 0.2rem 0 0.9rem;
        padding-left: 1.2rem;
      }
      li {
        break-inside: avoid-page;
        page-break-inside: avoid;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 0.5rem;
        table-layout: fixed;
      }
      thead {
        display: table-header-group;
      }
      tr {
        break-inside: avoid-page;
        page-break-inside: avoid;
      }
      th, td {
        border: 1px solid #333;
        padding: 6px;
        vertical-align: top;
        overflow-wrap: anywhere;
      }
      hr {
        border: 0;
        border-top: 1px solid #555;
        margin: 1rem 0 0.75rem;
      }
      .provenance {
        font-size: 11px;
        color: #222;
      }
    </style>
  </head>
  <body>
    <main class="packet">
      ${chunks.join("\n")}
    </main>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}
