import { NextRequest, NextResponse } from "next/server";
import { getLocalClient } from "@/lib/backend/convex";
import { internal } from "@/convex/_generated/api";
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
    const rawSessions = await convex.query(internal.studySessions.list as any, {
      paginationOpts: { numItems: 1, cursor: null },
    });
    const session = rawSessions.page[0];

    if (!session) {
      return NextResponse.json(
        { error: "No session found" },
        { status: 404 },
      );
    }

    // 1. Quota / Cooldown Check
    const currentSummaryVar = await convex.query(internal.variables.getByKey as any, { key: "summary" });
    const currentSummary = currentSummaryVar?.value;

    if (currentSummary && currentSummary.session_id === session._id) {
      const generatedAt = new Date(currentSummary.generated_at).getTime();
      const now = Date.now();
      const fiveMinutesInMs = 5 * 60 * 1000;

      if (now - generatedAt < fiveMinutesInMs) {
        return NextResponse.json({ success: true, summary: currentSummary, cached: true });
      }
    }

    const logs = await convex.query(internal.logs.getBySessionAsc as any, { sessionId: session._id });

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

    await convex.mutation(internal.variables.upsert as any, {
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
