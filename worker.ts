import { config } from "@/lib/backend/config";
import { getLocalClient } from "@/lib/backend/convex";
import { api } from "@/convex/_generated/api";
import { bootstrapFromCloud, reconcile, replicateToCloud } from "@/lib/backend/sync";
import { processBreakStop } from "@/lib/backend/derivation";
import { EventType } from "@/lib/backend/types";
import { BreakValue } from "@/lib/backend/schema";

// Constants
const HEARTBEAT_THRESHOLD_SECONDS = 33;
const RECONCILIATION_INTERVAL_MS = 300000; // 5 minutes

// Validation
if (!config.convexUrl || !config.convexAdminKey) {
  console.error("[Worker] Missing CONVEX credentials in environment.");
  process.exit(1);
}

/**
 * Checks for expired breaks and transitions to the next session.
 */
async function checkBreaks() {
  try {
    const convex = getLocalClient();
    const breakVar = await convex.query(api.variables.getByKey, { key: "break" });

    if (!breakVar) return;

    const breakVal = breakVar.value as BreakValue;
    const startTime = new Date(breakVal.started_at).getTime();
    const now = Date.now();
    const elapsedSeconds = (now - startTime) / 1000;

    if (elapsedSeconds >= breakVal.duration_sec) {
      console.log(
        `[Worker] Break expired (${elapsedSeconds.toFixed(1)}s elapsed). Starting next session: ${breakVal.next_session.subject}`,
      );
      await processBreakStop({
        event_type: EventType.BREAK_STOP,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (e: unknown) {
    // Ignore invariant violations (likely already processed by client)
    if (e instanceof Error && e.message.includes("Invariant")) {
      return;
    }
    console.error("[Worker] Break Check Error:", e);
  }
}

/**
 * Checks for missed heartbeats and logs them if detected.
 */
async function checkHeartbeat() {
  try {
    const convex = getLocalClient();

    // 1. Get Last Heartbeat
    const heartbeatVar = await convex.query(api.variables.getByKey, { key: "lastHeartbeatAt" });
    const lastHeartbeat = heartbeatVar?.value;

    if (!lastHeartbeat?.timestamp) {
      console.log("[Worker] No heartbeat record found. Standby...");
      return;
    }

    const hbTime = new Date(lastHeartbeat.timestamp).getTime();
    const nowTime = Date.now();
    const diffSeconds = Math.floor((nowTime - hbTime) / 1000);
    const diffMinutes = diffSeconds / 60;

    if (diffSeconds > HEARTBEAT_THRESHOLD_SECONDS / 2) {
      console.log(`[Worker] Heartbeat status: ${diffSeconds}s ago (Threshold: ${HEARTBEAT_THRESHOLD_SECONDS}s)`);
    }

    // 2. Check threshold
    if (diffSeconds > HEARTBEAT_THRESHOLD_SECONDS) {
      // 3. Check for Active Session
      const activeSession = await convex.query(api.studySessions.getActive);
      if (!activeSession) return;

      // 4. Log missed heartbeat immediately
      console.error(
        `[Worker] MISSING HEARTBEAT detected in session ${activeSession._id}! Gap: ${diffMinutes.toFixed(2)}m`,
      );
      
      const metadata = {
        last_seen: lastHeartbeat.timestamp,
        gap_minutes: diffMinutes,
        acknowledged: false,
      };

      const logData = {
        type: "missed_heartbeat" as const,
        message: `ALERT: Missed heartbeat. Last contact: ${Math.floor(diffSeconds)}s ago.`,
        metadata,
        session: activeSession._id,
      };
      
      await convex.mutation(api.logs.create, logData);
      await replicateToCloud("logs", "create", { ...logData, session: undefined });
      console.log("[Worker] Missed heartbeat log created.");
    }
  } catch (e: unknown) {
    console.error("[Worker] Loop Error:", e);
  }
}

async function runReconciliation() {
  console.log("[Worker] Starting periodic reconciliation...");
  try {
    await reconcile();
  } catch (e) {
    console.error("[Worker] Reconciliation failed:", e);
  } finally {
    // Schedule next run after this one finishes
    setTimeout(runReconciliation, RECONCILIATION_INTERVAL_MS);
  }
}

async function runHeartbeatCheck() {
  await checkHeartbeat();
  // Schedule next run after this one finishes (30s)
  setTimeout(runHeartbeatCheck, 30 * 1000);
}

async function runBreakCheck() {
  await checkBreaks();
  // Check more frequently for breaks (every 5 seconds)
  setTimeout(runBreakCheck, 5 * 1000);
}

// Start Worker Sequence
async function startWorker() {
  console.log("[Worker] Initializing HIA Worker...");
  
  // 1. Cold Start Bootstrap
  await bootstrapFromCloud();

  // 2. Start Loops
  runHeartbeatCheck();
  runBreakCheck();
  runReconciliation();
  
  console.log("[Worker] Heartbeat Monitor, Break Monitor and Reconciliation loops started.");
}

startWorker();
