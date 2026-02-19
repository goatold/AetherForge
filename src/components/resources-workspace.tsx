"use client";

import { useState, useTransition } from "react";

interface ResourceRecord {
  id: string;
  workspace_id: string;
  title: string;
  url: string | null;
  created_at: string;
}

interface ResourcesWorkspaceProps {
  initialResources: ResourceRecord[];
}

export function ResourcesWorkspace({ initialResources }: ResourcesWorkspaceProps) {
  const [isPending, startTransition] = useTransition();
  const [resources, setResources] = useState<ResourceRecord[]>(initialResources);
  const [titleDraft, setTitleDraft] = useState("");
  const [urlDraft, setUrlDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const addResource = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/resources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: titleDraft, url: urlDraft || null })
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; resource?: ResourceRecord | null }
        | null;
      if (!response.ok || !body?.resource) {
        setErrorMessage(body?.error ?? "Failed to add resource.");
        return;
      }
      setResources((previous) => [body.resource!, ...previous]);
      setTitleDraft("");
      setUrlDraft("");
    });
  };

  return (
    <div className="space-y-4">
      <section className="panel">
        <h2>Notes and resources</h2>
        <p>Add links and references for your current topic workspace.</p>
        <div className="row">
          <input
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            placeholder="Resource title"
          />
          <input
            value={urlDraft}
            onChange={(event) => setUrlDraft(event.target.value)}
            placeholder="https://example.com (optional)"
          />
          <button className="button" type="button" disabled={isPending} onClick={addResource}>
            {isPending ? "Adding..." : "Add resource"}
          </button>
        </div>
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      </section>

      <section className="panel">
        <h3>Saved resources</h3>
        {resources.length === 0 ? (
          <p>No resources saved yet.</p>
        ) : (
          <ul>
            {resources.map((resource) => (
              <li key={resource.id}>
                {resource.url ? (
                  <a href={resource.url} target="_blank" rel="noreferrer">
                    {resource.title}
                  </a>
                ) : (
                  resource.title
                )}{" "}
                ({new Date(resource.created_at).toLocaleDateString()})
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
