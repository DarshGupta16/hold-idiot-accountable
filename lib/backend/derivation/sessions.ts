import { getLocalClient, getCloudClient } from "@/lib/backend/convex";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { replicateToCloud, replicatedMutation } from "@/lib/backend/sync";
import {
  SessionStartSchema,
  SessionStopSchema,
  EventType,
} from "@/lib/backend/types";
import { z } from "zod";
import {
  ensureActiveSession,
  ensureNoActiveSession,
  ensureNoActiveBreak,
} from "@/lib/backend/invariants";
import { formatDuration } from "@/lib/utils";
import {
  Log,
  SessionStatus,
  TimelineEvent,
  TimelineEventType,
} from "@/lib/backend/schema";

export async function processSessionStart(
  payload: z.infer<typeof SessionStartSchema>,
  options?: { isFromBreak?: boolean }
) {
  await ensureNoActiveSession();
  if (!options?.isFromBreak) {
    await ensureNoActiveBreak();
  }
  
  const serverNow = new Date().toISOString();

  const sessionData = {
    started_at: serverNow,
    planned_duration_sec: payload.planned_duration_sec,
    subject: payload.subject,
    status: "active" as const,
  };

  const sessionId = (await replicatedMutation(
    "studySessions",
    "create",
    sessionData,
  )) as Id<"studySessions">;

  // Store the blocklist in variables
  const blocklistData = {
    key: "blocklist",
    value: payload.blocklist || [],
  };
  await replicatedMutation("variables", "upsert", blocklistData);

  const logData = {
    type: "session_start" as const,
    message: `Session started: ${payload.subject} for ${formatDuration(payload.planned_duration_sec)}`,
    metadata: {
      ...payload,
      triggered_by: options?.isFromBreak ? "break_end" : "client_request"
    },
    session: sessionId,
  };
  
  // Local log with sessionId
  const local = getLocalClient();
  await local.mutation(api.logs.create, logData);

  // Replicate log to cloud (without ID to avoid mismatch)
  replicateToCloud("logs", "create", { ...logData, session: undefined }).catch((err) => {
    console.error("[Sync] Background log replication failed:", err);
  });
}

export async function processSessionStop(
  payload: z.infer<typeof SessionStopSchema>,
) {
  const session = await ensureActiveSession();
  const convex = getLocalClient();
  const serverNow = new Date();
  const startTime = new Date(session.started_at);
  const elapsedSeconds = (serverNow.getTime() - startTime.getTime()) / 1000;

  // Derivation: Session is completed if elapsed time >= planned duration (minus 60s tolerance).
  const isCompleted = elapsedSeconds >= session.planned_duration_sec - 60;

  const newStatus: SessionStatus = isCompleted ? "completed" : "aborted";
  const note = payload.reason ? `Client reason: ${payload.reason}` : undefined;

  // Create the session_end log first
  const logData = {
    type: "session_end" as const,
    message: `Session ${newStatus}. Ran for ${formatDuration(Math.floor(elapsedSeconds))} (Planned: ${formatDuration(session.planned_duration_sec)})`,
    metadata: {
      ...payload,
      actual_duration: elapsedSeconds,
      derivation: "server-side",
    },
    session: session._id,
  };
  
  await convex.mutation(api.logs.create, logData);
  replicateToCloud("logs", "create", { ...logData, session: undefined }).catch((err) => {
    console.error("[Sync] Background log replication failed:", err);
  });

  // Build timeline from logs for this session
  const logs = await convex.query(api.logs.getBySessionAsc, {
    sessionId: session._id,
  });

  const timeline: TimelineEvent[] = logs.map((log: Log) => {
    let type: TimelineEventType = "INFO";
    if (log.type === "session_start") type = "START";
    if (log.type === "session_end") type = "END";
    if (log.type === "breach") type = "BREACH";
    if (log.type === "warn") type = "WARNING";

    const logDate = new Date(log._creationTime);
    return {
      id: log._id,
      time: logDate.toISOString(),
      type,
      description: log.message,
    };
  });

  // Generate AI Summary
  let summaryText: string | undefined;
  try {
    const { generateSessionSummary } = await import("../ai");

    const aiResult = await generateSessionSummary(logs, {
      subject: session.subject,
      status: newStatus,
      plannedDuration: session.planned_duration_sec,
      actualDuration: elapsedSeconds,
      reason: payload.reason,
    });

    summaryText = aiResult.summary_text;

    // Also update summary variable for home page reflection display
    const serverNowStr = new Date().toISOString();
    const variablePayload = {
      ...aiResult,
      generated_at: serverNowStr,
      session_id: session._id,
    };

    await replicatedMutation("variables", "upsert", {
      key: "summary",
      value: variablePayload,
    });
  } catch (e) {
    console.error("Failed to generate summary in backend:", e);
  }

  // Update session with end time, status, timeline, and summary
  const sessionUpdate: Record<string, unknown> = {
    ended_at: serverNow.toISOString(),
    status: newStatus,
    timeline,
    summary: summaryText,
  };
  if (note) sessionUpdate.end_note = note;

  await convex.mutation(api.studySessions.update, {
    id: session._id,
    updates: sessionUpdate,
  });

  // Replicate session update to cloud by finding the active session there
  try {
    const cloud = getCloudClient();
    if (cloud) {
      const cloudSession = await cloud.query(api.studySessions.getActive);
      if (cloudSession) {
        await cloud.mutation(api.studySessions.update, {
          id: cloudSession._id,
          updates: sessionUpdate,
        });
        console.log("[Sync] Replicated session update to cloud.");
      }
    }
  } catch (e) {
    console.error("[Sync] Failed to replicate session update to cloud:", e);
  }
}
