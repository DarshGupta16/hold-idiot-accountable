import { getLocalClient } from "@/lib/backend/convex";
import { api } from "@/convex/_generated/api";
import { replicateToCloud } from "@/lib/backend/sync";
import {
  BlocklistEventSchema,
  BlocklistEventType,
} from "@/lib/backend/types";
import { z } from "zod";
import { getActiveSession } from "@/lib/backend/invariants";
import { LogType } from "@/lib/backend/schema";

export async function processBlocklistEvent(
  payload: z.infer<typeof BlocklistEventSchema>,
) {
  const activeSession = await getActiveSession();
  const convex = getLocalClient();

  const logType =
    payload.type === BlocklistEventType.VIOLATION ? "breach" : "warn";

  const removedSites = payload.removed_sites || [];
  const message =
    removedSites.length > 0
      ? `${logType.toUpperCase()}: Blocklist tampered. Removed: ${removedSites.join(", ")}`
      : `${logType.toUpperCase()}: Blocklist event detected.`;

  const logData = {
    type: logType as LogType,
    message,
    metadata: {
      ...payload,
      acknowledged: false, // For frontend alerts
    },
    session: activeSession ? activeSession._id : undefined,
  };
  
  await convex.mutation(api.logs.create, logData);
  replicateToCloud("logs", "create", { ...logData, session: undefined }).catch((err) => {
    console.error("[Sync] Background log replication failed:", err);
  });
}
