/**
 * Variables Schema Types
 *
 * Types for the PocketBase `variables` collection (key-value store).
 * @see pb_migrations/1769877396_created_variables.js
 */

// ============================================================================
// VARIABLE RECORD (Generic)
// ============================================================================

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

// ============================================================================
// CONVENIENCE TYPE ALIASES
// ============================================================================

export type HeartbeatVariable = Variable<HeartbeatValue>;
export type SummaryVariable = Variable<SummaryValue>;
