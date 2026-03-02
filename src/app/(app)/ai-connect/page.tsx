import { redirect } from "next/navigation";

import { AiConnectionWorkspace } from "@/components/ai-connection-workspace";
import { readSession } from "@/lib/auth/session";
import { getConnectedAiProviderSession } from "@/lib/ai/provider-session";

export default async function AiConnectPage() {
  const session = await readSession();
  if (!session) {
    redirect("/sign-in?next=/ai-connect");
  }

  const connectedSession = await getConnectedAiProviderSession(session.userId);

  return (
    <div className="stack">
      <AiConnectionWorkspace
        initialConnected={Boolean(connectedSession)}
        initialSession={
          connectedSession
            ? {
                providerKey: connectedSession.providerKey,
                mode: connectedSession.mode,
                modelHint: connectedSession.modelHint,
                loginUrl: connectedSession.loginUrl,
                connectedAt: connectedSession.connectedAt
              }
            : null
        }
      />
    </div>
  );
}
