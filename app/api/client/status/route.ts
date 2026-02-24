import { NextRequest, NextResponse } from "next/server";
import { getLocalClient } from "@/lib/backend/convex";
import { api } from "@/convex/_generated/api";
import { verifySession, verifyHomelabKey } from "@/lib/backend/auth";
import { config } from "@/lib/backend/config";
import { replicateToCloud } from "@/lib/backend/sync";
import { SummaryValue, Log } from "@/lib/backend/schema";

export const dynamic = "force-dynamic";

/**
 * Helper to map Convex document to existing frontend shape
 */
function mapConvexDoc<T extends { _id: string; _creationTime: number }>(doc: T | null) {
  if (!doc) return null;
  const { _id, _creationTime, ...rest } = doc;
  return {
    ...rest,
    id: _id,
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

  // 2. Fetch Core Data
  const [
    activeSessionRaw,
    heartbeatVar,
    summaryVar,
    blocklistVar,
    breakVar,
  ] = await Promise.all([
    convex.query(api.studySessions.getActive),
    convex.query(api.variables.getByKey, { key: "lastHeartbeatAt" }),
    convex.query(api.variables.getByKey, { key: "summary" }),
    convex.query(api.variables.getByKey, { key: "blocklist" }),
    convex.query(api.variables.getByKey, { key: "break" }),
  ]);

  const activeSession = mapConvexDoc(activeSessionRaw);
  const lastHeartbeat = heartbeatVar?.value;
  const summary = summaryVar?.value as SummaryValue | undefined;
  const blocklist = blocklistVar?.value || [];
  const activeBreak = breakVar?.value;

  // 3. Fetch Logs
  let logs: unknown[] = [];
  const sessionId = activeSession?.id || summary?.session_id;
  if (sessionId) {
    const rawLogs = await convex.query(api.logs.getBySession, { sessionId });
    logs = rawLogs.map((l: Log) => mapConvexDoc(l));
  } else if (activeBreak) {
    const rawLogs = await convex.query(api.logs.listRecent, { limit: 20 });
    logs = rawLogs.map((l: Log) => mapConvexDoc(l));
  }

  // 4. Lazy Watchdog
  if (config.isProd && lastHeartbeat?.timestamp && (activeSession || activeBreak)) {
    const hbTime = new Date(lastHeartbeat.timestamp).getTime();
    const nowTime = Date.now();
    const diffSeconds = (nowTime - hbTime) / 1000;
    const diffMinutes = diffSeconds / 60;

    if (diffSeconds > 33) {
      const existingMissed = (logs as { type: string; metadata?: { acknowledged?: boolean } }[]).find(
        (l) => l.type === "missed_heartbeat" && l.metadata?.acknowledged !== true
      );

      if (!existingMissed) {
        try {
          const metadata = {
            last_seen: lastHeartbeat.timestamp,
            gap_minutes: diffMinutes,
            acknowledged: false,
          };
          const logData = {
            type: "missed_heartbeat" as const,
            message: `MISSED HEARTBEAT: Last heard ${Math.floor(diffMinutes)}m ago.`,
            metadata,
            session: activeSession?.id,
          };
          const newLogRaw = await convex.mutation(api.logs.create, logData);
          await replicateToCloud("logs", "create", { ...logData, session: undefined });
          
          // Re-fetch or manually add
          const newLog = mapConvexDoc({ ...logData, _id: newLogRaw, _creationTime: Date.now() });
          logs.unshift(newLog);
        } catch (e) {
          console.error("Failed to log missed heartbeat:", e);
        }
      }
    }
  }

  return NextResponse.json({
    activeSession,
    activeBreak,
    lastHeartbeat,
    summary,
    blocklist,
    logs,
    serverTime: new Date().toISOString(),
  });
}
