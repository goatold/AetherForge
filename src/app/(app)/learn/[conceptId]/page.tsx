import Link from "next/link";
import { notFound } from "next/navigation";

import { readSession } from "@/lib/auth/session";
import { conceptExampleQueries, conceptQueries, executeQuery } from "@/lib/db";

interface ConceptDetailPageProps {
  params: Promise<{ conceptId: string }>;
}

export default async function ConceptDetailPage({ params }: ConceptDetailPageProps) {
  const session = await readSession();
  if (!session) {
    notFound();
  }

  const { conceptId } = await params;

  const conceptResult = await executeQuery<{
    id: string;
    title: string;
    summary: string;
  }>(conceptQueries.findByIdForUser(conceptId, session.userId));
  const concept = conceptResult.rows[0];

  if (!concept) {
    notFound();
  }

  const examplesResult = await executeQuery<{
    id: string;
    example_type: "example" | "case_study";
    title: string;
    body: string;
  }>(conceptExampleQueries.listByConcept(concept.id));
  const examples = examplesResult.rows as Array<{
    id: string;
    example_type: "example" | "case_study";
    title: string;
    body: string;
  }>;

  return (
    <section className="panel">
      <p>
        <Link href="/learn">Back to explorer</Link>
      </p>
      <h2>{concept.title}</h2>
      <p>{concept.summary}</p>

      <h3>Examples and case studies</h3>
      {examples.length === 0 ? (
        <p>No linked examples yet.</p>
      ) : (
        <ul>
          {examples.map((example) => (
            <li key={example.id}>
              <strong>
                {example.example_type === "case_study" ? "Case study" : "Example"}:
              </strong>{" "}
              {example.title}
              <p>{example.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
