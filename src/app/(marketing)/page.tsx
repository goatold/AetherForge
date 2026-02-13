import Link from "next/link";

export default function MarketingPage() {
  return (
    <main className="page-wrap">
      <section className="panel">
        <h1>AetherForge</h1>
        <p>
          Learn any topic through structured concepts, adaptive quizzes, spaced
          repetition flashcards, and personalized study plans.
        </p>
        <div className="row">
          <Link className="button" href="/sign-in">
            Sign in
          </Link>
          <Link className="button subtle-button" href="/onboarding">
            View protected app route
          </Link>
        </div>
      </section>
    </main>
  );
}
