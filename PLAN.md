# Implementation Plan: Break Feature

This plan outlines the implementation of a "Break" feature that allows users to take a timed break between (or before) study sessions. A study session is automatically started once the break ends.

## 1. Schema & Type Updates

### 1.1 Log Types (`convex/schema.ts` & `lib/backend/schema/logs.ts`)
- Update the `type` union in the `logs` table to include:
  - `break_start`
  - `break_end`

### 1.2 Webhook Event Types (`lib/backend/types.ts`)
- Add `BREAK_START` and `BREAK_STOP` to `EventType` enum.
- Define `BreakStartSchema`:
  ```typescript
  {
    event_type: "BREAK_START",
    timestamp: string (ISO),
    duration_sec: number,
    next_session: {
      subject: string,
      planned_duration_sec: number,
      blocklist: string[]
    }
  }
  ```
- Define `BreakStopSchema`:
  ```typescript
  {
    event_type: "BREAK_STOP",
    timestamp: string (ISO),
    reason: string (optional)
  }
  ```

### 1.3 Variables (`lib/backend/schema/variables.ts`)
- Define `BreakValue` structure for the `break` variable:
  ```typescript
  export interface BreakValue {
    started_at: string;
    duration_sec: number;
    next_session: {
      subject: string;
      planned_duration_sec: number;
      blocklist: string[];
    };
    scheduled_job_id?: string;
  }
  ```

## 2. Backend Logic (`lib/backend/derivation.ts`)

### 2.1 `processBreakStart`
- **Invariants**: Ensure no active session and no active break.
- **Logging**: Create a `break_start` log.
- **State**: Upsert the `break` variable with duration and next session info.
- **Scheduling**: Schedule an automatic `BREAK_STOP` event using Convex scheduler (if available/applicable) or rely on a `variables` based check for "manual" vs "automatic".
- **Replication**: Ensure logs and variables are replicated to cloud.

### 2.2 `processBreakStop`
- **Invariants**: Ensure an active break exists.
- **Logic**:
  - Determine if the stop is "on time" or "premature" based on elapsed time vs. planned duration.
  - If a `reason` is provided in the payload (manual stop), use it.
  - If no reason is provided for a manual stop, default to "no reason provided".
  - If triggered automatically (on time), reason is "break ended".
- **Logging**: Create a `break_end` log with the mandatory `reason` in metadata.
- **Session Transition**:
  - Immediately call `processSessionStart` (refactored for internal use) with the `next_session` data stored in the `break` variable.
  - If the stop was premature, pass the reason to the new session so it can be displayed.
- **Cleanup**: Delete the `break` variable.
- **Summary**:
  - **Do NOT trigger AI summary** for the break itself.
  - If premature, update the `summary` variable with the break stop reason to be displayed in the UI.

## 3. Frontend Integration

### 3.1 API Updates (`app/api/client/status/route.ts`)
- Fetch and return the `break` variable in the status response.

### 3.2 UI State (`app/page.tsx`)
- Add `BREAK` to the status memo logic.
- Update `StatusPanel` props and rendering to handle the `BREAK` status (e.g., different color, "ON BREAK" text).
- Implement a countdown timer for the break similar to the session timer.
- Update `SummaryPanel` logic:
  - If `status === "FOCUSING"` and the session has a `break_reason` metadata, display it in the summary box.

### 3.3 Timeline Mapping
- Update the log-to-timeline mapping in `app/page.tsx` and `lib/backend/derivation.ts` to include `break_start` and `break_end` as `INFO` or specialized timeline types.

## 4. Testing Plan
- **Unit Tests**:
  - Test `processBreakStart` ensures no session is active.
  - Test `processBreakStop` correctly transitions to a session.
  - Test `reason` handling (default vs. provided).
- **Integration Tests**:
  - Verify `ingest` webhook accepts new break events.
  - Verify `summary` variable update on premature stop.
- **Manual Verification**:
  - Start break -> wait -> verify session starts.
  - Start break -> stop prematurely -> verify reason appears in summary box during the next session.
