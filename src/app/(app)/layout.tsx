import type { ReactNode } from "react";

import { AppShellNav } from "@/components/app-shell-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-shell-header">
        <div>
          <p className="eyebrow">AetherForge Workspace</p>
          <h1 className="app-title">Learning Workspace</h1>
        </div>
        <AppShellNav />
      </header>
      <main className="app-shell-main">{children}</main>
    </div>
  );
}
