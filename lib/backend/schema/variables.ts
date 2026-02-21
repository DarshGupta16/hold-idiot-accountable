/**
 * Variables Schema Types
 *
 * Types for the Convex `variables` table (key-value store).
 */

// ============================================================================
// VARIABLE RECORD (Generic)
// ============================================================================

export interface Variable<T = any> {
  /** Convex document ID */
  _id: string;

  /** API-mapped ID for frontend (same as _id) */
  id?: string;

  /** Unique key identifier */
  key: string;

  /** JSON value (type depends on key) */
  value: T;

  /** Auto-generated on create (numeric millisecond timestamp) */
  _creationTime: number;

  /** API-mapped ISO timestamp for frontend */
  created_at?: string;
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

/** Value structure for the "blocklist" variable */
export type BlocklistValue = string[];

// ============================================================================
// CONVENIENCE TYPE ALIASES
// ============================================================================

export type HeartbeatVariable = Variable<HeartbeatValue>;
export type SummaryVariable = Variable<SummaryValue>;
export type BlocklistVariable = Variable<BlocklistValue>;
