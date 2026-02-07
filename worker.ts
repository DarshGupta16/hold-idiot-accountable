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
    if (!pb.authStore.isValid) {
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
        .getFirstListItem('key = "lastHeartbeatAt"');
      lastHeartbeat = record.value;
    } catch {
      // No heartbeat recorded yet
      console.log(
        "[Worker] No heartbeat record found. Waiting for first heartbeat...",
      );
      return;
    }

    if (!lastHeartbeat?.timestamp) {
      console.log("[Worker] Heartbeat record exists but has no timestamp.");
      return;
    }

    const hbTime = new Date(lastHeartbeat.timestamp).getTime();
    const nowTime = Date.now();
    const diffMinutes = (nowTime - hbTime) / 1000 / 60;
    const diffSeconds = (nowTime - hbTime) / 1000;

    console.log(`[Worker] Last heartbeat: ${diffSeconds.toFixed(1)}s ago`);

    // 3. Check threshold
    if (diffSeconds > HEARTBEAT_THRESHOLD_SECONDS) {
      // 4. Check for Active Session
      let activeSessionId: string | null = null;
      try {
        const session = await pb
          .collection<StudySession>("study_sessions")
          .getFirstListItem('status = "active"');
        activeSessionId = session.id;
        console.log(`[Worker] Active session found: ${activeSessionId}`);
      } catch {
        // No active session -> No need to alert for missed heartbeats.
        console.log(
          "[Worker] No active session. Skipping missed heartbeat check.",
        );
        return;
      }

      // 5. Log missed heartbeat immediately (No debouncing)
      console.log(
        `[Worker] MISSING HEARTBEAT detected! Gap: ${diffMinutes.toFixed(2)}m`,
      );
      const metadata: MissedHeartbeatMetadata = {
        last_seen: lastHeartbeat.timestamp,
        gap_minutes: diffMinutes,
        acknowledged: false,
      };
      await pb.collection<Log>("logs").create({
        type: "missed_heartbeat",
        message: `MISSED HEARTBEAT: Last heard ${Math.floor(
          diffMinutes,
        )}m ago (Worker Detected).`,
        metadata,
        session: activeSessionId,
      });
      console.log("[Worker] Missed heartbeat logged successfully.");
    }
  } catch (e) {
    console.error("[Worker] Error:", e);
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
