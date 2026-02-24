import { replicatedMutation } from "@/lib/backend/sync";
import { HeartbeatSchema } from "@/lib/backend/types";
import { z } from "zod";

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
