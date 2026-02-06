import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { config } from "@/lib/backend/config";
import PocketBase from "pocketbase";

// Constants
const HEARTBEAT_THRESHOLD_MINUTES = 2;
const LOG_DEBOUNCE_MINUTES = 5;

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
      // PocketBase v0.23+ uses _superusers collection for admin auth
      await pb
        .collection("_superusers")
        .authWithPassword(config.adminEmail, config.adminPassword!);
    }

    // 2. Get Last Heartbeat
    let lastHeartbeat;
    try {
      lastHeartbeat = (
        await pb
          .collection("variables")
          .getFirstListItem('key = "lastHeartbeatAt"')
      ).value;
    } catch {
      // No heartbeat recorded yet; silent return.
      return;
    }

    if (!lastHeartbeat?.timestamp) return;

    const hbTime = new Date(lastHeartbeat.timestamp).getTime();
    const nowTime = Date.now();
    const diffMinutes = (nowTime - hbTime) / 1000 / 60;

    // 3. Check threshold
    if (diffMinutes > HEARTBEAT_THRESHOLD_MINUTES) {
      // 4. Check for Active Session
      // We only care about missed heartbeats if a session is supposedly active.
      let activeSessionId = null;
      try {
        const session = await pb
          .collection("study_sessions")
          .getFirstListItem('status = "active"');
        activeSessionId = session.id;
      } catch {
        // No active session -> No need to alert for missed heartbeats.
        return;
      }

      // 5. Check if recently logged to prevent spam
      // Efficient query: only get the very last missed_heartbeat log
      const recentLogs = await pb.collection("logs").getList(1, 1, {
        sort: "-created_at",
        filter: 'type = "missed_heartbeat"',
      });

      const lastLog = recentLogs.items[0];
      const recentlyLogged =
        lastLog &&
        nowTime - new Date(lastLog.created).getTime() <
          LOG_DEBOUNCE_MINUTES * 60 * 1000;

      if (!recentlyLogged) {
        console.log(
          `[Worker] MISSING HEARTBEAT detected! Gap: ${diffMinutes.toFixed(2)}m`,
        );
        await pb.collection("logs").create({
          type: "missed_heartbeat",
          message: `MISSED HEARTBEAT: Last heard ${Math.floor(
            diffMinutes,
          )}m ago (Worker Detected).`,
          metadata: {
            last_seen: lastHeartbeat.timestamp,
            gap_minutes: diffMinutes,
            acknowledged: false,
          },
          session: activeSessionId,
        });
      }
    }
  } catch (e) {
    console.error("[Worker] Error:", e);
  }
}

// Start Worker
console.log("[Worker] Starting Heartbeat Monitor...");
checkHeartbeat(); // Run immediately
setInterval(checkHeartbeat, 60 * 1000); // Loop every minute
