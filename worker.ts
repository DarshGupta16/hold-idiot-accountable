import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { config } from "@/lib/backend/config";
import {
  MissedHeartbeatMetadata,
  StudySession,
  Log,
  HeartbeatVariable,
} from "@/lib/backend/schema";
import PocketBase from "pocketbase";

// Constants
const HEARTBEAT_THRESHOLD_SECONDS = 33;

// Validation
if (!config.adminEmail || !config.adminPassword) {
  console.error("[Worker] Missing ADMIN credentials in environment.");
  process.exit(1);
}

const pb = new PocketBase(config.pocketbaseUrl);

/**
 * Checks for missed heartbeats and logs them if detected.
 * Runs every minute.
 */
async function checkHeartbeat() {
  try {
    // 1. Authenticate if needed
    if (!pb.authStore.isValid || pb.authStore.model === null) {
      console.log("[Worker] Authenticating with PocketBase...");
      await pb
        .collection("_superusers")
        .authWithPassword(config.adminEmail, config.adminPassword!);
      console.log("[Worker] Authentication successful.");
    }

    // 2. Get Last Heartbeat
    let lastHeartbeat: HeartbeatVariable["value"] | undefined;
    try {
      const record = await pb
        .collection<HeartbeatVariable>("variables")
        .getFirstListItem('key = "lastHeartbeatAt"', {
          sort: "-updated_at", // Get the most recent one in case of duplicates
        });
      lastHeartbeat = record.value;
    } catch {
      console.log("[Worker] No heartbeat record found. Standby...");
      return;
    }

    if (!lastHeartbeat?.timestamp) {
      console.warn("[Worker] Heartbeat record found but lacks timestamp.");
      return;
    }

    const hbTime = new Date(lastHeartbeat.timestamp.replace(" ", "T")).getTime();
    const nowTime = Date.now();
    const diffSeconds = Math.floor((nowTime - hbTime) / 1000);
    const diffMinutes = diffSeconds / 60;

    // Only log every 30s check if it's getting close to threshold or missing
    if (diffSeconds > HEARTBEAT_THRESHOLD_SECONDS / 2) {
      console.log(`[Worker] Heartbeat status: ${diffSeconds}s ago (Threshold: ${HEARTBEAT_THRESHOLD_SECONDS}s)`);
    }

    // 3. Check threshold
    if (diffSeconds > HEARTBEAT_THRESHOLD_SECONDS) {
      // 4. Check for Active Session
      let activeSessionId: string | null = null;
      try {
        const session = await pb
          .collection<StudySession>("study_sessions")
          .getFirstListItem('status = "active"');
        activeSessionId = session.id;
      } catch {
        // No active session -> No need to alert for missed heartbeats.
        return;
      }

      // 5. Log missed heartbeat immediately
      console.error(
        `[Worker] MISSING HEARTBEAT detected in session ${activeSessionId}! Gap: ${diffMinutes.toFixed(2)}m`,
      );
      
      const metadata: MissedHeartbeatMetadata = {
        last_seen: lastHeartbeat.timestamp,
        gap_minutes: diffMinutes,
        acknowledged: false,
      };

      await pb.collection<Log>("logs").create({
        type: "missed_heartbeat",
        message: `ALERT: Missed heartbeat. Last contact: ${Math.floor(diffSeconds)}s ago.`,
        metadata,
        session: activeSessionId,
      });
      console.log("[Worker] Missed heartbeat log created.");
    }
  } catch (e: unknown) {
    console.error("[Worker] Loop Error:", e);
  }
}

// Start Worker
console.log("[Worker] Starting Heartbeat Monitor...");
console.log(`[Worker] PocketBase URL: ${config.pocketbaseUrl}`);
console.log(
  `[Worker] Threshold: ${HEARTBEAT_THRESHOLD_SECONDS}s, Debounce: DISABLED`,
);
checkHeartbeat(); // Run immediately
setInterval(checkHeartbeat, 30 * 1000); // Loop every 30s for tighter check
