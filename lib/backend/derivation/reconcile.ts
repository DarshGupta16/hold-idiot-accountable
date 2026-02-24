import { getLocalClient } from "@/lib/backend/convex";
import { api } from "@/convex/_generated/api";
import { config } from "@/lib/backend/config";
import { BreakValue, Log, StudySession, HeartbeatValue } from "@/lib/backend/schema";
import { EventType } from "@/lib/backend/types";
import { processBreakStop } from "./breaks";

/**
 * Reconciles state that might have changed since the last check.
 * This handles "lazy" transitions that would ideally be handled by a worker,
 * but are here to ensure the UI always reflects the truth even if the worker fails.
 */
export async function reconcileLazyState(context: {
  activeSession: StudySession | null;
  activeBreak: BreakValue | null;
  lastHeartbeat: HeartbeatValue | null;
  recentLogs: Log[];
}) {
  const { activeSession, activeBreak, lastHeartbeat, recentLogs } = context;
  const convex = getLocalClient();

  // 1. Lazy Break Expiry
  if (activeBreak && !activeSession) {
    const startTime = new Date(activeBreak.started_at).getTime();
    const now = Date.now();
    const elapsedSeconds = (now - startTime) / 1000;

    if (elapsedSeconds >= activeBreak.duration_sec) {
      console.log(`[Reconcile] Break expired (${elapsedSeconds.toFixed(1)}s elapsed). Lazy stopping...`);
      try {
        await processBreakStop({
          event_type: EventType.BREAK_STOP,
          timestamp: new Date().toISOString(),
        });
        return true; // State changed
      } catch (e) {
        console.error("Failed to lazy stop break:", e);
      }
    }
  }

  // 2. Lazy Watchdog (Missed Heartbeat detection)
  if (config.isProd && lastHeartbeat?.timestamp && (activeSession || activeBreak)) {
    const hbTime = new Date(lastHeartbeat.timestamp).getTime();
    const nowTime = Date.now();
    const diffSeconds = (nowTime - hbTime) / 1000;
    const diffMinutes = diffSeconds / 60;

    if (diffSeconds > 33) {
      const existingMissed = recentLogs.find(
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
            message: `MISSED_HEARTBEAT: No ping for ${diffMinutes.toFixed(1)}m. Check machine connectivity.`,
            metadata,
            session: activeSession?._id,
          };
          
          await convex.mutation(api.logs.create, logData);
          return true; // State changed
        } catch (e) {
          console.error("Failed to log lazy missed heartbeat:", e);
        }
      }
    }
  }

  return false; // No state change
}
