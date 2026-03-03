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

const BROWSER_PROVIDERS = [
  { key: "chatgpt-web", label: "ChatGPT Web", loginUrl: "https://chatgpt.com" },
  { key: "claude-web", label: "Claude Web", loginUrl: "https://claude.ai" },
  { key: "gemini-web", label: "Gemini Web", loginUrl: "https://gemini.google.com" }
] as const;

const OAUTH_PROVIDERS = [
  { key: "openai", label: "OpenAI API" },
  { key: "anthropic", label: "Anthropic API" },
  { key: "google", label: "Google AI API" }
] as const;

export function AiConnectionWorkspace({
  initialConnected,
  initialSession
}: AiConnectionWorkspaceProps) {
  const [isPending, startTransition] = useTransition();
  const [connected, setConnected] = useState(initialConnected);
  const [session, setSession] = useState<AiSessionView | null>(initialSession);
  
  // Browser UI state
  const [browserProviderKey, setBrowserProviderKey] = useState<string>(BROWSER_PROVIDERS[0]!.key);
  const [browserModelHint, setBrowserModelHint] = useState("web-default");
  
  // General state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedBrowserProvider = BROWSER_PROVIDERS.find((item) => item.key === browserProviderKey) ?? BROWSER_PROVIDERS[0]!;

  const connectBrowser = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/ai/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerKey: browserProviderKey,
          mode: "browser_ui",
          modelHint: browserModelHint.trim() || null,
          loginUrl: selectedBrowserProvider.loginUrl
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
      setSuccessMessage("AI provider connected (Browser Mode).");
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

  const connectOAuth = (providerKey: string) => {
    window.location.href = `/api/auth/oauth/authorize?provider=${providerKey}`;
  };

  return (
    <div className="stack">
      <div className="panel">
        <h2>Active Connection</h2>
        <p>Status: <strong>{connected ? "Connected" : "Not connected"}</strong></p>
        
        {session ? (
          <div className="box">
            <p><strong>Provider:</strong> {session.providerKey}</p>
            <p><strong>Mode:</strong> {session.mode === "oauth_api" ? "Official API (OAuth)" : "Browser Automation"}</p>
            <p><strong>Model Hint:</strong> {session.modelHint ?? "Default"}</p>
            <p><strong>Connected At:</strong> {session.connectedAt ? new Date(session.connectedAt).toLocaleString() : "Unknown"}</p>
            
            <div className="row" style={{ marginTop: "1rem" }}>
              <button className="button subtle-button" type="button" disabled={isPending} onClick={disconnect}>
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <p>No active AI provider connection. Please connect using one of the methods below.</p>
        )}

        {errorMessage ? <p role="alert" className="error-text">{errorMessage}</p> : null}
        {successMessage ? <p className="success-text">{successMessage}</p> : null}
      </div>

      {!connected && (
        <>
          <div className="panel">
            <h3>Option 1: Official API (Recommended)</h3>
            <p>Connect securely via OAuth. Requires your own API credits/subscription.</p>
            <div className="row">
              {OAUTH_PROVIDERS.map((provider) => (
                <button 
                  key={provider.key} 
                  className="button" 
                  onClick={() => connectOAuth(provider.key)}
                  disabled={isPending}
                >
                  Connect {provider.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <h3>Option 2: Browser Automation (Experimental)</h3>
            <p>
              Uses browser automation to drive a logged-in web session. 
              Requires <code>AI_BROWSER_AUTOMATION=1</code> on server.
            </p>

            <label htmlFor="browser-provider">Provider</label>
            <select
              id="browser-provider"
              value={browserProviderKey}
              disabled={isPending}
              onChange={(event) => setBrowserProviderKey(event.target.value)}
            >
              {BROWSER_PROVIDERS.map((provider) => (
                <option key={provider.key} value={provider.key}>
                  {provider.label}
                </option>
              ))}
            </select>

            <label htmlFor="browser-model-hint">Model hint</label>
            <input
              id="browser-model-hint"
              value={browserModelHint}
              disabled={isPending}
              onChange={(event) => setBrowserModelHint(event.target.value)}
              placeholder="e.g. gpt-4o, claude-3.5-sonnet"
            />

            <div className="row" style={{ marginTop: "1rem" }}>
              <a className="button subtle-button" href={selectedBrowserProvider.loginUrl} target="_blank" rel="noreferrer">
                Open Login Page
              </a>
              <button className="button" type="button" disabled={isPending} onClick={connectBrowser}>
                {isPending ? "Connecting..." : "Mark Connected"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
