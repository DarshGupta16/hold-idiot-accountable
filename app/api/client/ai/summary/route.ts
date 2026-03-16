import { NextRequest, NextResponse } from "next/server";
import { getLocalClient } from "@/lib/backend/convex";
import { internal } from "@/convex/_generated/api";
import { verifySession } from "@/lib/backend/auth";
import { generateSessionSummary } from "@/lib/backend/ai";
import { replicateToCloud } from "@/lib/backend/sync";
import { asPublic } from "@/lib/backend/types";
...
    const rawSessions = await convex.query(asPublic(internal.studySessions.list), {
      paginationOpts: { numItems: 1, cursor: null },
    });
...
    const currentSummaryVar = await convex.query(asPublic(internal.variables.getByKey), { key: "summary" });
...
    const logs = await convex.query(asPublic(internal.logs.getBySessionAsc), { sessionId: session._id });
...
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
