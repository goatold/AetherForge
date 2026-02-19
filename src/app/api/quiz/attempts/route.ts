import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { executeQuery, quizAttemptQueries, workspaceQueries } from "@/lib/db";

const ALLOWED_TIMEFRAMES = [7, 14, 30, 90] as const;

const parseTimeframe = (value: string | null): number => {
  if (!value) {
    return 30;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || !ALLOWED_TIMEFRAMES.includes(parsed as (typeof ALLOWED_TIMEFRAMES)[number])) {
    return 30;
  }
  return parsed;
};

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceResult = await executeQuery<{ id: string }>(
    workspaceQueries.listForUser(session.userId)
  );
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return NextResponse.json({ attempts: [], timeframeDays: 30 });
  }

  const { searchParams } = new URL(request.url);
  const timeframeDays = parseTimeframe(searchParams.get("timeframeDays"));
  const attemptsResult = await executeQuery<{
    id: string;
    score_percent: string | null;
    submitted_at: string | null;
  }>(quizAttemptQueries.listRecentByWorkspaceSince(workspace.id, 20, timeframeDays));

  return NextResponse.json({
    timeframeDays,
    attempts: attemptsResult.rows
  });
}
