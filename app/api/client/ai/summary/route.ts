import { NextRequest, NextResponse } from "next/server";
import { getLocalClient } from "@/lib/backend/convex";
import { api } from "@/convex/_generated/api";
import { verifySession } from "@/lib/backend/auth";
import { generateSessionSummary } from "@/lib/backend/ai";
import { replicateToCloud } from "@/lib/backend/sync";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const isAuthenticated = await verifySession(req);
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convex = getLocalClient();

  try {
    const rawSessions = await convex.query(api.studySessions.list, {
      paginationOpts: { numItems: 1, cursor: null },
    });
    const session = rawSessions.page[0];

    if (!session) {
      return NextResponse.json(
        { error: "No session found to summarize" },
        { status: 404 },
      );
    }

    const logs = await convex.query(api.logs.getBySessionAsc, { sessionId: session._id });

    // 4. Calculate Duration
    const startTime = new Date(session.started_at);
    const endTime = session.ended_at ? new Date(session.ended_at) : new Date();
    const actualDuration = (endTime.getTime() - startTime.getTime()) / 1000;

    // 5. Generate Summary
    const reason = session.end_note?.startsWith("Client reason: ") 
      ? session.end_note.replace("Client reason: ", "") 
      : session.end_note;

    const aiResult = await generateSessionSummary(logs, {
      subject: session.subject,
      status: session.status,
      plannedDuration: session.planned_duration_sec,
      actualDuration: actualDuration,
      reason: reason,
    });

    const serverNow = new Date().toISOString();
    const variableValue = {
      ...aiResult,
      generated_at: serverNow,
      session_id: session._id,
    };

    await convex.mutation(api.variables.upsert, {
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
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
