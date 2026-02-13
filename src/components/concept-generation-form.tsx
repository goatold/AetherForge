"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DIFFICULTY_LEVELS } from "@/lib/contracts/domain";

interface ConceptGenerationFormProps {
  defaultTopic: string;
  defaultDifficulty: (typeof DIFFICULTY_LEVELS)[number];
}

export function ConceptGenerationForm({
  defaultTopic,
  defaultDifficulty
}: ConceptGenerationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [topic, setTopic] = useState(defaultTopic);
  const [difficulty, setDifficulty] = useState(defaultDifficulty);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/concepts/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          topic,
          difficulty
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setErrorMessage(body?.error ?? "Concept generation failed.");
        return;
      }

      router.refresh();
    });
  };

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h3>Generate concept graph artifact</h3>
      <p>Create a new concept set with linked examples and case studies.</p>
      <label htmlFor="topic">Topic</label>
      <input
        id="topic"
        name="topic"
        value={topic}
        onChange={(event) => setTopic(event.target.value)}
        required
      />
      <label htmlFor="difficulty">Difficulty</label>
      <select
        id="difficulty"
        name="difficulty"
        value={difficulty}
        onChange={(event) =>
          setDifficulty(event.target.value as (typeof DIFFICULTY_LEVELS)[number])
        }
      >
        {DIFFICULTY_LEVELS.map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </select>
      <button className="button" disabled={isPending} type="submit">
        {isPending ? "Generating..." : "Generate concepts"}
      </button>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
    </form>
  );
}
