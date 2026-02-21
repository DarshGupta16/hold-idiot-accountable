import { getLocalClient, getCloudClient } from "./convex";
import { api } from "../../convex/_generated/api";

/**
 * On cold start, if local is empty, pull from cloud.
 */
export async function bootstrapFromCloud() {
  const local = getLocalClient();
  const cloud = getCloudClient();

  if (!cloud) return;

  try {
    const sessionCount = await local.query(api.studySessions.count);
    const logCount = await local.query(api.logs.count);
    const varCount = await local.query(api.variables.count);

    const total = sessionCount + logCount + varCount;

    if (total === 0) {
      console.log("[Sync] Local DB is empty. Bootstrapping from cloud...");
      const data = await cloud.query(api.sync.exportAll);

      if (
        data.sessions.length > 0 ||
        data.logs.length > 0 ||
        data.variables.length > 0
      ) {
        await local.mutation(api.sync.importAll, {
          sessions: data.sessions,
          logs: data.logs,
          variables: data.variables,
        });
        console.log(
          `[Sync] Bootstrapped from cloud: ${data.sessions.length} sessions, ${data.logs.length} logs, ${data.variables.length} variables`,
        );
      } else {
        console.log("[Sync] Cloud is also empty. Nothing to bootstrap.");
      }
    } else {
      console.log("[Sync] Local DB has data, skipping bootstrap.");
    }
  } catch (error) {
    console.error("[Sync] Error during bootstrap:", error);
  }
}

/**
 * Fire-and-forget replication to cloud.
 */
export async function replicateToCloud(
  table: string,
  operation: string,
  args: any,
) {
  const cloud = getCloudClient();
  if (!cloud) return;

  try {
    // Map the operation to the correct API call
    // This assumes the API structure matches the table name and operation name
    // e.g., table="logs", operation="create" -> api.logs.create
    const apiModule = (api as any)[table];
    if (apiModule && apiModule[operation]) {
      await cloud.mutation(apiModule[operation], args);
      console.log(`[Sync] Replicated ${operation} to cloud for ${table}`);
    } else {
      console.warn(`[Sync] Unknown API for replication: ${table}.${operation}`);
    }
  } catch (error) {
    console.error(
      `[Sync] Replication failed for ${table}.${operation}:`,
      error,
    );
  }
}

/**
 * Full state reconciliation between local and cloud.
 */
export async function reconcile() {
  const local = getLocalClient();
  const cloud = getCloudClient();

  if (!cloud) return;

  try {
    // Get counts from both sides
    const localSessions = await local.query(api.studySessions.count);
    const localLogs = await local.query(api.logs.count);
    const localVars = await local.query(api.variables.count);
    const localTotal = localSessions + localLogs + localVars;

    const cloudSessions = await cloud.query(api.studySessions.count);
    const cloudLogs = await cloud.query(api.logs.count);
    const cloudVars = await cloud.query(api.variables.count);
    const cloudTotal = cloudSessions + cloudLogs + cloudVars;

    console.log(
      `[Sync] Reconciliation check — Local: ${localSessions}s/${localLogs}l/${localVars}v (${localTotal}) | Cloud: ${cloudSessions}s/${cloudLogs}l/${cloudVars}v (${cloudTotal})`,
    );

    if (localTotal === 0 && cloudTotal > 0) {
      console.log(
        "[Sync] Local is empty but cloud has data — running bootstrap...",
      );
      await bootstrapFromCloud();
    } else if (localTotal > 0 && cloudTotal === 0) {
      // Cloud is empty but local has data — push local to cloud (safe, additive only)
      console.log(
        "[Sync] Cloud is empty but local has data — pushing to cloud...",
      );
      const data = await local.query(api.sync.exportAll);
      await cloud.mutation(api.sync.importAll, {
        sessions: data.sessions,
        logs: data.logs,
        variables: data.variables,
      });
      console.log("[Sync] Pushed local data to cloud.");
    } else {
      // Both have data — log only, never delete.
      // Per-write replication (replicateToCloud) handles ongoing sync.
      console.log(
        "[Sync] Both local and cloud have data. No destructive action taken.",
      );
    }
  } catch (error) {
    console.error("[Sync] Error during reconciliation:", error);
  }
}
