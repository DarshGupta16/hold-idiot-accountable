import { z } from "zod";

// --- Event Enums ---

export enum EventType {
  HEARTBEAT = "HEARTBEAT",
  SESSION_START = "SESSION_START",
  SESSION_STOP = "SESSION_STOP",
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
});

export const SessionStopSchema = z.object({
  event_type: z.literal(EventType.SESSION_STOP),
  timestamp: z.string().datetime(),
  reason: z.string().optional(),
});

export const BlocklistEventSchema = z.object({
  event_type: z.literal(EventType.BLOCKLIST_EVENT),
  timestamp: z.string().datetime(),
  type: z.nativeEnum(BlocklistEventType),
  process_name: z.string().optional(),
  window_title: z.string().optional(),
});

// Union of all possible incoming webhook events
export const WebhookEventSchema = z.union([
  HeartbeatSchema,
  SessionStartSchema,
  SessionStopSchema,
  BlocklistEventSchema,
]);

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

// --- Database Schemas (PocketBase) ---

export interface StudySessionRecord {
  id: string;
  created: string;
  updated: string;
  started_at: string;
  ended_at?: string;
  planned_duration_sec: number;
  subject: string;
  status: SessionStatus;
  end_note?: string;
}

export interface LogRecord {
  id: string;
  created: string;
  type: string;
  message: string;
  metadata?: any;
  session?: string; // Relation ID
}

export interface VariableRecord {
  key: string;
  value: any;
}
