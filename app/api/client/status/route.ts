import { NextRequest, NextResponse } from "next/server";
import { getLocalClient } from "@/lib/backend/convex";
import { api } from "@/convex/_generated/api";
import { verifySession, verifyHomelabKey } from "@/lib/backend/auth";
import { SummaryValue, Log, BreakValue, StudySession, HeartbeatValue } from "@/lib/backend/schema";
import { reconcileLazyState } from "@/lib/backend/derivation";

export const dynamic = "force-dynamic";

/**
 * Helper to map Convex document to existing frontend shape
 */
function mapConvexDoc<T extends { _id: any; _creationTime: number }>(doc: T | null) {
  if (!doc) return null;
  const { _id, _creationTime, ...rest } = doc;
  return {
    ...rest,
    id: String(_id),
    created_at: new Date(_creationTime).toISOString(),
  };
}

/**
 * GET /api/client/status
 * Returns current session status, last heartbeat, and recent logs.
 */
export async function GET(req: NextRequest) {
  // 1. Auth Check
  const isHomelabAuthenticated = await verifyHomelabKey(req);
  const isUserAuthenticated = isHomelabAuthenticated ? false : await verifySession(req);

  if (!isUserAuthenticated && !isHomelabAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convex = getLocalClient();

  // 2. Initial Fetch
  let [
    activeSessionRaw,
    heartbeatVar,
    summaryVar,
    blocklistVar,
    breakVar,
  ] = await Promise.all([
    convex.query(api.studySessions.getActive) as Promise<StudySession | null>,
    convex.query(api.variables.getByKey, { key: "lastHeartbeatAt" }),
    convex.query(api.variables.getByKey, { key: "summary" }),
    convex.query(api.variables.getByKey, { key: "blocklist" }),
    convex.query(api.variables.getByKey, { key: "break" }),
  ]);

  let heartbeatValue = heartbeatVar?.value as HeartbeatValue | null;
  let summary = summaryVar?.value as SummaryValue | undefined;
  let activeBreak = breakVar?.value as BreakValue | null;

  // 3. Fetch Initial Logs (for reconciliation check)
  const sessionId = activeSessionRaw?._id || (summary?.session_id !== "break-system" ? (summary?.session_id as any) : null);
  let rawLogs = sessionId 
    ? await convex.query(api.logs.getBySession, { sessionId })
    : await convex.query(api.logs.listRecent, { limit: 20 });
  
  const typedLogs = rawLogs as Log[];

  // 4. Lazy Reconciliation
  const stateChanged = await reconcileLazyState({
    activeSession: activeSessionRaw,
    activeBreak,
    lastHeartbeat: heartbeatValue,
    recentLogs: typedLogs,
  });

  if (stateChanged) {
    // Re-fetch EVERYTHING if state changed to ensure consistency
    [
      activeSessionRaw,
      heartbeatVar,
      summaryVar,
      blocklistVar,
      breakVar,
    ] = await Promise.all([
      convex.query(api.studySessions.getActive) as Promise<StudySession | null>,
      convex.query(api.variables.getByKey, { key: "lastHeartbeatAt" }),
      convex.query(api.variables.getByKey, { key: "summary" }),
      convex.query(api.variables.getByKey, { key: "blocklist" }),
      convex.query(api.variables.getByKey, { key: "break" }),
    ]);

    heartbeatValue = heartbeatVar?.value as HeartbeatValue | null;
    summary = summaryVar?.value as SummaryValue | undefined;
    activeBreak = breakVar?.value as BreakValue | null;
    
    const newSessionId = activeSessionRaw?._id || (summary?.session_id !== "break-system" ? (summary?.session_id as any) : null);
    rawLogs = newSessionId 
      ? await convex.query(api.logs.getBySession, { sessionId: newSessionId })
      : await convex.query(api.logs.listRecent, { limit: 20 });
  }

  // 5. Final Assembly
  return NextResponse.json({
    activeSession: mapConvexDoc(activeSessionRaw),
    activeBreak: activeBreak,
    lastHeartbeat: heartbeatValue,
    summary,
    blocklist: blocklistVar?.value || [],
    logs: (rawLogs as Log[]).map(mapConvexDoc),
  });
}
