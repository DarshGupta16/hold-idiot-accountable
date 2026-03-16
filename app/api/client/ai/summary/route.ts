import { NextRequest, NextResponse } from "next/server";
import { getLocalClient } from "@/lib/backend/convex";
import { internal } from "@/convex/_generated/api";
import { verifySession } from "@/lib/backend/auth";
import { generateSessionSummary } from "@/lib/backend/ai";
import { replicateToCloud } from "@/lib/backend/sync";
import { asPublic } from "@/lib/backend/types";

export async function POST(req: NextRequest) {
  const isAuthenticated = await verifySession(req);
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convex = getLocalClient();

  try {
    const rawSessions = await convex.query(asPublic(internal.studySessions.list), {
      paginationOpts: { numItems: 1, cursor: null },
    });

    if (!rawSessions.page || rawSessions.page.length === 0) {
      return NextResponse.json({ error: "No sessions found" }, { status: 404 });
    }

    const session = rawSessions.page[0];

    const currentSummaryVar = await convex.query(asPublic(internal.variables.getByKey), { key: "summary" });
    
    // Check if summary already exists for this session
    if (currentSummaryVar?.value?.session_id === session._id) {
       return NextResponse.json({ success: true, summary: currentSummaryVar.value, alreadyGenerated: true });
    }

    const logs = await convex.query(asPublic(internal.logs.getBySessionAsc), { sessionId: session._id });

    const actualDuration = session.ended_at 
      ? (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000
      : undefined;

    const aiResult = await generateSessionSummary(logs as any, {
      subject: session.subject,
      plannedDuration: session.planned_duration_sec,
      actualDuration,
      status: session.status,
      reason: session.end_note,
    });

    const variableValue = {
      session_id: session._id,
      ...aiResult,
      generated_at: new Date().toISOString(),
    };

    await convex.mutation(asPublic(internal.variables.upsert), {
      key: "summary",
      value: variableValue,
    });
    await replicateToCloud("variables", "upsert", {
      key: "summary",
      value: variableValue,
    });

    return NextResponse.json({ success: true, summary: aiResult });
  } catch (error) {
    console.error("Summary generation error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
