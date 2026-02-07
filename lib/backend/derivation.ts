import { getAuthenticatedPocketBase } from "./pocketbase";
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
  SummaryVariable,
  HeartbeatVariable,
} from "@/lib/backend/schema";

export async function processHeartbeat(
  payload: z.infer<typeof HeartbeatSchema>,
) {
  const pb = await getAuthenticatedPocketBase();
  const serverNow = new Date().toISOString();

  console.log("[Heartbeat] Processing heartbeat at", serverNow);

  const heartbeatValue = {
    timestamp: serverNow,
    client_timestamp: payload.timestamp,
    machine: payload.machine_id,
  };

  // Use proper upsert pattern: Try to find existing, then update or create
  try {
    const existing = await pb
      .collection<HeartbeatVariable>("variables")
      .getFirstListItem('key = "lastHeartbeatAt"');

    console.log("[Heartbeat] Found existing record:", existing.id);

    await pb.collection<HeartbeatVariable>("variables").update(existing.id, {
      value: heartbeatValue,
    });
    console.log("[Heartbeat] Updated existing record successfully");
  } catch {
    // Record doesn't exist, create it
    console.log("[Heartbeat] No existing record, creating new one");
    try {
      await pb.collection<HeartbeatVariable>("variables").create({
        key: "lastHeartbeatAt",
        value: heartbeatValue,
      });
      console.log("[Heartbeat] Created new record successfully");
    } catch (createError) {
      console.error("[Heartbeat] Failed to create record:", createError);
      throw createError;
    }
  }
}

export async function processSessionStart(
  payload: z.infer<typeof SessionStartSchema>,
) {
  await ensureNoActiveSession();
  const pb = await getAuthenticatedPocketBase();
  const serverNow = new Date().toISOString();

  const session = await pb.collection<StudySession>("study_sessions").create({
    started_at: serverNow,
    planned_duration_sec: payload.planned_duration_sec,
    subject: payload.subject,
    status: "active",
  });

  await pb.collection<Log>("logs").create({
    type: EventType.SESSION_START.toLowerCase(),
    message: `Session started: ${payload.subject} for ${formatDuration(payload.planned_duration_sec)}`,
    metadata: payload,
    session: session.id,
  });
}

export async function processSessionStop(
  payload: z.infer<typeof SessionStopSchema>,
) {
  const session = await ensureActiveSession();
  const pb = await getAuthenticatedPocketBase();
  const serverNow = new Date();
  const startTime = new Date(session.started_at);
  const elapsedSeconds = (serverNow.getTime() - startTime.getTime()) / 1000;

  // Derivation: Session is completed if elapsed time >= planned duration (minus 60s tolerance).
  const isCompleted = elapsedSeconds >= session.planned_duration_sec - 60;

  const newStatus: SessionStatus = isCompleted ? "completed" : "aborted";
  const note = payload.reason ? `Client reason: ${payload.reason}` : undefined;

  await pb.collection<StudySession>("study_sessions").update(session.id, {
    ended_at: serverNow.toISOString(),
    status: newStatus,
    end_note: note,
  });

  await pb.collection<Log>("logs").create({
    type: "session_end",
    message: `Session ${newStatus}. Ran for ${formatDuration(Math.floor(elapsedSeconds))} (Planned: ${formatDuration(session.planned_duration_sec)})`,
    metadata: {
      ...payload,
      actual_duration: elapsedSeconds,
      derivation: "server-side",
    },
    session: session.id,
  });

  // Generate AI Summary immediately
  try {
    const { generateSessionSummary } = await import("./ai");

    // Fetch all logs for context
    const logs = await pb.collection<Log>("logs").getFullList({
      filter: `session = "${session.id}"`,
      sort: "created_at",
    });

    const aiResult = await generateSessionSummary(logs, {
      subject: session.subject,
      status: newStatus,
      plannedDuration: session.planned_duration_sec,
      actualDuration: elapsedSeconds,
    });

    // Upsert summary variable
    const serverNowStr = new Date().toISOString();
    const variablePayload = {
      ...aiResult,
      generated_at: serverNowStr,
      session_id: session.id,
    };

    try {
      const existing = await pb
        .collection<SummaryVariable>("variables")
        .getFirstListItem('key="summary"');
      await pb
        .collection<SummaryVariable>("variables")
        .update(existing.id, { value: variablePayload });
    } catch {
      await pb
        .collection<SummaryVariable>("variables")
        .create({ key: "summary", value: variablePayload });
    }
  } catch (e) {
    console.error("Failed to generate summary in backend:", e);
  }
}

export async function processBlocklistEvent(
  payload: z.infer<typeof BlocklistEventSchema>,
) {
  // Logs violations/warnings. Allowed even outside active sessions to capture all client-reported distractions.
  const activeSession = await getActiveSession();
  const pb = await getAuthenticatedPocketBase();

  const logType =
    payload.type === BlocklistEventType.VIOLATION ? "breach" : "warn";

  await pb.collection<Log>("logs").create({
    type: logType,
    message: `${logType.toUpperCase()}: Detected ${payload.process_name || "process"} - ${payload.window_title || "unknown"}`,
    metadata: payload,
    session: activeSession ? activeSession.id : null,
  });
}
