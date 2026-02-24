import { z } from "zod";

// Re-export Convex schema types from centralized schema file
export type {
  StudySession,
  Log,
  Variable,
  SessionStatus as SessionStatusType,
  LogType,
  HeartbeatValue,
  SummaryValue,
} from "./schema";

// Backward compatibility aliases
export type { StudySession as StudySessionRecord } from "./schema";
export type { Log as LogRecord } from "./schema";
export type { Variable as VariableRecord } from "./schema";

// --- Event Enums (for webhook processing) ---

export enum EventType {
  HEARTBEAT = "HEARTBEAT",
  SESSION_START = "SESSION_START",
  SESSION_STOP = "SESSION_STOP",
  BREAK_START = "BREAK_START",
  BREAK_STOP = "BREAK_STOP",
  BLOCKLIST_EVENT = "BLOCKLIST_EVENT",
}

export enum BlocklistEventType {
  VIOLATION = "violation", // Actual breach
  WARNING = "warning", // Warning triggered
}

export enum SessionStatus {
  ACTIVE = "active",
  COMPLETED = "completed",
  ABORTED = "aborted",
}

// --- Webhook Payloads ---

export const HeartbeatSchema = z.object({
  event_type: z.literal(EventType.HEARTBEAT),
  timestamp: z.string().datetime(), // Client claims time, but we might override
  machine_id: z.string().min(1),
});

export const SessionStartSchema = z.object({
  event_type: z.literal(EventType.SESSION_START),
  timestamp: z.string().datetime(),
  subject: z.string().min(1),
  planned_duration_sec: z.number().positive(),
  blocklist: z.array(z.string()).default([]),
});

export const SessionStopSchema = z.object({
  event_type: z.literal(EventType.SESSION_STOP),
  timestamp: z.string().datetime(),
  reason: z.string().optional(),
});

export const BreakStartSchema = z.object({
  event_type: z.literal(EventType.BREAK_START),
  timestamp: z.string().datetime(),
  duration_sec: z.number().positive(),
  next_session: z.object({
    subject: z.string().min(1),
    planned_duration_sec: z.number().positive(),
    blocklist: z.array(z.string()).default([]),
  }),
});

export const BreakStopSchema = z.object({
  event_type: z.literal(EventType.BREAK_STOP),
  timestamp: z.string().datetime(),
  reason: z.string().optional(),
});

export const BlocklistEventSchema = z.object({
  event_type: z.literal(EventType.BLOCKLIST_EVENT),
  timestamp: z.string().datetime(),
  type: z.nativeEnum(BlocklistEventType),
  removed_sites: z.array(z.string()).default([]),
});

// Union of all possible incoming webhook events
export const WebhookEventSchema = z.union([
  HeartbeatSchema,
  SessionStartSchema,
  SessionStopSchema,
  BreakStartSchema,
  BreakStopSchema,
  BlocklistEventSchema,
]);

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
