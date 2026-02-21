import { getLocalClient, getCloudClient } from "./convex";
import { api } from "../../convex/_generated/api";
import crypto from "crypto";

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

      if (data.sessions.length > 0 || data.logs.length > 0 || data.variables.length > 0) {
        await local.mutation(api.sync.importAll, {
          sessions: data.sessions,
          logs: data.logs,
          variables: data.variables,
        });
        console.log(
          `[Sync] Bootstrapped from cloud: ${data.sessions.length} sessions, ${data.logs.length} logs, ${data.variables.length} variables`
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
  args: any
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
    console.error(`[Sync] Replication failed for ${table}.${operation}:`, error);
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
    const localHash = await local.query(api.sync.computeHash);
    const cloudHash = await cloud.query(api.sync.computeHash);

    const localSha = crypto.createHash("sha256").update(localHash).digest("hex");
    const cloudSha = crypto.createHash("sha256").update(cloudHash).digest("hex");

    if (localSha === cloudSha) {
      console.log("[Sync] Hashes match, no reconciliation needed.");
      return;
    }

    console.log("[Sync] MISMATCH detected. Overwriting cloud with local data.");
    
    // Clear cloud
    await cloud.mutation(api.sync.clearAll);
    
    // Export from local
    const data = await local.query(api.sync.exportAll);
    
    // Import to cloud
    await cloud.mutation(api.sync.importAll, {
      sessions: data.sessions,
      logs: data.logs,
      variables: data.variables,
    });

    console.log("[Sync] Cloud overwritten successfully.");
  } catch (error) {
    console.error("[Sync] Error during reconciliation:", error);
  }
}
