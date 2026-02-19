"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

interface InviteAcceptanceProps {
  token: string;
  signedInEmail: string;
}

export function InviteAcceptance({ token, signedInEmail }: InviteAcceptanceProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const acceptInvite = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/collab/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token })
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; workspaceTopic?: string; role?: "editor" | "viewer" }
        | null;
      if (!response.ok) {
        setErrorMessage(body?.error ?? "Unable to accept invite.");
        return;
      }
      const workspaceTopic = body?.workspaceTopic ?? "this workspace";
      const role = body?.role ?? "viewer";
      setSuccessMessage(`You now have ${role} access to ${workspaceTopic}.`);
    });
  };

  return (
    <section className="panel">
      <h2>Accept workspace invite</h2>
      <p>Signed in as {signedInEmail}.</p>
      <div className="row">
        <button className="button" type="button" onClick={acceptInvite} disabled={isPending}>
          {isPending ? "Accepting..." : "Accept invite"}
        </button>
        <Link className="button subtle-button" href="/collab">
          Open collaboration page
        </Link>
      </div>
      {successMessage ? <p>{successMessage}</p> : null}
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
    </section>
  );
}
