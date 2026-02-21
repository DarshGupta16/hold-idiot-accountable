/**
 * Logs Schema Types
 *
 * Types for the Convex `logs` table.
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
  /** Convex document ID */
  _id: string;

  /** API-mapped ID for frontend (same as _id) */
  id?: string;

  /** Type of log event */
  type: LogType;

  /** Human-readable message */
  message: string;

  /** Optional JSON metadata */
  metadata?: Record<string, any>;

  /** Relation to studySessions table (optional) */
  session?: string;

  /** Auto-generated on create (numeric millisecond timestamp) */
  _creationTime: number;

  /** API-mapped ISO timestamp for frontend */
  created_at?: string;
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
