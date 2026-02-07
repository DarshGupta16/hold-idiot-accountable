import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedPocketBase } from "@/lib/backend/pocketbase";
import { verifySession } from "@/lib/backend/auth";
import { SessionStatus, LogRecord } from "@/lib/backend/types";
import { MissedHeartbeatMetadata } from "@/lib/backend/schema";
import { config } from "@/lib/backend/config";

export const dynamic = "force-dynamic";

/**
 * GET /api/client/status
 * Returns current session status, last heartbeat, and recent logs.
 * Includes a "Lazy Watchdog" check for missed heartbeats (optimized).
 */
export async function GET(req: NextRequest) {
  // 1. Auth Check
  const isAuthenticated = await verifySession(req);
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pb = await getAuthenticatedPocketBase();

  // 2. Fetch Core Data (Active Session, Heartbeat, Summary)
  // Parallelizing fetches for speed
  const [activeSessionResult, heartbeatResult, summaryResult] =
    await Promise.allSettled([
      pb
        .collection("study_sessions")
        .getFirstListItem(`status = "${SessionStatus.ACTIVE}"`),
      pb.collection("variables").getFirstListItem('key = "lastHeartbeatAt"'),
      pb.collection("variables").getFirstListItem('key = "summary"'),
    ]);

  const activeSession =
    activeSessionResult.status === "fulfilled"
      ? activeSessionResult.value
      : null;
  const lastHeartbeatRecord =
    heartbeatResult.status === "fulfilled" ? heartbeatResult.value : null;
  const lastHeartbeat = lastHeartbeatRecord?.value;

  const summaryRecord =
    summaryResult.status === "fulfilled" ? summaryResult.value : null;
  const summary = summaryRecord?.value;

  // ...

  // 3. Fetch Logs
  // If active, fetch logs for current session.
  // If idle, fetch logs for the session referenced in the summary (to show context).
  let logs: LogRecord[] = [];
  try {
    const sessionId = activeSession?.id || summary?.session_id;
    if (sessionId) {
      logs = await pb.collection("logs").getFullList({
        filter: `session = "${sessionId}"`,
        sort: "-created_at",
      });
    }
  } catch (e) {
    console.error("Error fetching logs:", e);
  }

  // 4. Lazy Watchdog (Server-Side Safety Net)
  if (config.isProd && lastHeartbeat?.timestamp && activeSession) {
    const hbTime = new Date(lastHeartbeat.timestamp).getTime();
    const nowTime = Date.now();
    const diffSeconds = (nowTime - hbTime) / 1000;
    const diffMinutes = diffSeconds / 60;

    if (diffSeconds > 33) {
      try {
        const metadata: MissedHeartbeatMetadata = {
          last_seen: lastHeartbeat.timestamp,
          gap_minutes: diffMinutes,
          acknowledged: false,
        };
        const newLog = await pb.collection("logs").create({
          type: "missed_heartbeat",
          message: `MISSED HEARTBEAT: Last heard ${Math.floor(diffMinutes)}m ago.`,
          metadata,
          session: activeSession.id,
        });
        logs.unshift(newLog as unknown as LogRecord);
      } catch (e) {
        console.error("Failed to log missed heartbeat:", e);
      }
    }
  }

  return NextResponse.json({
    activeSession,
    lastHeartbeat,
    summary,
    logs,
    serverTime: new Date().toISOString(),
  });
}
