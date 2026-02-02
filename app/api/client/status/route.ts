import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedPocketBase } from "@/lib/backend/pocketbase";
import { verifySession } from "@/lib/backend/auth";
import { SessionStatus } from "@/lib/backend/types";
import { config } from "../../../../lib/backend/config";

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

  // 2. Fetch Core Data (Active Session & Heartbeat)
  // Parallelizing fetches for speed
  const [activeSessionResult, heartbeatResult] = await Promise.allSettled([
    pb
      .collection("study_sessions")
      .getFirstListItem(`status = "${SessionStatus.ACTIVE}"`),
    pb.collection("variables").getFirstListItem('key = "lastHeartbeatAt"'),
  ]);

  const activeSession =
    activeSessionResult.status === "fulfilled"
      ? activeSessionResult.value
      : null;
  const lastHeartbeatRecord =
    heartbeatResult.status === "fulfilled" ? heartbeatResult.value : null;
  const lastHeartbeat = lastHeartbeatRecord?.value;

  // 3. Fetch Logs (Only if session is active)
  let logs: any[] = [];
  if (activeSession) {
    try {
      logs = await pb.collection("logs").getFullList({
        filter: `session = "${activeSession.id}"`,
        sort: "-created",
      });
    } catch (e) {
      console.error("Error fetching logs:", e);
    }
  }

  // 4. Lazy Watchdog (Server-Side Safety Net)
  // Checks if we should log a missed heartbeat, but uses the Worker as primary.
  // This acts as a backup or immediate check if the client polls before the worker runs.
  if (config.isProd && lastHeartbeat?.timestamp && activeSession) {
    const hbTime = new Date(lastHeartbeat.timestamp).getTime();
    const nowTime = Date.now();
    const diffMinutes = (nowTime - hbTime) / 1000 / 60;

    if (diffMinutes > 2) {
      // Check for recent "missed_heartbeat" log efficiently
      // We check the 'logs' array we already fetched since it contains the session history.
      // If the list is huge, this might be slow, but for a session scope, it's usually fine.
      // Optimization: We check the most recent log in memory first.

      const lastLog = logs.length > 0 ? logs[0] : null;
      const alreadyLogged = lastLog?.type === "missed_heartbeat";

      // Only log if not already logged recently
      if (!alreadyLogged) {
        try {
          const newLog = await pb.collection("logs").create({
            type: "missed_heartbeat",
            message: `MISSED HEARTBEAT: Last heard ${Math.floor(diffMinutes)}m ago.`,
            metadata: {
              last_seen: lastHeartbeat.timestamp,
              gap_minutes: diffMinutes,
              acknowledged: false,
            },
            session: activeSession.id,
          });

          // Add to local logs array so the UI sees it immediately without refetch
          logs.unshift(newLog);
        } catch (e) {
          console.error("Failed to log missed heartbeat:", e);
        }
      }
    }
  }

  return NextResponse.json({
    activeSession,
    lastHeartbeat,
    logs,
    serverTime: new Date().toISOString(),
  });
}
