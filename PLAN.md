# HIA: PocketBase → Convex Migration Plan

> **Audience**: AI agent performing the migration. Follow these instructions exactly. Do not make executive decisions. If something is ambiguous, search Google for the answer before proceeding.

---

## Architecture Overview

### Current State

- **Database**: PocketBase (embedded Go binary, runs on `127.0.0.1:8090` inside Docker)
- **App**: Next.js (App Router) on port 3000
- **Worker**: Standalone `worker.ts` process for heartbeat monitoring
- **Process management**: `supervisord` runs PocketBase, Next.js, and Worker inside a single Docker container
- **Deployment**: Render.com free tier, builds from Dockerfile in GitHub repo. **No persistent storage.**
- **Data fetching**: SWR polling (`refreshInterval: 5000`) via Next.js API routes

### Target State

- **Local Database**: Convex OSS self-hosted backend (runs on `127.0.0.1:3210` inside Docker)
- **Backup Database**: Convex Cloud (managed, persistent)
- **App**: Next.js (App Router) on port 3000 — unchanged
- **Worker**: Same worker process, now using Convex client instead of PocketBase client. Also runs periodic sync reconciliation.
- **Process management**: `supervisord` runs Convex backend, Next.js, and Worker inside a single Docker container
- **Deployment**: Render.com free tier, builds from Dockerfile — unchanged pattern
- **Data fetching**: Keep SWR polling pattern for now. Reactive queries are a future enhancement.

### Sync Rules (CRITICAL — implement exactly as described)

1. **All CRUD operations** use the LOCAL Convex backend only (`127.0.0.1:3210`)
2. **Every write** to local is ALSO replicated to the cloud Convex as a fire-and-forget async call (same mutation, NOT a full DB overwrite)
3. **Every 5 minutes**, the worker computes a SHA-256 hash of the local DB state and compares it with the cloud's hash. If they differ, the cloud is FULLY OVERWRITTEN with local data.
4. **On container cold start** (local DB has 0 records across ALL tables): pull ALL data from cloud → insert into local. This is the ONLY scenario where cloud → local data flow happens.
5. **If cloud is temporarily unavailable**, local operations continue unaffected. The periodic reconciliation will catch up later.

### Environment Variables (will be available at runtime)

The human user will configure these on Render. Assume they exist in `process.env`:

| Variable                  | Purpose                                                                           |
| ------------------------- | --------------------------------------------------------------------------------- |
| `CONVEX_URL`              | Local Convex backend URL. Always `http://127.0.0.1:3210` in production.           |
| `CONVEX_ADMIN_KEY`        | Admin key for local Convex backend. Generated at container startup in entrypoint. |
| `CONVEX_CLOUD_URL`        | Convex Cloud deployment URL (e.g., `https://xyz-123.convex.cloud`)                |
| `CONVEX_CLOUD_DEPLOY_KEY` | Deploy key for Convex Cloud project                                               |
| `HIA_CLIENT_PASSWORD`     | Existing — unchanged                                                              |
| `HIA_HOMELAB_KEY`         | Existing — unchanged                                                              |
| `HIA_JWT_SECRET`          | Existing — unchanged                                                              |
| `GROQ_API_KEY`            | Existing — unchanged                                                              |
| `PROD`                    | Existing — unchanged                                                              |
| `INSTANCE_SECRET`         | Secret for Convex backend. Used to generate deterministic admin keys.             |

Variables being REMOVED: `POCKETBASE_URL`, `POCKETBASE_ADMIN_EMAIL`, `POCKETBASE_ADMIN_PASSWORD`

---

## Git Setup (BEFORE ANYTHING ELSE)

Create a new branch and switch to it:

```
git checkout -b feat/convex-migration
```

All work will be done on this branch. After every phase below, commit and push:

```
git add -A
git commit -m "<phase description>"
git push origin feat/convex-migration
```

The specific commit message for each phase is noted at the end of that phase's section.

---

## Phase 0: Research (DO THIS FIRST)

Before writing any code, search Google for the following and note the answers. You will need them throughout this migration:

1. **"convex self-hosted docker image binary location"** or inspect the Docker image `ghcr.io/get-convex/convex-backend:latest` — find the exact filesystem path of the Convex backend binary inside the image. You need this to `COPY --from` in the Dockerfile.
2. **"convex self-hosted generate_admin_key.sh"** — find the exact path of this script inside the Docker image. You need this for the entrypoint.
3. **"convex self-hosted command line arguments"** — find what CLI arguments or environment variables the Convex backend binary needs to run (port, data directory, etc.). Check the official self-hosted README at `https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md`.
4. **"npx convex deploy self-hosted url admin-key"** — find the exact CLI syntax for deploying Convex functions to a self-hosted backend. You need to know the environment variables or flags: `CONVEX_SELF_HOSTED_URL`, `CONVEX_SELF_HOSTED_ADMIN_KEY`, `--url`, `--admin-key`, etc.
5. **"ConvexHttpClient server-side node.js"** — find how to use the Convex HTTP client in a Node.js server environment (not React). This is what all API routes and the worker will use.
6. **Convex OSS Docker image base OS** — determine whether the image is glibc-based (Debian/Ubuntu) or musl-based (Alpine). This determines whether the current `node:20-alpine` base image is compatible or needs to change to `node:20` (Debian). If the Convex binary requires glibc, you MUST switch from `node:20-alpine` to `node:20-slim` for the runner stage.

Store these findings and use them to fill in the exact values in the instructions below.

> **No git commit for Phase 0** — this is research only, no files are changed.

---

## Phase 1: Dependencies

### Modify `package.json`

1. **Remove** the `pocketbase` dependency from `dependencies`
2. **Add** `convex` to `dependencies` (latest version: run `npm info convex version` to get the current latest)
3. Run `npm install` to update `package-lock.json`

**Git commit**: `git add -A && git commit -m "chore: replace pocketbase with convex dependency" && git push origin feat/convex-migration`

---

## Phase 2: Convex Schema and Functions

### Create `convex/` directory

Create a new directory `convex/` in the project root. All files below go in this directory.

### Create `convex/schema.ts`

Define the Convex schema with three tables that mirror the current PocketBase collections:

**`studySessions` table:**

- `started_at`: string (ISO datetime)
- `ended_at`: optional string (ISO datetime)
- `planned_duration_sec`: number
- `subject`: string
- `status`: union of literals `"active"`, `"completed"`, `"aborted"`
- `end_note`: optional string
- `timeline`: optional array of objects, each with: `id` (string), `time` (string), `type` (union of `"START"`, `"END"`, `"BREACH"`, `"WARNING"`, `"INFO"`), `description` (string)
- `summary`: optional string
- Index: `by_status` on `["status"]`
- Index: `by_creation` on `["_creationTime"]`

**`logs` table:**

- `type`: union of literals `"session_start"`, `"session_end"`, `"blocklist_change"`, `"warn"`, `"breach"`, `"missed_heartbeat"`
- `message`: string
- `metadata`: optional `v.any()`
- `session`: optional `v.id("studySessions")`
- Index: `by_session` on `["session"]`
- Index: `by_type` on `["type"]`
- Index: `by_creation` on `["_creationTime"]`

**`variables` table:**

- `key`: string
- `value`: `v.any()`
- Index: `by_key` on `["key"]`

Use `defineSchema` and `defineTable` from `"convex/server"`, and `v` from `"convex/values"`.

### Create `convex/studySessions.ts`

Define these Convex functions using `query` and `mutation` from `"./_generated/server"`:

1. **`getActive`** (query): Query `studySessions` table using the `by_status` index where `status === "active"`. Return the first result or `null`.

2. **`getById`** (query): Takes an `id` argument of type `v.id("studySessions")`. Return `db.get(id)`.

3. **`list`** (query): Takes `paginationOpts` using `paginationOptsValidator` from `"convex/server"`. Query `studySessions`, order by `"desc"` (newest first), and paginate.

4. **`create`** (mutation): Takes all the fields needed to create a session (`started_at`, `planned_duration_sec`, `subject`, `status`). Insert into `studySessions` using `db.insert`. Return the new document ID.

5. **`update`** (mutation): Takes `id` of type `v.id("studySessions")` and an `updates` object. Use `db.patch(id, updates)`.

6. **`count`** (query): Count all documents in `studySessions`. Return the count.

### Create `convex/logs.ts`

1. **`getBySession`** (query): Takes `sessionId` of type `v.id("studySessions")`. Query `logs` using `by_session` index. Collect and return, sorted by `_creationTime` descending.

2. **`getBySessionAsc`** (query): Same as above but sorted ascending (for timeline building).

3. **`getUnacknowledgedAlerts`** (query): Query `logs` where `type` is `"missed_heartbeat"`, `"breach"`, or `"warn"`. Filter in-memory for those where `metadata.acknowledged !== true`. Return them sorted by `_creationTime` desc. Limit to 100.

4. **`create`** (mutation): Takes `type`, `message`, `metadata` (optional), `session` (optional). Insert into `logs`. Return the new document ID.

5. **`updateMetadata`** (mutation): Takes `id` of type `v.id("logs")` and `metadata` object. Use `db.patch(id, { metadata })`.

6. **`count`** (query): Count all documents in `logs`. Return the count.

### Create `convex/variables.ts`

1. **`getByKey`** (query): Takes `key` (string). Query `variables` using `by_key` index where `key` equals the argument. Return the first result or `null`.

2. **`upsert`** (mutation): Takes `key` (string) and `value` (any). Query for existing record with that key using `by_key` index. If it exists, `db.patch(existingId, { value })`. If not, `db.insert("variables", { key, value })`.

3. **`count`** (query): Count all documents in `variables`. Return the count.

### Create `convex/sync.ts`

These functions support the sync layer:

1. **`computeHash`** (query): Count records in all three tables. Get the latest `_creationTime` from each table. Concatenate these 6 values into a string and return it. (The actual SHA-256 hashing will be done client-side in the sync layer since Convex queries should be deterministic and can't use crypto APIs.)

2. **`exportAll`** (query): Return an object with three arrays: `sessions` (all studySessions), `logs` (all logs), `variables` (all variables). Use `db.query(table).collect()` for each. **Important**: Convex queries have a limit on how much data they can return. For safety, if any table has more than 8000 documents, log a warning. For HIA's scale this should never happen.

3. **`importAll`** (mutation): Takes `sessions` (array), `logs` (array), `variables` (array). Insert each record into the respective table. For sessions and logs, the data comes from the cloud and will include all field values but NOT the original `_id` or `_creationTime` (those are auto-generated by Convex). Store the original cloud `_id` in a field called `_cloudId` if you need to preserve the reference. Actually — do NOT try to preserve `_id` mapping. Just insert the data fresh. The `session` field in logs (which references a studySessions `_id`) will need special handling: insert all sessions first, build a map of `cloudSessionId → localSessionId`, then insert logs with the mapped `session` field.

4. **`clearAll`** (mutation): Delete all documents from all three tables. Use `db.query(table).collect()` then `db.delete(id)` for each. This is used before overwriting the cloud.

### Create `convex/tsconfig.json`

This file is required by Convex. Search Google for "convex tsconfig.json" to get the standard content. It typically just extends the main tsconfig with Convex-specific settings. If `npx convex dev` generates this automatically, let it.

**Git commit**: `git add -A && git commit -m "feat: add convex schema and server functions" && git push origin feat/convex-migration`

---

## Phase 3: Convex Client Infrastructure

### Delete `lib/backend/pocketbase.ts`

This file is no longer needed. Delete it entirely.

### Create `lib/backend/convex.ts`

This file replaces `pocketbase.ts`. It exports two Convex HTTP client instances:

1. **`getLocalClient()`**: Returns a `ConvexHttpClient` pointed at `process.env.CONVEX_URL` (defaults to `http://127.0.0.1:3210`). This is used for ALL CRUD operations.

2. **`getCloudClient()`**: Returns a `ConvexHttpClient` pointed at `process.env.CONVEX_CLOUD_URL`. Returns `null` if `CONVEX_CLOUD_URL` is not set (graceful degradation). This is used ONLY by the sync layer.

Import `ConvexHttpClient` from `"convex/browser"`. Search Google for the exact import path if this doesn't work — it may be `"convex/http-client"` or similar depending on the version.

Both clients need authentication. For the local client, use the admin key. Search Google for "ConvexHttpClient setAuth" or "ConvexHttpClient admin key authentication" to find how to authenticate HTTP clients for server-side use with a deploy key / admin key.

### Modify `lib/backend/config.ts`

1. **Remove** the following fields from the `AppConfig` interface and the `config` object:
   - `pocketbaseUrl`
   - `adminEmail`
   - `adminPassword`

2. **Add** the following fields:
   - `convexUrl`: string — from `getEnv("CONVEX_URL")`, default `"http://127.0.0.1:3210"`
   - `convexAdminKey`: string — from `getEnv("CONVEX_ADMIN_KEY")`
   - `convexCloudUrl`: string — from `getEnv("CONVEX_CLOUD_URL")`
   - `convexCloudDeployKey`: string — from `getEnv("CONVEX_CLOUD_DEPLOY_KEY")`

3. **Update** the server-side validation warnings at the bottom to warn about missing Convex config instead of PocketBase config.

**Git commit**: `git add -A && git commit -m "feat: add convex client infrastructure, replace pocketbase client" && git push origin feat/convex-migration`

---

## Phase 4: Sync Layer

### Create `lib/backend/sync.ts`

This module handles all local↔cloud synchronization. It imports and uses the clients from `lib/backend/convex.ts` and calls the Convex functions defined in `convex/sync.ts`.

Implement three exported functions:

#### `bootstrapFromCloud()`

1. Call the `count` queries on the local client for all three tables (studySessions, logs, variables)
2. Sum all counts
3. If sum === 0 AND a cloud client is available:
   a. Call `sync:exportAll` on the **cloud** client
   b. If cloud has data, call `sync:importAll` on the **local** client with that data
   c. Log: `"[Sync] Bootstrapped from cloud: X sessions, Y logs, Z variables"`
4. If sum > 0: Log `"[Sync] Local DB has data, skipping bootstrap"` and return

#### `replicateToCloud(table, operation, args)`

1. If no cloud client is available, return immediately (no-op)
2. Call the same Convex mutation on the cloud client with the same arguments
3. Wrap in try-catch. On failure, log the error but do NOT throw (fire-and-forget)
4. Log: `"[Sync] Replicated {operation} to cloud for {table}"`

#### `reconcile()`

1. If no cloud client is available, return immediately
2. Call `sync:computeHash` on BOTH local and cloud clients
3. Compute SHA-256 of each hash string (use Node.js `crypto.createHash("sha256")`)
4. Compare the two hashes
5. If they match: Log `"[Sync] Hashes match, no reconciliation needed"` and return
6. If they differ:
   a. Log `"[Sync] MISMATCH detected. Overwriting cloud with local data."`
   b. Call `sync:clearAll` on the **cloud** client
   c. Call `sync:exportAll` on the **local** client
   d. Call `sync:importAll` on the **cloud** client with the local data
   e. Log `"[Sync] Cloud overwritten successfully"`

**Git commit**: `git add -A && git commit -m "feat: implement local-cloud sync layer" && git push origin feat/convex-migration`

---

## Phase 5: Migrate Backend Logic

### Modify `lib/backend/schema.ts`

Update the barrel export file. Remove the comment about PocketBase. Keep the re-exports from `./schema/sessions`, `./schema/logs`, `./schema/variables`.

### Modify `lib/backend/schema/sessions.ts`

Update the `StudySession` interface:

- Rename `id: string` → `_id: string` (Convex uses `_id`)
- Rename `created_at: string` → `_creationTime: number` (Convex uses a numeric timestamp in milliseconds)
- Remove `updated_at: string` (Convex doesn't have this; if needed, add a custom `updated_at` field to the schema)
- Keep all other fields the same
- Update the JSDoc to reference Convex instead of PocketBase

### Modify `lib/backend/schema/logs.ts`

Update the `Log` interface:

- Rename `id: string` → `_id: string`
- Rename `created_at: string` → `_creationTime: number`
- Update JSDoc

### Modify `lib/backend/schema/variables.ts`

Update the `Variable` interface:

- Rename `id: string` → `_id: string`
- Remove `updated_at: string` (or convert to custom field)
- Update JSDoc

### Modify `lib/backend/invariants.ts`

Replace the entire implementation:

- Remove `import { getAuthenticatedPocketBase }`
- Import the local Convex client from `./convex`
- Import the generated API from the convex directory (the Convex-generated `api` object)

**`getActiveSession()`**: Call the `studySessions:getActive` query via the local ConvexHttpClient. Return the result or null.

**`ensureNoActiveSession()`**: Call `getActiveSession()`. If it returns a value, throw the invariant error.

**`ensureActiveSession()`**: Call `getActiveSession()`. If it returns null, throw the invariant error. Otherwise return it.

### Modify `lib/backend/derivation.ts`

This is the largest change. Replace ALL PocketBase calls with Convex mutations via the local ConvexHttpClient. Also add replication calls to the sync layer.

**Remove** all imports of `getAuthenticatedPocketBase` and PocketBase types.
**Add** imports for the local Convex client, the sync `replicateToCloud` function, and the Convex API.

#### `processHeartbeat(payload)`

1. Call `variables:upsert` on local client with key `"lastHeartbeatAt"` and the heartbeat value object
2. Call `replicateToCloud("variables", "upsert", sameArgs)`

#### `processSessionStart(payload)`

1. Call `ensureNoActiveSession()`
2. Call `studySessions:create` on local client → get back the new session ID
3. Call `replicateToCloud("studySessions", "create", sameArgs)`
4. Call `variables:upsert` on local client with key `"blocklist"` and blocklist value
5. Call `replicateToCloud("variables", "upsert", sameArgs)`
6. Call `logs:create` on local client with `type: "session_start"`, appropriate message, metadata, and session ID
7. Call `replicateToCloud("logs", "create", sameArgs)` — note: the cloud will have a different session ID, so for the cloud replication use a version of the log WITHOUT the `session` field, OR accept that cloud logs won't have session references (since session IDs differ between local and cloud). **Decision**: For write-time replication, replicate the data fields but set `session` to `undefined` for cloud copies. The periodic reconciliation (full overwrite) handles correct relationships.

#### `processSessionStop(payload)`

1. Call `ensureActiveSession()` → get active session
2. Calculate elapsed time and derive `completed` vs `aborted` status (same logic as current)
3. Call `logs:create` on local for `"session_end"` log
4. Call `logs:getBySessionAsc` to get all logs for this session (for timeline building)
5. Build the timeline array from the logs (same mapping logic as current, but use `_creationTime` instead of `created_at` — convert the numeric timestamp to a Date for formatting)
6. Generate AI summary (same as current, using `generateSessionSummary`)
7. Call `variables:upsert` on local for the `"summary"` variable
8. Call `studySessions:update` on local to set `ended_at`, `status`, `end_note`, `timeline`, `summary`
9. Replicate all writes to cloud (fire-and-forget, without session references where ID mismatch would occur)

#### `processBlocklistEvent(payload)`

1. Call `getActiveSession()` (nullable)
2. Call `logs:create` on local with breach/warn type and appropriate message
3. Replicate to cloud

### Modify `lib/backend/types.ts`

- Remove all re-exports from `"./schema"` that reference PocketBase-specific types
- Keep the `EventType`, `BlocklistEventType`, `SessionStatus` enums
- Keep the Zod schemas (`HeartbeatSchema`, `SessionStartSchema`, `SessionStopSchema`, `BlocklistEventSchema`, `WebhookEventSchema`)
- Remove the backward-compatibility aliases (`StudySessionRecord`, `LogRecord`, `VariableRecord`) or update them to use the new Convex-aligned types

### Modify `lib/utils.ts`

- **Remove** the `parsePocketBaseDate()` function entirely. Convex uses numeric millisecond timestamps (`_creationTime`), so standard `new Date(timestamp)` works.
- Keep `cn()` and `formatDuration()` unchanged.

**Git commit**: `git add -A && git commit -m "feat: migrate backend logic from pocketbase to convex" && git push origin feat/convex-migration`

---

## Phase 6: Migrate API Routes

### Modify `app/api/client/status/route.ts`

Replace all PocketBase calls with Convex calls via the local ConvexHttpClient:

1. Auth check: Keep `verifySession` and `verifyHomelabKey` logic unchanged (these don't use PocketBase)
2. Replace `getAuthenticatedPocketBase()` call with local Convex client
3. Fetch active session: Call `studySessions:getActive` query
4. Fetch heartbeat: Call `variables:getByKey` with key `"lastHeartbeatAt"`
5. Fetch summary: Call `variables:getByKey` with key `"summary"`
6. Fetch blocklist: Call `variables:getByKey` with key `"blocklist"`
7. Fetch logs: If there's a session ID, call `logs:getBySession`
8. Lazy watchdog: Same logic, but create missed_heartbeat log via `logs:create` Convex mutation (+ replicate to cloud)
9. Return the same JSON response shape. **IMPORTANT**: The frontend expects `id` and `created_at` fields on sessions and logs. Either:
   - Map the Convex response objects to include `id` (copied from `_id`) and `created_at` (ISO string from `_creationTime`) before returning them
   - OR update the frontend to use `_id` and `_creationTime` directly
   - **Decision**: Add a mapping layer in the API route that converts Convex document shapes to the existing frontend-expected shape. This minimizes frontend changes. Map `_id` → `id` and `_creationTime` → `created_at` (as ISO string).

### Modify `app/api/client/history/route.ts`

1. Replace PocketBase paginated list with Convex paginated query
2. Call `studySessions:list` with pagination options
3. Map the response to maintain the existing shape (with `id` and `created_at` mapping)

### Modify `app/api/client/acknowledge/route.ts`

1. Replace PocketBase reads with `logs:getUnacknowledgedAlerts` Convex query
2. Replace PocketBase updates with `logs:updateMetadata` Convex mutations for each unacknowledged log
3. Replicate each metadata update to cloud

### Modify `app/api/client/ai/summary/route.ts`

1. Fetch most recent session via Convex query (get latest from `studySessions` ordered by `_creationTime` desc)
2. Fetch logs via `logs:getBySessionAsc`
3. Generate AI summary (unchanged)
4. Store via `variables:upsert` with key `"summary"`
5. Replicate to cloud

### `app/api/webhooks/ingest/route.ts`

This file calls derivation functions and does NOT directly use PocketBase. **Minimal changes needed** — just verify that the derivation functions are correctly updated (Phase 5) and remove any stale PocketBase-related imports if present.

### `app/api/auth/login/route.ts`

This file does NOT use PocketBase at all (it uses JWT auth via `jose`). **No changes needed.**

**Git commit**: `git add -A && git commit -m "feat: migrate API routes from pocketbase to convex" && git push origin feat/convex-migration`

---

## Phase 7: Worker

### Modify `worker.ts`

Rewrite to use Convex instead of PocketBase:

1. **Remove** all PocketBase imports and authentication logic (`pb.collection("_superusers").authWithPassword(...)`)
2. **Add** imports for the local Convex client and the sync layer (`bootstrapFromCloud`, `reconcile`)
3. **Remove** `POCKETBASE_ADMIN_EMAIL`/`POCKETBASE_ADMIN_PASSWORD` validation
4. **Add** `CONVEX_URL` and `CONVEX_ADMIN_KEY` validation

**Startup sequence**:

```
1. Validate env vars (CONVEX_URL, CONVEX_ADMIN_KEY)
2. Call bootstrapFromCloud() — cold start check
3. Start heartbeat check loop (every 30s) — same logic, using Convex
4. Start reconciliation loop (every 5 minutes) — calls reconcile()
```

**`checkHeartbeat()` function** — same logic as current, but:

- Read `lastHeartbeatAt` variable via `variables:getByKey` Convex query
- Read active session via `studySessions:getActive` Convex query
- Create missed_heartbeat log via `logs:create` Convex mutation
- Replicate the log creation to cloud

**New `runReconciliation()` function**:

- Call `reconcile()` from the sync layer
- Wrap in try-catch, log errors but don't crash

**Intervals**:

- `checkHeartbeat()` — every 30 seconds (same as current)
- `runReconciliation()` — every 5 minutes (300,000 ms)

**Git commit**: `git add -A && git commit -m "feat: migrate worker to convex with sync reconciliation" && git push origin feat/convex-migration`

---

## Phase 8: Frontend Changes

### Modify `app/page.tsx`

1. **Remove** `import { parsePocketBaseDate } from "@/lib/utils"`
2. **Replace** all `parsePocketBaseDate(dateString)` calls with `new Date(dateString)` — because the API routes now return ISO strings (mapped from Convex's `_creationTime`)
3. The data shape from SWR remains the same because the API routes map the Convex documents to the existing frontend shape (Phase 6 decision). So `data.activeSession.id`, `data.logs`, etc. should still work.
4. Verify all other date parsing works correctly. The API routes should return ISO format strings (with `T` separator), not PocketBase format (space separator).

### Audit all components in `components/` directory

Search for any usage of:

- `parsePocketBaseDate` — replace with `new Date()`
- `.id` on session/log objects — should still work due to API mapping
- `.created_at` on session/log objects — should still work due to API mapping
- Any PocketBase-specific date format handling (space-to-T replacement)

The components should need minimal changes since the API routes handle the shape mapping. But verify.

**Git commit**: `git add -A && git commit -m "feat: update frontend for convex date formats" && git push origin feat/convex-migration`

---

## Phase 9: Infrastructure (Dockerfile, supervisord, entrypoint)

### Modify `Dockerfile`

This is critical. The Dockerfile must:

1. Extract the Convex backend binary from the official Docker image
2. Build the Next.js app
3. Bundle the worker
4. Set up the production image with Convex binary, Next.js, worker, and convex function sources

**New Dockerfile structure** (replace the current one entirely):

**Stage 1 — Convex Binary Source:**

```
FROM ghcr.io/get-convex/convex-backend:latest AS convex
```

This stage exists solely to copy the Convex backend binary and scripts.

**Stage 2 — Builder (same concept as current):**

- Base: `node:20` (NOT alpine — the Convex binary likely requires glibc. Verify in Phase 0 research. If the Convex image is based on Alpine/musl, keep alpine.)
- Copy `package*.json`, run `npm ci`
- Copy all source files
- Remove dotenv from worker.ts (same sed command as current)
- Set dummy env vars for build
- Run `npm run build` (Next.js)
- Run `npx esbuild worker.ts --bundle --platform=node --outfile=worker.js --alias:@=.` (same as current)

**Stage 3 — Production Runner:**

- Base: `node:20-slim` (NOT alpine, matching the builder for glibc compatibility)
- Set `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`
- Install system deps: `supervisor`, `ca-certificates`, `curl` (for healthchecks). Remove `unzip` and `wget` (no longer downloading PocketBase zip).
- **Copy Convex binary** from Stage 1 — `COPY --from=convex <path-to-binary> /app/convex-backend` (use the path found in Phase 0 research)
- **Copy generate_admin_key.sh** from Stage 1 — `COPY --from=convex <path-to-script> /app/generate_admin_key.sh`
- Make both executable: `chmod +x /app/convex-backend /app/generate_admin_key.sh`
- Create Convex data directory: `mkdir -p /app/convex_data`
- Copy Next.js standalone build (same as current)
- Copy `worker.js` (same as current)
- Copy `convex/` directory from builder (needed for function deployment at startup)
- Copy `supervisord.conf` and `entrypoint.sh` from builder
- Install `convex` npm package globally: `npm install -g convex` (needed for `npx convex deploy` in entrypoint)
- Set ownership, switch to non-root user
- Expose port 3000
- Entrypoint and CMD same pattern as current

**REMOVE** from current Dockerfile:

- PocketBase download (`ADD https://github.com/pocketbase/pocketbase/releases/...`)
- `pb_migrations` copy
- `unzip` dependency

### Modify `supervisord.conf`

Replace the `[program:pocketbase]` section with `[program:convex-backend]`:

```
[program:convex-backend]
command=/app/convex-backend
environment=CONVEX_CLOUD_ORIGIN="http://127.0.0.1:3210",CONVEX_SITE_ORIGIN="http://127.0.0.1:3211",INSTANCE_SECRET="%(ENV_INSTANCE_SECRET)s"
directory=/app/convex_data
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
autostart=true
autorestart=true
priority=1
```

**IMPORTANT**: Search Google for the exact environment variables the Convex backend needs. At minimum: `CONVEX_CLOUD_ORIGIN`, `CONVEX_SITE_ORIGIN`, `INSTANCE_SECRET`. There may be more. Use what you found in Phase 0 research.

Set `priority=1` for convex-backend (starts first), `priority=10` for nextjs, `priority=10` for worker. This ensures the backend is running before the app tries to connect.

Keep `[program:nextjs]` and `[program:worker]` sections mostly the same. No changes needed to their commands.

### Modify `entrypoint.sh`

Replace the PocketBase superuser upsert with Convex function deployment:

```
#!/bin/sh
set -e

# 1. Start Convex backend in background for initial setup
/app/convex-backend &
CONVEX_PID=$!

# 2. Wait for Convex to be healthy
echo "Waiting for Convex backend to start..."
n=0
until curl -sf http://127.0.0.1:3210/version > /dev/null 2>&1; do
  n=$((n + 1))
  if [ $n -ge 60 ]; then
    echo "ERROR: Convex backend failed to start after 60 seconds"
    exit 1
  fi
  sleep 1
done
echo "Convex backend is healthy."

# 3. Generate admin key (if not already set)
if [ -z "$CONVEX_ADMIN_KEY" ]; then
  echo "Generating Convex admin key..."
  CONVEX_ADMIN_KEY=$(/app/generate_admin_key.sh)
  export CONVEX_ADMIN_KEY
  echo "Admin key generated."
fi

# 4. Deploy Convex functions to local backend
echo "Deploying Convex functions to local backend..."
CONVEX_SELF_HOSTED_URL="http://127.0.0.1:3210" \
CONVEX_SELF_HOSTED_ADMIN_KEY="$CONVEX_ADMIN_KEY" \
npx convex deploy --yes
echo "Local deployment complete."

# 5. Deploy Convex functions to cloud backup (if configured)
if [ -n "$CONVEX_CLOUD_URL" ] && [ -n "$CONVEX_CLOUD_DEPLOY_KEY" ]; then
  echo "Deploying Convex functions to cloud backup..."
  CONVEX_URL="$CONVEX_CLOUD_URL" \
  CONVEX_DEPLOY_KEY="$CONVEX_CLOUD_DEPLOY_KEY" \
  npx convex deploy --yes
  echo "Cloud deployment complete."
fi

# 6. Stop the temporary Convex backend (supervisord will manage it)
kill $CONVEX_PID 2>/dev/null || true
wait $CONVEX_PID 2>/dev/null || true

# 7. Hand off to supervisord
exec "$@"
```

**IMPORTANT**: The exact environment variable names for `npx convex deploy` targeting a self-hosted instance may differ. Use the findings from Phase 0 research. The key variables are likely `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY` for self-hosted, and `CONVEX_URL` + `CONVEX_DEPLOY_KEY` for cloud. Verify by running `npx convex deploy --help`.

**Git commit**: `git add -A && git commit -m "feat: update dockerfile, supervisord, and entrypoint for convex" && git push origin feat/convex-migration`

---

## Phase 10: Cleanup

### Delete these files/directories:

- `pb_migrations/` — entire directory (PocketBase migrations no longer needed)
- `pocketbase` binary in project root (if tracked in git)
- `pb_data/` directory
- `proxy.ts` — if it was only for PocketBase proxying
- `setup_test_state.ts` — if it references PocketBase
- `debug_sessions.ts` — if it references PocketBase

### Update these documentation files:

- `README.md` — replace all references to PocketBase with Convex. Update architecture section, tech stack section, and any PocketBase-specific instructions.
- `backend_design_principles.md` — update "Runtime Architecture" section to reference Convex instead of PocketBase
- `GEMINI.md` — update any PocketBase references
- `project_overview.md` — update if it references PocketBase

### Update `.gitignore`:

- Remove PocketBase-related entries (`pb_data/`, `pocketbase`)
- Add Convex-related entries: `convex/_generated/` (auto-generated by Convex CLI), `.convex/`

**Git commit**: `git add -A && git commit -m "chore: cleanup pocketbase artifacts, update docs and gitignore" && git push origin feat/convex-migration`

### Update `.env.local`:

- Remove `POCKETBASE_URL`, `POCKETBASE_ADMIN_EMAIL`, `POCKETBASE_ADMIN_PASSWORD`
- Add `CONVEX_URL=http://127.0.0.1:3210`, `CONVEX_ADMIN_KEY=<placeholder>`, `CONVEX_CLOUD_URL=<placeholder>`, `CONVEX_CLOUD_DEPLOY_KEY=<placeholder>`

### Update `.dockerignore`:

- Remove PocketBase-related entries
- Add `convex/_generated/` if appropriate

---

## Verification Checklist

After completing all phases, verify:

1. [ ] `npm run build` succeeds without errors
2. [ ] No remaining imports of `pocketbase` package anywhere in the codebase (search for `from "pocketbase"` and `from 'pocketbase'`)
3. [ ] No remaining imports of `getAuthenticatedPocketBase` or `getPocketBase` anywhere
4. [ ] No remaining references to `parsePocketBaseDate` anywhere
5. [ ] No remaining references to `pb_migrations` anywhere
6. [ ] The `convex/schema.ts` file defines all three tables correctly
7. [ ] All Convex functions in `convex/` compile (run `npx convex typecheck` if available, or just verify TypeScript compilation)
8. [ ] The Dockerfile builds successfully: `docker build -t hia-test .`
9. [ ] All API routes import from `lib/backend/convex` instead of `lib/backend/pocketbase`
10. [ ] The sync layer is imported and called in `derivation.ts` (write-time replication) and `worker.ts` (periodic reconciliation + bootstrap)
11. [ ] `supervisord.conf` has `convex-backend` section, NOT `pocketbase` section
12. [ ] `entrypoint.sh` deploys Convex functions, does NOT upsert PocketBase superuser

---

## Execution Order

Execute the phases in this exact order:

1. **Git Setup** (create `feat/convex-migration` branch)
2. Phase 0 (Research) — MUST be done first, no commit
3. Phase 1 (Dependencies) → commit
4. Phase 2 (Convex schema + functions) → commit
5. Phase 3 (Client infrastructure) → commit
6. Phase 4 (Sync layer) → commit
7. Phase 5 (Backend logic) → commit
8. Phase 6 (API routes) → commit
9. Phase 7 (Worker) → commit
10. Phase 8 (Frontend) → commit
11. Phase 9 (Infrastructure) → commit
12. Phase 10 (Cleanup) → commit
13. Verification checklist

Do NOT skip phases or change the order. Each phase depends on the previous ones.
Do NOT forget to commit and push after each phase as specified.
