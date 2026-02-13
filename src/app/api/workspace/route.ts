import { NextResponse } from "next/server";

import {
  type WorkspaceSummary,
  type WorkspaceSummaryResponse
} from "@/lib/contracts/domain";

const workspace: WorkspaceSummary = {
  id: "ws-placeholder",
  topic: "Operating Systems",
  difficulty: "beginner",
  goals: [
    { id: "goal-1", label: "Learn process scheduling basics" },
    { id: "goal-2", label: "Understand memory management tradeoffs" }
  ],
  createdAtIso: new Date().toISOString()
};

export async function GET() {
  const body: WorkspaceSummaryResponse = {
    workspace
  };

  return NextResponse.json(body);
}
