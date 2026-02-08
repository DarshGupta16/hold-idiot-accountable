/**
 * Logs Schema Types
 *
 * Types for the PocketBase `logs` collection.
 * @see pb_migrations/1769877328_created_logs.js
 */

// ============================================================================
// LOG TYPES
// ============================================================================

export type LogType =
  | "session_start"
  | "session_end"
  | "blocklist_change"
  | "warn"
  | "breach"
  | "missed_heartbeat";

// ============================================================================
// LOG RECORD
// ============================================================================

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
// LOG METADATA TYPES
// ============================================================================

/**
 * Standard metadata for missed_heartbeat log entries.
 * IMPORTANT: This is the canonical format - do not deviate from it.
 */
export interface MissedHeartbeatMetadata {
  /** ISO timestamp of the last received heartbeat */
  last_seen: string;

  /** Gap in minutes since last heartbeat */
  gap_minutes: number;

  /** Whether the user has acknowledged this missed heartbeat */
  acknowledged: boolean;
}
