import { ExportWorkspace } from "@/components/export-workspace";
import { readSession } from "@/lib/auth/session";

export default async function ExportPage() {
  const session = await readSession();
  if (!session) {
    return (
      <section className="panel">
        <h2>Export study packet</h2>
        <p>Sign in to export printable study packets.</p>
      </section>
    );
  }

  return <ExportWorkspace />;
}
