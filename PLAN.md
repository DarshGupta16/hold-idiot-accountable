# HIA Bun Migration & DX Cleanup Plan

## 1. Overview
This plan focuses on a lean, Bun-powered development environment while preserving all production-ready cloud sync and infrastructure stability.

## 2. Environment & Compatibility Constraints
- **Line Endings**: MUST preserve existing line endings (LF/CRLF).
- **GLIBC Compatibility**: The `convex-local-backend` binary in production requires GLIBC 2.39+ (Debian Trixie).
- **Production Infrastructure**: The `Dockerfile` and `entrypoint.sh` are optimized with Bun/Trixie for deployment but no longer contain local-only simulation bloat.

## 3. Simplified Development Workflow
**Goal:** Zero-friction, 2-terminal setup.

- **Terminal 1: The Database**
    - `bun run convex:dev`: Uses the native Convex CLI to manage the local database and sync code changes.
- **Terminal 2: The App Stack**
    - `bun run dev`: Starts the Next.js frontend and the background watchdog worker.

## 4. Implementation Checklist (Completed)
- [x] **Bun Migration**: `package.json` and `bun.lock` updated.
- [x] **DX Cleanup**: Removed `scripts/dev.ts`, `scripts/db.ts`, and complex Docker orchestration for local dev.
- [x] **Core Preserved**: Cloud sync layer (`lib/backend/sync.ts`) and production Docker fixes are untouched.
- [x] **Test Migration**: Core tests ported to `bun test`.
