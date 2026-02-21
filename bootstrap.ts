/**
 * Cold-start bootstrap: pulls data from cloud Convex into local if local is empty.
 * Called from entrypoint.sh before supervisord starts.
 * Usage: node bootstrap.js <ADMIN_KEY> <CLOUD_URL> <CLOUD_DEPLOY_KEY>
 */
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const api = anyApi;
const [, , adminKey, cloudUrl, cloudDeployKey] = process.argv;

async function bootstrap() {
  const local = new ConvexHttpClient("http://127.0.0.1:3210");
  local.setAdminAuth(adminKey);

  // Check if local has any data
  const sc = await local.query(api.studySessions.count, {});
  const lc = await local.query(api.logs.count, {});
  const vc = await local.query(api.variables.count, {});
  const total = (sc as number) + (lc as number) + (vc as number);
  console.log("[bootstrap] Local record count: " + total);

  if (total > 0) {
    console.log("[bootstrap] Local DB already has data, skipping.");
    return;
  }

  // Connect to cloud
  const cloud = new ConvexHttpClient(cloudUrl);
  cloud.setAdminAuth(cloudDeployKey);

  // Pull data from cloud
  const data = (await cloud.query(api.sync.exportAll, {})) as {
    sessions: any[];
    logs: any[];
    variables: any[];
  };
  console.log(
    `[bootstrap] Cloud has: ${data.sessions.length} sessions, ${data.logs.length} logs, ${data.variables.length} variables`,
  );

  if (data.sessions.length + data.logs.length + data.variables.length === 0) {
    console.log("[bootstrap] Cloud is also empty.");
    return;
  }

  // Import to local
  await local.mutation(api.sync.importAll, {
    sessions: data.sessions,
    logs: data.logs,
    variables: data.variables,
  });
  console.log("[bootstrap] Successfully bootstrapped from cloud!");
}

bootstrap()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[bootstrap] Error:", e.message);
    process.exit(0); // Don't block startup
  });
