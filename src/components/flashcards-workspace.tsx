"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface FlashcardItem {
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
}

interface FlashcardsWorkspaceProps {
  initialFlashcards: FlashcardItem[];
}

const formatWhen = (iso: string) => new Date(iso).toLocaleString();

export function FlashcardsWorkspace({ initialFlashcards }: FlashcardsWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>(initialFlashcards);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [revealedCardId, setRevealedCardId] = useState<string | null>(null);

  const dueCards = useMemo(() => {
    const nowMs = Date.now();
    return flashcards.filter((card) => new Date(card.next_review_at).getTime() <= nowMs);
  }, [flashcards]);
  const nextDueCard = dueCards[0] ?? null;

  const refreshFlashcards = async () => {
    const response = await fetch("/api/flashcards");
    const body = (await response.json().catch(() => null)) as
      | { error?: string; flashcards?: FlashcardItem[] }
      | null;
    if (!response.ok || !Array.isArray(body?.flashcards)) {
      setErrorMessage(body?.error ?? "Failed to refresh flashcards.");
      return false;
    }
    setFlashcards(body.flashcards);
    return true;
  };

  const handleGenerate = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/flashcards/generate", { method: "POST" });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; createdCount?: number; skipped?: number; message?: string }
        | null;
      if (!response.ok) {
        setErrorMessage(body?.error ?? "Failed to generate flashcards.");
        return;
      }
      const createdCount = body?.createdCount ?? 0;
      const skipped = body?.skipped ?? 0;
      setSuccessMessage(
        createdCount > 0
          ? `Generated ${createdCount} flashcard(s).`
          : body?.message ?? `No new cards generated (${skipped} skipped).`
      );
      await refreshFlashcards();
      router.refresh();
    });
  };

  const handleReview = (flashcardId: string, recallScore: number) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/flashcards/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ flashcardId, recallScore })
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; flashcard?: FlashcardItem | null }
        | null;
      if (!response.ok || !body?.flashcard) {
        setErrorMessage(body?.error ?? "Failed to record review.");
        return;
      }

      setFlashcards((previous) =>
        previous
          .map((item) => (item.id === flashcardId ? body.flashcard! : item))
          .sort(
            (a, b) =>
              new Date(a.next_review_at).getTime() - new Date(b.next_review_at).getTime()
          )
      );
      setRevealedCardId(null);
      setSuccessMessage(
        `Review saved. Next due: ${new Date(body.flashcard.next_review_at).toLocaleDateString()}.`
      );
    });
  };

  return (
    <div className="space-y-4">
      <section className="panel">
        <h2>Flashcards and review queue</h2>
        <p>
          Generate cards from quiz misses, then score recall to update each card&apos;s next due date
          with spaced repetition.
        </p>
        <button className="button" type="button" disabled={isPending} onClick={handleGenerate}>
          {isPending ? "Generating..." : "Generate from weak quiz concepts"}
        </button>
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        {successMessage ? <p>{successMessage}</p> : null}
      </section>

      <section className="panel">
        <h3>Due now</h3>
        {!nextDueCard ? (
          <p>No cards due right now. Great momentum.</p>
        ) : (
          <>
            <p>
              <strong>Prompt:</strong> {nextDueCard.front}
            </p>
            {nextDueCard.concept_id ? (
              <p>
                Related concept:{" "}
                <Link href={`/learn/${nextDueCard.concept_id}`}>
                  {nextDueCard.concept_title ?? "Open concept"}
                </Link>
              </p>
            ) : null}
            <button
              className="button subtle-button"
              type="button"
              onClick={() =>
                setRevealedCardId((current) => (current === nextDueCard.id ? null : nextDueCard.id))
              }
            >
              {revealedCardId === nextDueCard.id ? "Hide answer" : "Show answer"}
            </button>
            {revealedCardId === nextDueCard.id ? (
              <p>
                <strong>Answer:</strong> {nextDueCard.back}
              </p>
            ) : null}
            <div className="row">
              <button
                className="button subtle-button"
                type="button"
                disabled={isPending}
                onClick={() => handleReview(nextDueCard.id, 2)}
              >
                Again
              </button>
              <button
                className="button subtle-button"
                type="button"
                disabled={isPending}
                onClick={() => handleReview(nextDueCard.id, 3)}
              >
                Hard
              </button>
              <button
                className="button subtle-button"
                type="button"
                disabled={isPending}
                onClick={() => handleReview(nextDueCard.id, 4)}
              >
                Good
              </button>
              <button
                className="button subtle-button"
                type="button"
                disabled={isPending}
                onClick={() => handleReview(nextDueCard.id, 5)}
              >
                Easy
              </button>
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <h3>Queue ({flashcards.length})</h3>
        {flashcards.length === 0 ? (
          <p>No flashcards yet. Generate from quiz misses after submitting attempts.</p>
        ) : (
          <ul>
            {flashcards.map((card) => (
              <li key={card.id}>
                {card.front} - due {formatWhen(card.next_review_at)} - interval {card.interval_days}d
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
