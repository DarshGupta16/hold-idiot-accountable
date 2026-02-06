# HIA — My Zero Trust Accountability System

> **"Did I genuinely do what I said I would do, for as long as I said I would?"**

HIA (Hold Idiot Accountable, don't ask about the name 😜) is a minimalist, trust-minimized accountability system I built for myself to enforce focus by eliminating any easy way to bypass my own restrictions.

This specific repository contains the **Next.js mobile app** I've designed for my friend (the accountability partner) to keep tabs on my session status and any transgressions in real-time. HIA moves beyond local browser extensions, leveraging network-level domain blocking and passive monitoring to reflect the quiet truth of my productivity without judgment.

---

## The Problem

Whenever I get bored, I have a tendency to visit distracting sites like YouTube or X purely on impulse.

- **Browser extensions** didn't suffice—they're too easy to disable and only work in one place.
- **Local blocks** are trivial to bypass with a simple toggle or by switching devices.
- **Self-reporting** is unreliable; I needed a system that doesn't rely on my own honesty in the moment.

## My Solution

I block distractions at the **network level** using my Pi-hole directly via **Tailscale**. This ensures that all my devices—including my phone—cannot access the blocked websites. The system is built on a "Zero Trust" posture: my focus is server-validated, and any tampering is logged and reported to my friend.

---

## System Architecture

The system is distributed across a Next.js web app, a PocketBase backend, and my homelab.

### 1. The Trigger (Focus Session)

I start my sessions via a web app I host at `lock.in`.

- I set my **subject** and **duration**.
- This makes a request to an **n8n webhook**, which SSHs into my homelab to execute my Pi-hole blocklist script.
- A record of the session is created in my server's `study_sessions` collection.

### 2. The Enforcer (Homelab Script)

A script runs periodically (every 30s) on my homelab to ensure I'm staying honest:

- **Blocklist Integrity**: It creates a hash of the Pi-hole blocklist. If the hash changes (meaning I tried to unblock a site), it calls an n8n webhook.
- **Transgression Logging**: If I remove distracting sites during a session, the app logs the transgression to the database and alerts my friend.
- **The Heartbeat**: The script pings my app every time it executes.

### 3. The Watchdog (The Worker)

I run a standalone `worker.ts` process alongside the web server:

- It monitors the **Heartbeat** timestamp in PocketBase.
- If it misses even a single heartbeat (detected after 33 seconds) while a session is active, it logs a `MISSED_HEARTBEAT` event.
- This ensures I can't just turn off my homelab or disconnect from the network to bypass the blocks.

---

## Tech Stack

- **Frontend**: Next.js (App Router) with a "Calm" aesthetic (**Tailwind CSS**).
- **Backend**: PocketBase (embedded) for my append-only audit logs and session state.
- **Worker**: Standalone TypeScript process for heartbeat monitoring.
- **Infrastructure**: n8n (automation), Pi-hole (DNS blocking), Tailscale (network tunneling), Docker (deployment).

---

## Design Philosophy

I've built HIA around a few core [design principles](design_principles.md) and a strict [backend philosophy](backend_design_principles.md):

- **Calm Truth**: The UI reports facts; it doesn't scold or try to "motivate" me. It's a black box recorder for my focus.
- **Mirror, Not Coach**: The app reflects reality. If I walk away, it records the gap. It's a mirror, not a nag.
- **Server Authority**: My server is the final arbiter of session completion, status, and severity.

---

## Project Structure

- `/app`: My Next.js frontend and API routes.
- `/lib/backend`: Core logic for event derivation and PocketBase integration.
- `worker.ts`: My heartbeat monitoring watchdog.
- `project_overview.md`: The original vision and goal breakdown.

---

## Core Mechanism (Step-by-Step)

1. **Start**: I set my duration → n8n triggers my Pi-hole blocklist → My server starts the session.
2. **Monitor**: My homelab script pings the server and checks my blocklist every 30s.
3. **Validate**: The HIA Worker checks for those pings. If they stop, it logs a breach.
4. **End**: My session expires → n8n removes the blocks → My server archives the session.
5. **Reflect**: The AI generates a factual summary of the logs for me to review afterward.
