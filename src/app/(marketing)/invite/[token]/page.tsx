import Link from "next/link";

import { InviteAcceptance } from "@/components/invite-acceptance";
import { readSession } from "@/lib/auth/session";

export default async function InvitePage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await readSession();

  if (!session) {
    const nextPath = `/invite/${token}`;
    return (
      <main className="page-wrap">
        <section className="panel">
          <h2>Accept workspace invite</h2>
          <p>Sign in with the invited email to accept access.</p>
          <Link className="button" href={`/sign-in?next=${encodeURIComponent(nextPath)}`}>
            Sign in to continue
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-wrap">
      <InviteAcceptance token={token} signedInEmail={session.email} />
    </main>
  );
}
