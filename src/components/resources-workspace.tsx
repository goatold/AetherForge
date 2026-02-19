"use client";

import { useState, useTransition } from "react";

interface ResourceRecord {
  id: string;
  workspace_id: string;
  title: string;
  url: string | null;
  note_text: string | null;
  tags: string[];
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
  const [noteDraft, setNoteDraft] = useState("");
  const [tagsDraft, setTagsDraft] = useState("");
  const [queryDraft, setQueryDraft] = useState("");
  const [tagFilterDraft, setTagFilterDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [editTitleDraft, setEditTitleDraft] = useState("");
  const [editUrlDraft, setEditUrlDraft] = useState("");
  const [editNoteDraft, setEditNoteDraft] = useState("");
  const [editTagsDraft, setEditTagsDraft] = useState("");
  const tagCounts = resources.reduce((map, resource) => {
    resource.tags.forEach((tag) => {
      map.set(tag, (map.get(tag) ?? 0) + 1);
    });
    return map;
  }, new Map<string, number>());
  const popularTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const refreshResources = async (query: string, tag: string) => {
    const params = new URLSearchParams();
    if (query.trim().length > 0) {
      params.set("q", query.trim());
    }
    if (tag.trim().length > 0) {
      params.set("tag", tag.trim().toLowerCase());
    }
    const qs = params.toString();
    const response = await fetch(`/api/resources${qs ? `?${qs}` : ""}`);
    const body = (await response.json().catch(() => null)) as
      | { error?: string; resources?: ResourceRecord[] }
      | null;
    if (!response.ok || !Array.isArray(body?.resources)) {
      setErrorMessage(body?.error ?? "Failed to refresh resources.");
      return;
    }
    setResources(body.resources);
  };

  const addResource = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/resources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: titleDraft,
          url: urlDraft || null,
          noteText: noteDraft || null,
          tags: tagsDraft
        })
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
      setNoteDraft("");
      setTagsDraft("");
    });
  };

  const applyFilters = () => {
    setErrorMessage(null);
    startTransition(async () => {
      await refreshResources(queryDraft, tagFilterDraft);
    });
  };

  const beginResourceEdit = (resource: ResourceRecord) => {
    setEditingResourceId(resource.id);
    setEditTitleDraft(resource.title);
    setEditUrlDraft(resource.url ?? "");
    setEditNoteDraft(resource.note_text ?? "");
    setEditTagsDraft(resource.tags.join(", "));
  };

  const cancelResourceEdit = () => {
    setEditingResourceId(null);
    setEditTitleDraft("");
    setEditUrlDraft("");
    setEditNoteDraft("");
    setEditTagsDraft("");
  };

  const saveResourceEdit = () => {
    if (!editingResourceId) {
      return;
    }
    setErrorMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/resources/${editingResourceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: editTitleDraft,
          url: editUrlDraft || null,
          noteText: editNoteDraft || null,
          tags: editTagsDraft
        })
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; resource?: ResourceRecord | null }
        | null;
      if (!response.ok || !body?.resource) {
        setErrorMessage(body?.error ?? "Failed to update resource.");
        return;
      }
      setResources((previous) =>
        previous.map((item) => (item.id === editingResourceId ? body.resource! : item))
      );
      cancelResourceEdit();
    });
  };

  const deleteResource = (resourceId: string) => {
    setErrorMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/resources/${resourceId}`, {
        method: "DELETE"
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; deleted?: boolean }
        | null;
      if (!response.ok || body?.deleted !== true) {
        setErrorMessage(body?.error ?? "Failed to delete resource.");
        return;
      }
      setResources((previous) => previous.filter((item) => item.id !== resourceId));
      if (editingResourceId === resourceId) {
        cancelResourceEdit();
      }
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
          <input
            value={tagsDraft}
            onChange={(event) => setTagsDraft(event.target.value)}
            placeholder="tags: os, kernels, memory"
          />
          <input
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="optional note"
          />
          <button className="button" type="button" disabled={isPending} onClick={addResource}>
            {isPending ? "Adding..." : "Add resource"}
          </button>
        </div>
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      </section>

      <section className="panel">
        <h3>Saved resources</h3>
        {popularTags.length > 0 ? (
          <div className="row">
            {popularTags.map(([tag, count]) => (
              <button
                key={tag}
                className="button subtle-button"
                type="button"
                disabled={isPending}
                onClick={() => {
                  setTagFilterDraft(tag);
                  setQueryDraft("");
                  startTransition(async () => {
                    await refreshResources("", tag);
                  });
                }}
              >
                #{tag} ({count})
              </button>
            ))}
          </div>
        ) : null}
        <div className="row">
          <input
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
            placeholder="search title/url/note"
          />
          <input
            value={tagFilterDraft}
            onChange={(event) => setTagFilterDraft(event.target.value)}
            placeholder="filter tag"
          />
          <button className="button subtle-button" type="button" disabled={isPending} onClick={applyFilters}>
            {isPending ? "Filtering..." : "Apply filters"}
          </button>
        </div>
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
                {resource.tags.length > 0 ? ` - tags: ${resource.tags.join(", ")}` : ""}
                {resource.note_text ? ` - note: ${resource.note_text}` : ""}
                {" - "}
                <button
                  className="button subtle-button"
                  type="button"
                  disabled={isPending}
                  onClick={() => beginResourceEdit(resource)}
                >
                  Edit
                </button>
                {" / "}
                <button
                  className="button subtle-button"
                  type="button"
                  disabled={isPending}
                  onClick={() => deleteResource(resource.id)}
                >
                  Delete
                </button>
                {editingResourceId === resource.id ? (
                  <div className="row" style={{ marginTop: "0.5rem" }}>
                    <input
                      value={editTitleDraft}
                      onChange={(event) => setEditTitleDraft(event.target.value)}
                      placeholder="Resource title"
                    />
                    <input
                      value={editUrlDraft}
                      onChange={(event) => setEditUrlDraft(event.target.value)}
                      placeholder="https://example.com"
                    />
                    <input
                      value={editTagsDraft}
                      onChange={(event) => setEditTagsDraft(event.target.value)}
                      placeholder="tag1, tag2"
                    />
                    <input
                      value={editNoteDraft}
                      onChange={(event) => setEditNoteDraft(event.target.value)}
                      placeholder="note"
                    />
                    <button
                      className="button subtle-button"
                      type="button"
                      disabled={isPending}
                      onClick={saveResourceEdit}
                    >
                      Save
                    </button>
                    <button
                      className="button subtle-button"
                      type="button"
                      disabled={isPending}
                      onClick={cancelResourceEdit}
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
