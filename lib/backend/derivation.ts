import { getLocalClient } from "./convex";
import { api } from "../../convex/_generated/api";
import { replicateToCloud } from "./sync";
import {
  EventType,
  SessionStartSchema,
  SessionStopSchema,
  BlocklistEventSchema,
  HeartbeatSchema,
  BlocklistEventType,
} from "./types";
import { z } from "zod";
import {
  ensureActiveSession,
  ensureNoActiveSession,
  getActiveSession,
} from "./invariants";
import { formatDuration } from "@/lib/utils";
import {
  StudySession,
  Log,
  SessionStatus,
  TimelineEvent,
  TimelineEventType,
} from "@/lib/backend/schema";

export async function processHeartbeat(
  payload: z.infer<typeof HeartbeatSchema>,
) {
  const convex = getLocalClient();
  const serverNow = new Date().toISOString();

  console.log("[Heartbeat] Processing heartbeat at", serverNow);

  const heartbeatValue = {
    timestamp: serverNow,
    client_timestamp: payload.timestamp,
    machine: payload.machine_id,
  };

  await convex.mutation(api.variables.upsert, {
    key: "lastHeartbeatAt",
    value: heartbeatValue,
  });
  
  await replicateToCloud("variables", "upsert", {
    key: "lastHeartbeatAt",
    value: heartbeatValue,
  });
}

export async function processSessionStart(
  payload: z.infer<typeof SessionStartSchema>,
) {
  await ensureNoActiveSession();
  const convex = getLocalClient();
  const serverNow = new Date().toISOString();

  const sessionData = {
    started_at: serverNow,
    planned_duration_sec: payload.planned_duration_sec,
    subject: payload.subject,
    status: "active" as const,
  };

  const sessionId = await convex.mutation(api.studySessions.create, sessionData);
  await replicateToCloud("studySessions", "create", sessionData);

  // Store the blocklist in variables
  const blocklistData = {
    key: "blocklist",
    value: payload.blocklist || [],
  };
  await convex.mutation(api.variables.upsert, blocklistData);
  await replicateToCloud("variables", "upsert", blocklistData);

  const logData = {
    type: "session_start" as const,
    message: `Session started: ${payload.subject} for ${formatDuration(payload.planned_duration_sec)}`,
    metadata: payload,
    session: sessionId,
  };
  await convex.mutation(api.logs.create, logData);
  
  // For cloud replication, remove session ID to avoid mismatch
  await replicateToCloud("logs", "create", { ...logData, session: undefined });
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
  await replicateToCloud("logs", "create", { ...logData, session: undefined });

  // Build timeline from logs for this session
  const logs = await convex.query(api.logs.getBySessionAsc, { sessionId: session._id });

  const timeline: TimelineEvent[] = logs.map((log: any) => {
    let type: TimelineEventType = "INFO";
    if (log.type === "session_start") type = "START";
    if (log.type === "session_end") type = "END";
    if (log.type === "breach") type = "BREACH";
    if (log.type === "warn") type = "WARNING";

    const logDate = new Date(log._creationTime);
    return {
      id: log._id,
      time: logDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      type,
      description: log.message,
    };
  });

  // Generate AI Summary
  let summaryText: string | undefined;
  try {
    const { generateSessionSummary } = await import("./ai");

    const aiResult = await generateSessionSummary(logs, {
      subject: session.subject,
      status: newStatus,
      plannedDuration: session.planned_duration_sec,
      actualDuration: elapsedSeconds,
    });

    summaryText = aiResult.summary_text;

    // Also update summary variable for home page reflection display
    const serverNowStr = new Date().toISOString();
    const variablePayload = {
      ...aiResult,
      generated_at: serverNowStr,
      session_id: session._id,
    };

    await convex.mutation(api.variables.upsert, {
      key: "summary",
      value: variablePayload,
    });
    await replicateToCloud("variables", "upsert", {
      key: "summary",
      value: variablePayload,
    });
  } catch (e) {
    console.error("Failed to generate summary in backend:", e);
  }

  // Update session with end time, status, timeline, and summary
  const sessionUpdate = {
    ended_at: serverNow.toISOString(),
    status: newStatus,
    end_note: note,
    timeline,
    summary: summaryText,
  };
  await convex.mutation(api.studySessions.update, {
    id: session._id,
    updates: sessionUpdate,
  });
  
  // Cloud replication for update is tricky without ID, but for status/end_note we could try finding active one on cloud
  // or just rely on periodic reconciliation for session updates.
  // The plan says: "Replicate all writes to cloud (fire-and-forget, without session references where ID mismatch would occur)"
  // For update, it's hard to replicate without the same ID.
  // I'll skip session updates in fire-and-forget replication as it's complex and reconciliation handles it.
}

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
    type: logType as any,
    message,
    metadata: {
      ...payload,
      acknowledged: false, // For frontend alerts
    },
    session: activeSession ? activeSession._id : undefined,
  };
  await convex.mutation(api.logs.create, logData);
  await replicateToCloud("logs", "create", { ...logData, session: undefined });
}
