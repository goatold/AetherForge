import { NextResponse } from "next/server";

import {
  type WorkspaceSummary,
  type WorkspaceSummaryResponse
} from "@/lib/contracts/domain";
import { readSession } from "@/lib/auth/session";

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace: WorkspaceSummary = {
    id: `ws-${session.userId}`,
    topic: "Operating Systems",
    difficulty: "beginner",
    goals: [
      { id: "goal-1", label: "Learn process scheduling basics" },
      { id: "goal-2", label: "Understand memory management tradeoffs" }
    ],
    createdAtIso: new Date().toISOString()
  };

  const body: WorkspaceSummaryResponse = {
    workspace
  };

  return NextResponse.json(body);
}
