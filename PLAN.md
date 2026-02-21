# HIA DX Optimization & Bun Migration Plan

## 1. Overview
This plan outlines the migration from `npm` to `Bun` and a series of Developer Experience (DX) optimizations. The focus is on maintaining all existing production compatibility fixes (especially regarding GLIBC and Convex self-hosted infrastructure) while achieving a near-zero-config "seamless" local development environment.

## 2. Environment & Compatibility Constraints
**CRITICAL: WSL & Platform Handling**
- **Line Endings**: MUST preserve existing line endings (LF/CRLF) for all files. Use `.gitattributes` if necessary.
- **GLIBC Compatibility**: The `convex-local-backend` binary requires GLIBC 2.39+ (provided by Debian Trixie). The production `Dockerfile` MUST use a Trixie-based image.
- **Production Fixes (Preserve from commit 82d6074+)**:
    - Keep `convex-local-backend` binary naming and flags.
    - Keep `node:20-trixie-slim` (or `bun` on Trixie) for GLIBC compatibility.
    - Keep the inline generation of `convex/_generated/api.ts` in the Dockerfile.
    - Keep the complex `entrypoint.sh` logic (healthchecks, admin key parsing, deployment).
    - Keep the `.env.runtime` sourcing in `supervisord.conf`.

## 3. Branching & Git Strategy
**Goal:** Isolated, auditable migration.
- **Branch Creation**: Before starting, create a new branch: `feat/bun-migration-dx-opt`.
- **Incremental Commits**: Commit and push after every major phase.
- **Verification**: Each commit must be verified to not break the production build or local dev.

## 4. Phase 1: Bun Migration (Foundation)
- [ ] **Dependency Migration**:
    - [ ] Run `bun install` to generate `bun.lockb`.
    - [ ] Remove `tsx`, `concurrently`, and `dotenv` from `devDependencies`.
- [ ] **Script Updates (`package.json`)**:
    - [ ] `dev`: `bun worker.ts & next dev --webpack` (Simple, seamless).
    - [ ] `build`: `next build --webpack`.
    - [ ] `test`: `bun test`.
- [ ] **Code Cleanup**:
    - [ ] Remove `dotenv` imports/configs (Bun loads `.env` natively).
    - [ ] Ensure `bootstrap.ts` and `worker.ts` are excluded from the Next.js build but bundled for production.

## 5. Phase 2: Seamless Developer Experience
**Goal:** Max 2 commands for full dev setup.

- **Terminal 1: The App Stack**
    - `bun run dev`: Runs both Next.js and the Watchdog Worker.
    - Optimized with color-coded logs if possible, but kept minimal.
- **Terminal 2: The Database (Optional/When needed)**
    - `bun run convex:local`: A new script to start the local Convex backend via Docker or local binary.
    - `bun x convex dev --local`: To keep schema in sync.

## 6. Phase 3: Infrastructure & Build Optimization
- [ ] **Trixie + Bun Dockerfile**:
    - [ ] Use `debian:trixie-slim` as the base.
    - [ ] Install Bun manually in the Dockerfile to ensure Trixie (GLIBC 2.39) compatibility.
    - [ ] Use `bun build --target=node` for bundling worker/bootstrap.
- [ ] **Preserve Orchestration**:
    - [ ] Maintain the `supervisord` setup as it is proven stable for multi-process containers on Render.

## 7. Implementation Sequence
1. **The Switch**: `bun install` + `package.json` cleanup.
2. **The Sync**: Verify `bun test` passes for existing tests.
3. **The Seamless Dev**: Update `package.json` scripts for the 2-terminal workflow.
4. **The Ship**: Refactor `Dockerfile` to use Debian Trixie + Bun and verify build.
5. **The Final Polish**: Update `README.md`.
