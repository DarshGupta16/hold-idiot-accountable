# HIA — Project Overview

## What is HIA?

**HIA (Human-in-the-Loop Accountability)** is a minimalist, real-time accountability and study-session tracking system designed to enforce *honest focus*, *temporal integrity*, and *post-session reflection* — without becoming noisy, gamified, or psychologically intrusive.

At its core, HIA exists to answer a single question with high fidelity:

> **“Did I genuinely do what I said I would do, for as long as I said I would?”**

Everything else is secondary.

---

## Core Philosophy

HIA is built around a few non-negotiable principles:

### 1. Accountability > Motivation
HIA does **not** try to motivate, encourage, or emotionally coax the user. It assumes the user already *wants* to work.

Its job is to:
- Observe
- Record
- Enforce constraints
- Reflect back the truth

### 2. Low Noise, High Signal
No streaks. No XP. No dopamine hacks.

If something appears in the UI, it must be:
- Actionable
- Informative
- Or reflective

If it’s merely decorative or reassuring, it does not belong.

### 3. Trust-Minimized Design
The system is explicitly designed to **reduce the user’s ability to cheat** themselves:
- Session completion is server-validated
- Abort vs completion is determined by the backend, not the client
- Heartbeats are tracked passively

HIA assumes the user is *capable of lying* — and designs around that.

### 4. Calm by Default
HIA should feel:
- Quiet
- Neutral
- Non-judgmental

Warnings are factual, not accusatory.
Breaches are logged, not dramatized.

---

## What HIA Is NOT

To avoid scope creep and aesthetic drift, HIA is **explicitly not**:

- A productivity planner
- A task manager
- A habit tracker
- A gamified focus app
- A motivational coach
- A system-status dashboard

If a feature pushes HIA toward any of the above, it is likely wrong.

---

## Core User Flow (High Level)

1. **User starts a study session**
   - Declares intent (task/topic)
   - Declares duration

2. **Session runs in real time**
   - Client sends heartbeats
   - Server tracks last heartbeat timestamp

3. **Events are logged only when meaningful**
   - Session start
   - First warning
   - Breach(es)
   - Session end

4. **Session ends**
   - Server determines completion vs abort
   - AI summary is generated
   - Timeline becomes immutable

5. **User reflects**
   - Reads factual log
   - Reads AI-generated summary
   - No action required

---

## Event-Driven Architecture (Conceptual)

HIA is fundamentally **event-based**.

Events are:
- Discrete
- Append-only
- Chronologically ordered

Examples:
- `STUDY_SESSION_START`
- `FOCUS_WARNING`
- `FOCUS_BREACH`
- `STUDY_SESSION_END`

Each event:
- Has a timestamp
- Has a source (client / server)
- May trigger side effects (e.g. summary regeneration)

---

## Role of AI in HIA

AI is used **sparingly and intentionally**.

### AI is responsible for:
- Generating concise session summaries
- Synthesizing logs into reflective insights

### AI is NOT responsible for:
- Real-time feedback
- Judging the user
- Enforcing rules
- Making control decisions

AI observes *after the fact*.

---

## Data Integrity & Persistence

- Sessions are immutable once ended
- Logs are append-only
- Heartbeats are **not** stored as logs
- Only the *last heartbeat timestamp* is persisted

This keeps the data:
- Lean
- Auditable
- Semantically meaningful

---

## Intended End State

When fully realized, HIA should feel like:

- A **black box recorder** for your focus
- A **mirror**, not a coach
- A system that quietly but relentlessly tells the truth

If a user walks away from a session, HIA should not chase them.
It will simply record that they did.

And that is enough.

---

## Design North Star (One Sentence)

> **HIA is a calm, trust-minimized accountability system that records reality as it happens and reflects it back without judgment.**

