import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedPocketBase } from "@/lib/backend/pocketbase";
import { verifySession } from "@/lib/backend/auth";
import { generateSessionSummary } from "@/lib/backend/ai";
import { SessionStatus } from "@/lib/backend/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1. Auth Check (Critical)
  const isAuthenticated = await verifySession(req);
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pb = await getAuthenticatedPocketBase();

  try {
    // 2. Fetch Active or Most Recent Session
    // We want to summarize whatever is "current" or "just finished"
    // So usually we fetch the last created session.
    const session = await pb.collection("study_sessions").getFirstListItem("", {
      sort: "-created",
    });

    if (!session) {
      return NextResponse.json(
        { error: "No session found to summarize" },
        { status: 404 },
      );
    }

    // 3. Fetch logs for that session
    const logs = await pb.collection("logs").getFullList({
      filter: `session = "${session.id}"`,
      sort: "created",
    });

    // 4. Calculate Duration
    const startTime = new Date(session.started_at);
    const endTime = session.ended_at ? new Date(session.ended_at) : new Date();
    const actualDuration = (endTime.getTime() - startTime.getTime()) / 1000;

    // 5. Generate Summary
    const aiResult = await generateSessionSummary(logs, {
      subject: session.subject,
      status: session.status,
      plannedDuration: session.planned_duration_sec,
      actualDuration: actualDuration,
    });

    // 6. Store Summary in 'variables' (Singleton state)
    // We overwrite the 'summary' key.
    const serverNow = new Date().toISOString();

    // Upsert logic for variables
    try {
      const existing = await pb
        .collection("variables")
        .getFirstListItem('key="summary"');

      await pb.collection("variables").update(existing.id, {
        value: {
          ...aiResult, // Spread structured output (summary_text, status_label)
          generated_at: serverNow,
          session_id: session.id,
        },
      });
    } catch {
      await pb.collection("variables").create({
        key: "summary",
        value: {
          ...aiResult,
          generated_at: serverNow,
          session_id: session.id,
        },
      });
    }

    return NextResponse.json({ success: true, summary: aiResult });
  } catch (error) {
    console.error("Summary generation error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
