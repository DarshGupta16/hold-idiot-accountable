import { replicatedMutation } from "@/lib/backend/sync";
import { HeartbeatSchema, MissedHeartbeatSchema, asPublic } from "@/lib/backend/types";
import { z } from "zod";
import { getLocalClient } from "@/lib/backend/convex";
import { internal } from "@/convex/_generated/api";
import { replicateToCloud } from "@/lib/backend/sync";

export async function processHeartbeat(
  payload: z.infer<typeof HeartbeatSchema>,
) {
  const serverNow = new Date().toISOString();

  console.log("[Heartbeat] Processing heartbeat at", serverNow);

  const heartbeatValue = {
    timestamp: serverNow,
    client_timestamp: payload.timestamp,
    machine: payload.machine_id,
  };

  await replicatedMutation("variables", "upsert", {
    key: "lastHeartbeatAt",
    value: heartbeatValue,
  });

  // Asynchronously cleanup "test session"s older than 30 minutes
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  replicatedMutation("studySessions", "deleteTestSessions", {
    olderThan: thirtyMinutesAgo,
  }).catch((err) => {
    console.error("[Cleanup] Test session cleanup failed:", err);
  });
}

/**
 * Processes a missed heartbeat event and logs it to the audit history.
 */
export async function processMissedHeartbeat(
  payload: z.infer<typeof MissedHeartbeatSchema>
) {
  const convex = getLocalClient();
  
  const logData = {
    type: "missed_heartbeat" as const,
    message: `ALERT: Missed heartbeat. Last contact: ${Math.floor(payload.gap_seconds)}s ago.`,
    metadata: {
      last_seen: payload.last_seen,
      gap_minutes: payload.gap_seconds / 60,
      acknowledged: false,
    },
    session: payload.session_id,
  };

  await convex.mutation(asPublic(internal.logs.create), logData);
  await replicateToCloud("logs", "create", { ...logData, session: undefined });
  console.log("[Heartbeat] Missed heartbeat derivation processed.");
}
