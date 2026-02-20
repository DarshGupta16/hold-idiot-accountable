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
- Historical records are **never mutated or deleted** (except for full reconciliation overwrites from local to cloud).
- Corrections are expressed as *new logs*, never edits.
- Auditability > cleanliness.

### 3. Separation of Concerns
- **Events** describe what was observed or detected.
- **Sessions** describe bounded periods of work.
- **Variables** describe current derived state.

No table should attempt to do more than its role.

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
- **Database:** Convex OSS (Self-hosted local instance + Cloud backup)
- **Deployment:** Single Docker container (Render.com)
- **Sync:** Local-first with fire-and-forget cloud replication and periodic reconciliation.

### External Actors
1. **Homelab**
   - Sends webhook events
   - Authenticated via fixed access key (env var)

2. **Client (accountability partner)**
   - Authenticated via session cookie
   - Read-only access to data
   - May trigger logging of derived events (e.g., missed heartbeat)

---

## Convex Schema

### `studySessions`
> One record per study session. Source of truth for session-level facts.

**Fields**
- `started_at` — string (ISO datetime)
- `ended_at` — string (nullable ISO datetime)
- `planned_duration_sec` — number
- `subject` — string
- `status` — union: `active | completed | aborted`
- `end_note` — string (optional)
- `timeline` — array of objects (JSON events)
- `summary` — string (AI summary)
- `_creationTime` — auto (numeric)

**Invariants**
- Only one `active` session at a time
- `status` is server-derived
- `ended_at` is immutable once set

---

### `logs`
> Append-only audit log of events and derived judgments.

**Fields**
- `type` — union:
  - `session_start`
  - `session_end`
  - `blocklist_change`
  - `warn`
  - `breach`
  - `missed_heartbeat`
- `message` — string
- `metadata` — any (optional)
- `session` — ID → studySessions (optional)
- `_creationTime` — auto (numeric)

**Rules**
- No updates or deletes
- Heartbeats are never logged
- Logs represent facts or server judgments only

---

### `variables`
> Singleton-style derived state and system memory.

**Fields**
- `key` — string (unique index)
- `value` — any
- `_creationTime` — auto (numeric)

**Expected Keys**
- `lastHeartbeatAt` — Heartbeat object
- `summary` — AI-generated behavioral summary
- `blocklist` — Current active blocklist

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
- Update `lastHeartbeatAt` variable
- Never logged
- Absence is meaningful

### Study Session End
- Payload may include a descriptive reason
- Server determines completion vs abort based on elapsed time

---

## Access Control Model

- **Server:** Full access via admin key
- **Client:** Read-only access to all tables via API
- **Monitored user:** No direct access to database

All write operations flow through server routes and derivation functions only.

---

## Sync & Resilience

- **Local-First:** All critical operations happen on the local Convex instance.
- **Fire-and-Forget:** Every write is asynchronously replicated to Convex Cloud.
- **Reconciliation:** A background worker ensures local and cloud remain in sync via hashing.
- **Cold Start:** If the local DB is empty, it pulls the entire state from the cloud.

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
