/**
 * PocketBase Schema Types
 *
 * These types are derived from the PocketBase migrations in /pb_migrations.
 * They represent the EXACT structure of the database collections.
 *
 * IMPORTANT: All collections use `created_at` and `updated_at` (NOT `created`/`updated`).
 */

// ============================================================================
// STUDY SESSIONS COLLECTION
// ============================================================================

export type SessionStatus = "active" | "completed" | "aborted";

/**
 * Study session record from PocketBase `study_sessions` collection.
 * @see pb_migrations/1769877159_created_study_sessions.js
 */
export interface StudySession {
  /** Auto-generated 15-char ID */
  id: string;

  /** When the session started (ISO date string) */
  started_at: string;

  /** When the session ended (ISO date string), null if still active */
  ended_at?: string;

  /** Planned duration in seconds */
  planned_duration_sec: number;

  /** Subject/topic of the session */
  subject: string;

  /** Current status of the session */
  status: SessionStatus;

  /** Optional note added when session ends */
  end_note?: string;

  /** Auto-generated on create (ISO date string) */
  created_at: string;

  /** Auto-updated on each update (ISO date string) */
  updated_at: string;
}

// ============================================================================
// LOGS COLLECTION
// ============================================================================

export type LogType =
  | "session_start"
  | "session_end"
  | "blocklist_change"
  | "warn"
  | "breach"
  | "missed_heartbeat";

/**
 * Log record from PocketBase `logs` collection.
 * @see pb_migrations/1769877328_created_logs.js
 */
export interface Log {
  /** Auto-generated 15-char ID */
  id: string;

  /** Type of log event */
  type: LogType;

  /** Human-readable message */
  message: string;

  /** Optional JSON metadata */
  metadata?: Record<string, unknown>;

  /** Relation to study_sessions collection (optional) */
  session?: string;

  /** Auto-generated on create (ISO date string) */
  created_at: string;
}

// ============================================================================
// VARIABLES COLLECTION (Key-Value Store)
// ============================================================================

/**
 * Variable record from PocketBase `variables` collection.
 * Used for ephemeral state like heartbeats and summaries.
 * @see pb_migrations/1769877396_created_variables.js
 */
export interface Variable<T = unknown> {
  /** Auto-generated 15-char ID */
  id: string;

  /** Unique key identifier */
  key: string;

  /** JSON value (type depends on key) */
  value: T;

  /** Auto-updated on create and update (ISO date string) */
  updated_at: string;
}

// ============================================================================
// TYPED VARIABLE VALUES
// ============================================================================

/** Value structure for the "lastHeartbeatAt" variable */
export interface HeartbeatValue {
  timestamp: string;
  client_timestamp: string;
  machine: string;
}

/** Value structure for the "summary" variable */
export interface SummaryValue {
  summary_text: string;
  status_label: "FOCUSED" | "DISTRACTED" | "MIXED";
  generated_at: string;
  session_id: string;
  subject?: string;
}

// Convenience type aliases
export type HeartbeatVariable = Variable<HeartbeatValue>;
export type SummaryVariable = Variable<SummaryValue>;
