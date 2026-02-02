import { getAuthenticatedPocketBase } from "./pocketbase";
import {
  EventType,
  SessionStartSchema,
  SessionStopSchema,
  BlocklistEventSchema,
  HeartbeatSchema,
  SessionStatus,
  BlocklistEventType,
} from "./types";
import { z } from "zod";
import {
  ensureActiveSession,
  ensureNoActiveSession,
  getActiveSession,
} from "./invariants";

export async function processHeartbeat(
  payload: z.infer<typeof HeartbeatSchema>,
) {
  const pb = await getAuthenticatedPocketBase();
  const serverNow = new Date().toISOString();

  // Update ephemeral state. We prefer server-time for the record's timestamp.
  try {
    await pb.collection("variables").create(
      {
        key: "lastHeartbeatAt",
        value: {
          timestamp: serverNow,
          client_timestamp: payload.timestamp,
          machine: payload.machine_id,
        },
      },
      { requestKey: null },
    );
  } catch {
    // Fallback: If creation fails (e.g. key exists), update the existing record.
    try {
      const existing = await pb
        .collection("variables")
        .getFirstListItem('key="lastHeartbeatAt"');

      await pb.collection("variables").update(existing.id, {
        value: {
          timestamp: serverNow,
          client_timestamp: payload.timestamp,
          machine: payload.machine_id,
        },
      });
    } catch {
      // Final attempt to create if it mysteriously disappeared (Race condition safety)
      await pb.collection("variables").create({
        key: "lastHeartbeatAt",
        value: {
          timestamp: serverNow,
          client_timestamp: payload.timestamp,
          machine: payload.machine_id,
        },
      });
    }
  }
}

export async function processSessionStart(
  payload: z.infer<typeof SessionStartSchema>,
) {
  await ensureNoActiveSession();
  const pb = await getAuthenticatedPocketBase();
  const serverNow = new Date().toISOString();

  const session = await pb.collection("study_sessions").create({
    started_at: serverNow,
    planned_duration_sec: payload.planned_duration_sec,
    subject: payload.subject,
    status: SessionStatus.ACTIVE,
  });

  await pb.collection("logs").create({
    type: EventType.SESSION_START.toLowerCase(),
    message: `Session started: ${payload.subject} for ${payload.planned_duration_sec}s`,
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

  const newStatus = isCompleted
    ? SessionStatus.COMPLETED
    : SessionStatus.ABORTED;
  const note = payload.reason ? `Client reason: ${payload.reason}` : undefined;

  await pb.collection("study_sessions").update(session.id, {
    ended_at: serverNow.toISOString(),
    status: newStatus,
    end_note: note,
  });

  await pb.collection("logs").create({
    type: "session_end",
    message: `Session ${newStatus}. Ran for ${Math.floor(elapsedSeconds)}s (Planned: ${session.planned_duration_sec}s)`,
    metadata: {
      ...payload,
      actual_duration: elapsedSeconds,
      derivation: "server-side",
    },
    session: session.id,
  });
}

export async function processBlocklistEvent(
  payload: z.infer<typeof BlocklistEventSchema>,
) {
  // Logs violations/warnings. Allowed even outside active sessions to capture all client-reported distractions.
  const activeSession = await getActiveSession();
  const pb = await getAuthenticatedPocketBase();

  const logType =
    payload.type === BlocklistEventType.VIOLATION ? "breach" : "warn";

  await pb.collection("logs").create({
    type: logType,
    message: `${logType.toUpperCase()}: Detected ${payload.process_name || "process"} - ${payload.window_title || "unknown"}`,
    metadata: payload,
    session: activeSession ? activeSession.id : null,
  });
}
