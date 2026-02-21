/**
 * Study Sessions Schema Types
 *
 * Types for the Convex `studySessions` table.
 */

// ============================================================================
// SESSION STATUS
// ============================================================================

export type SessionStatus = "active" | "completed" | "aborted";

// ============================================================================
// TIMELINE EVENTS (Stored as JSON in session)
// ============================================================================

export type TimelineEventType = "START" | "END" | "BREACH" | "WARNING" | "INFO";

export interface TimelineEvent {
  /** Original log ID */
  id: string;

  /** Formatted time string (e.g., "10:30 AM") */
  time: string;

  /** Event type for visual styling */
  type: TimelineEventType;

  /** Event description (log message) */
  description: string;
}

// ============================================================================
// STUDY SESSION RECORD
// ============================================================================

export interface StudySession {
  /** Convex document ID */
  _id: string;

  /** API-mapped ID for frontend (same as _id) */
  id?: string;

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

  /** Timeline events for this session (JSON array) */
  timeline?: TimelineEvent[];

  /** AI-generated summary of the session */
  summary?: string;

  /** Auto-generated on create (numeric millisecond timestamp) */
  _creationTime: number;

  /** API-mapped ISO timestamp for frontend */
  created_at?: string;
}
