"use client";

import { useState, useTransition } from "react";

type ProviderMode = "browser_ui" | "oauth_api";

interface AiSessionView {
  providerKey: string;
  mode: ProviderMode;
  modelHint: string | null;
  loginUrl: string | null;
  connectedAt: string | null;
}

interface AiConnectionWorkspaceProps {
  initialConnected: boolean;
  initialSession: AiSessionView | null;
}

const PROVIDERS = [
  { key: "chatgpt-web", label: "ChatGPT Web", loginUrl: "https://chatgpt.com" },
  { key: "claude-web", label: "Claude Web", loginUrl: "https://claude.ai" },
  { key: "gemini-web", label: "Gemini Web", loginUrl: "https://gemini.google.com" }
] as const;

export function AiConnectionWorkspace({
  initialConnected,
  initialSession
}: AiConnectionWorkspaceProps) {
  const [isPending, startTransition] = useTransition();
  const [connected, setConnected] = useState(initialConnected);
  const [session, setSession] = useState<AiSessionView | null>(initialSession);
  const [providerKey, setProviderKey] = useState<string>(PROVIDERS[0]!.key);
  const [modelHint, setModelHint] = useState("web-default");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedProvider = PROVIDERS.find((item) => item.key === providerKey) ?? PROVIDERS[0]!;

  const connect = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/ai/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerKey,
          mode: "browser_ui",
          modelHint: modelHint.trim() || null,
          loginUrl: selectedProvider.loginUrl
        })
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; connected?: boolean; session?: AiSessionView | null }
        | null;
      if (!response.ok || !body?.connected) {
        setErrorMessage(body?.error ?? "Failed to connect AI provider.");
        return;
      }
      setConnected(true);
      setSession(body.session ?? null);
      setSuccessMessage("AI provider connected.");
    });
  };

  const disconnect = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/ai/session", { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; disconnected?: boolean }
        | null;
      if (!response.ok || !body?.disconnected) {
        setErrorMessage(body?.error ?? "Failed to disconnect AI provider.");
        return;
      }
      setConnected(false);
      setSession(null);
      setSuccessMessage("AI provider disconnected.");
    });
  };

  return (
    <div className="panel">
      <h2>AI provider connection</h2>
      <p>
        Log in to your AI provider in a separate browser tab, then mark the provider as connected
        here to enable concept and quiz generation.
      </p>
      <p>
        Browser automation executes only when server env <code>AI_BROWSER_AUTOMATION=1</code> is
        enabled; otherwise generation uses deterministic fallback payloads with provider lineage.
      </p>

      <label htmlFor="provider">Provider</label>
      <select
        id="provider"
        value={providerKey}
        disabled={isPending}
        onChange={(event) => setProviderKey(event.target.value)}
      >
        {PROVIDERS.map((provider) => (
          <option key={provider.key} value={provider.key}>
            {provider.label}
          </option>
        ))}
      </select>

      <label htmlFor="model-hint">Model hint</label>
      <input
        id="model-hint"
        value={modelHint}
        disabled={isPending}
        onChange={(event) => setModelHint(event.target.value)}
        placeholder="e.g. gpt-4o, claude-3.5-sonnet"
      />

      <div className="row">
        <a className="button subtle-button" href={selectedProvider.loginUrl} target="_blank" rel="noreferrer">
          Open provider login
        </a>
        <button className="button" type="button" disabled={isPending} onClick={connect}>
          {isPending ? "Connecting..." : "Mark connected"}
        </button>
        <button className="button subtle-button" type="button" disabled={isPending} onClick={disconnect}>
          Disconnect
        </button>
      </div>

      <p>Status: {connected ? "Connected" : "Not connected"}</p>
      {session ? (
        <p>
          Active session: {session.providerKey} / {session.modelHint ?? "web-default"}
        </p>
      ) : null}
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {successMessage ? <p>{successMessage}</p> : null}
    </div>
  );
}
