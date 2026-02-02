import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import PocketBase from "pocketbase";

// Use centralized config logic inline or import if running via tsx/ts-node
// Since this is a standalone worker, we'll keep it simple but robust.
// Ideally, we import { config } from "./lib/backend/config" if paths align.
// Given tsx execution in root, we can try importing from lib.
// If that fails in some envs, we fallback to process.env.
// For HIA's current setup, let's use the explicit process.env check here to be 100% standalone-safe,
// OR rely on the fact that `tsx` handles path aliases if configured.
// To be safe and avoid alias issues in simple scripts, we will re-implement the config check locally for the worker.

const POCKETBASE_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
const EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("[Worker] Missing ADMIN credentials in environment.");
  process.exit(1);
}

const pb = new PocketBase(POCKETBASE_URL);

/**
 * Checks for missed heartbeats and logs them if detected.
 * Runs every minute.
 */
async function checkHeartbeat() {
  try {
    // 1. Authenticate if needed
    if (!pb.authStore.isValid) {
      await pb.admins.authWithPassword(EMAIL!, PASSWORD!);
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

    // 3. Check threshold (> 2 minutes)
    if (diffMinutes > 2) {
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
        sort: "-created",
        filter: 'type = "missed_heartbeat"',
      });

      const lastLog = recentLogs.items[0];
      const recentlyLogged =
        lastLog &&
        nowTime - new Date(lastLog.created).getTime() < 60 * 1000 * 5; // 5-minute debounce

      if (!recentlyLogged) {
        console.log(
          `[Worker] MISSING HEARTBEAT detected! Gap: ${diffMinutes.toFixed(2)}m`,
        );
        await pb.collection("logs").create({
          type: "missed_heartbeat",
          message: `MISSED HEARTBEAT: Last heard ${Math.floor(diffMinutes)}m ago (Worker Detected).`,
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
