import type { ReactNode } from "react";

import { AppShellNav } from "@/components/app-shell-nav";
import { readSession } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await readSession();

  return (
    <div className="app-shell">
      <header className="app-shell-header">
        <div>
          <p className="eyebrow">AetherForge Workspace</p>
          <h1 className="app-title">Learning Workspace</h1>
          {session ? <p className="session-meta">Signed in as {session.email}</p> : null}
        </div>
        <div className="app-shell-actions">
          <AppShellNav />
          <form action="/api/auth/sign-out" method="post">
            <button className="button subtle-button" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="app-shell-main">{children}</main>
    </div>
  );
}
