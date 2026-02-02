# HIA Backend Design Principles & Architecture

## Purpose
This document defines the **backend philosophy, invariants, and concrete data model** for HIA (Hold Idiot Accountable). It exists to keep the backend *boringly correct*, tamper-resistant, and aligned with the project’s accountability-first ethos.

The backend is not a convenience layer. It is a **truth-preserving ledger**.

---

## Core Principles

### 1. Trust-Minimized by Default
- All incoming events are treated as **claims**, not facts.
- Critical conclusions are always **derived server-side**.
- Client and homelab inputs are assumed to be modifiable and potentially dishonest.

### 2. Append-Only History
- Historical records are **never mutated or deleted**.
- Corrections are expressed as *new logs*, never edits.
- Auditability > cleanliness.

### 3. Separation of Concerns
- **Events** describe what was observed or detected.
- **Sessions** describe bounded periods of work.
- **Variables** describe current derived state.

No collection should attempt to do more than its role.

### 4. Calm, Low-Noise Output
- Backend supports UI restraint by:
  - Avoiding redundant logs
  - Deriving severity sparingly
  - Logging absences (missed heartbeats), not constant presence

### 5. Server Is the Arbiter of Meaning
- Completion vs abort is decided by the server.
- Severity (warn/breach) is decided by the server.
- Timestamps are generated server-side wherever possible.

---

## Runtime Architecture

- **Framework:** Next.js (App Router)
- **Database:** PocketBase (embedded, not publicly exposed)
- **Deployment:** Single Docker container (Koyeb free tier)

### External Actors
1. **Homelab**
   - Sends webhook events
   - Authenticated via fixed access key (env var)

2. **Client (girlfriend)**
   - Authenticated via session cookie
   - Read-only access to data
   - May trigger logging of derived events (e.g., missed heartbeat)

---

## PocketBase Schema

### `study_sessions`
> One record per study session. Source of truth for session-level facts.

**Fields**
- `started_at` — datetime (server-set)
- `ended_at` — datetime (nullable, server-set)
- `planned_duration_sec` — number
- `subject` — text
- `status` — select: `active | completed | aborted`
- `end_note` — text (optional, user-written description)
- `created_at` — auto
- `updated_at` — auto

**Invariants**
- Only one `active` session at a time
- `status` is server-derived
- `ended_at` is immutable once set

---

### `logs`
> Append-only audit log of events and derived judgments.

**Fields**
- `type` — select:
  - `session_start`
  - `session_end`
  - `blocklist_change`
  - `warn`
  - `breach`
  - `missed_heartbeat`
- `message` — text
- `metadata` — json (optional)
- `session` — relation → study_sessions (nullable)
- `created_at` — auto

**Rules**
- No updates or deletes
- Heartbeats are never logged
- Logs represent facts or server judgments only

---

### `variables`
> Singleton-style derived state and system memory.

**Fields**
- `key` — text (unique)
- `value` — json
- `updated_at` — auto

**Expected Keys**
- `lastHeartbeatAt` — ISO timestamp
- `summary` — AI-generated behavioral summary

**Rules**
- Not historical
- Overwritten freely
- Never used as an audit source

---

## Event Handling Philosophy

- Use a **single webhook endpoint**
- Dispatch internally by validated event type
- Prefer explicit enums over freeform strings

### Heartbeats
- Update `lastHeartbeatAt`
- Never logged
- Absence is meaningful

### Study Session End
- Payload may include a descriptive reason
- Server determines completion vs abort based on elapsed time

---

## Access Control Model

- **Server:** Full access
- **Client:** Read-only access to all collections
- **Monitored user:** No direct access to PocketBase

All write operations flow through server routes only.

---

## Non-Goals (Important)

- No real-time collaboration
- No gamification
- No user-facing system status dashboard
- No client-authoritative writes

---

## Guiding Heuristic

> If a design choice makes cheating easier, reject it.
> If a design choice makes the system quieter but less truthful, reject it.
> Prefer boring correctness over cleverness.

