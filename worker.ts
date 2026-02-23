import { config } from "@/lib/backend/config";
import { getLocalClient } from "@/lib/backend/convex";
import { api } from "@/convex/_generated/api";
import { bootstrapFromCloud, reconcile, replicateToCloud } from "@/lib/backend/sync";

// Constants
const HEARTBEAT_THRESHOLD_SECONDS = 33;
const RECONCILIATION_INTERVAL_MS = 300000; // 5 minutes

// Validation
if (!config.convexUrl || !config.convexAdminKey) {
  console.error("[Worker] Missing CONVEX credentials in environment.");
  process.exit(1);
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
  }
}

// Start Worker Sequence
async function startWorker() {
  console.log("[Worker] Initializing HIA Worker...");
  
  // 1. Cold Start Bootstrap
  await bootstrapFromCloud();

  // 2. Initial Heartbeat Check
  await checkHeartbeat();

  // 3. Heartbeat Check Loop (30s)
  setInterval(checkHeartbeat, 30 * 1000);

  // 4. Reconciliation Loop (5m)
  setInterval(runReconciliation, RECONCILIATION_INTERVAL_MS);
  
  console.log("[Worker] Heartbeat Monitor and Reconciliation loops started.");
}

startWorker();
