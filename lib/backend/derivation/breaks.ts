import { getLocalClient } from "@/lib/backend/convex";
import { api } from "@/convex/_generated/api";
import { replicateToCloud, replicatedMutation } from "@/lib/backend/sync";
import {
  BreakStartSchema,
  BreakStopSchema,
  BreakSkipSchema,
  EventType,
} from "@/lib/backend/types";
import { z } from "zod";
import {
  ensureNoActiveSession,
  ensureNoActiveBreak,
} from "@/lib/backend/invariants";
import { formatDuration } from "@/lib/utils";
import { BreakValue } from "@/lib/backend/schema";
import { processSessionStart } from "./sessions";

export async function processBreakStart(
  payload: z.infer<typeof BreakStartSchema>,
) {
  await ensureNoActiveSession();
  await ensureNoActiveBreak();

  const serverNow = new Date().toISOString();

  const breakData: BreakValue = {
    started_at: serverNow,
    duration_sec: payload.duration_sec,
    next_session: payload.next_session,
  };

  await replicatedMutation("variables", "upsert", {
    key: "break",
    value: breakData,
  });

  const logData = {
    type: "break_start" as const,
    message: `Break started: ${formatDuration(payload.duration_sec)}. Next session: ${payload.next_session.subject}`,
    metadata: payload,
  };

  const local = getLocalClient();
  await local.mutation(api.logs.create, logData);
  replicateToCloud("logs", "create", logData).catch((err) => {
    console.error("[Sync] Background log replication failed:", err);
  });
}

export async function processBreakStop(
  payload: z.infer<typeof BreakStopSchema>,
) {
  const convex = getLocalClient();
  const breakVar = await convex.query(api.variables.getByKey, { key: "break" });
  if (!breakVar) {
    throw new Error("Invariant Violation: No active break found to stop.");
  }

  const breakVal = breakVar.value as BreakValue;
  const serverNow = new Date();
  const startTime = new Date(breakVal.started_at);
  const elapsedSeconds = (serverNow.getTime() - startTime.getTime()) / 1000;

  // Determination: If stopped manually (payload has reason) vs automatically
  const isAutomatic = !payload.reason && elapsedSeconds >= breakVal.duration_sec - 5;
  const reason = payload.reason || (isAutomatic ? "The break ended." : "No reason was provided.");

  const logData = {
    type: "break_end" as const,
    message: `Break ended. Reason: ${reason}`,
    metadata: {
      ...payload,
      reason,
      actual_duration: elapsedSeconds,
      was_automatic: isAutomatic,
    },
  };

  await convex.mutation(api.logs.create, logData);
  replicateToCloud("logs", "create", logData).catch((err) => {
    console.error("[Sync] Background log replication failed:", err);
  });

  // Transition to next session ONLY if automatic
  if (isAutomatic) {
    await processSessionStart({
      event_type: EventType.SESSION_START,
      timestamp: serverNow.toISOString(),
      ...breakVal.next_session,
    }, { isFromBreak: true });
  }

  // If premature (not automatic), update summary to show the reason
  if (!isAutomatic) {
    const summaryPayload = {
      summary_text: `The previous break was stopped prematurely. Reason: ${reason}`,
      status_label: "MIXED" as const,
      generated_at: serverNow.toISOString(),
      session_id: "break-system", // Marker
      subject: breakVal.next_session.subject,
    };

    await replicatedMutation("variables", "upsert", {
      key: "summary",
      value: summaryPayload,
    });
  }

  // Cleanup break variable
  await replicatedMutation("variables", "remove", { key: "break" });
}

export async function processBreakSkip(
  payload: z.infer<typeof BreakSkipSchema>,
) {
  const convex = getLocalClient();
  const breakVar = await convex.query(api.variables.getByKey, { key: "break" });
  if (!breakVar) {
    throw new Error("Invariant Violation: No active break found to skip.");
  }

  const breakVal = breakVar.value as BreakValue;
  const serverNow = new Date();

  const logData = {
    type: "break_skip" as const,
    message: `Break skipped. Starting next session: ${breakVal.next_session.subject}`,
    metadata: {
      ...payload,
    },
  };

  await convex.mutation(api.logs.create, logData);
  replicateToCloud("logs", "create", logData).catch((err) => {
    console.error("[Sync] Background log replication failed:", err);
  });

  // Transition to next session immediately
  await processSessionStart({
    event_type: EventType.SESSION_START,
    timestamp: serverNow.toISOString(),
    ...breakVal.next_session,
  }, { isFromBreak: true });

  // Cleanup break variable
  await replicatedMutation("variables", "remove", { key: "break" });
}
