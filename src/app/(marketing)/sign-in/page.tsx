import Link from "next/link";

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="page-wrap">
      <section className="panel">
        <h1>Sign in to AetherForge</h1>
        <p>Phase 1 auth scaffold for protected workspace routes.</p>
        <form action="/api/auth/sign-in" method="post" className="auth-form">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
          />
          <input type="hidden" name="next" value={next ?? "/onboarding"} />
          <button type="submit" className="button">
            Sign in
          </button>
        </form>
        {error === "missing-email" ? (
          <p role="alert">Please enter an email address.</p>
        ) : null}
        <p>
          Back to <Link href="/">marketing page</Link>.
        </p>
      </section>
    </main>
  );
}
