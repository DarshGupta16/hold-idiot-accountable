/**
 * Cold-start bootstrap: pulls data from cloud Convex into local if local is empty.
 * Called from entrypoint.sh before supervisord starts.
 * Usage: node bootstrap.js <ADMIN_KEY> <CLOUD_URL> <CLOUD_DEPLOY_KEY>
 */
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const api = anyApi;
const [, , adminKey, cloudUrl, cloudDeployKey] = process.argv;

function createAuthenticatedClient(url: string, key: string): ConvexHttpClient {
  const customFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Convex ${key}`);
    return fetch(input, { ...init, headers });
  };

  return new ConvexHttpClient(url, { fetch: customFetch as typeof fetch });
}

async function bootstrap() {
  const local = createAuthenticatedClient("http://127.0.0.1:3210", adminKey);

  // Check if local has any data
  const sc = (await local.query(api.studySessions.count, {})) as number;
  const lc = (await local.query(api.logs.count, {})) as number;
  const vc = (await local.query(api.variables.count, {})) as number;
  const total = sc + lc + vc;
  console.log("[bootstrap] Local record count: " + total);

  if (total > 0) {
    console.log("[bootstrap] Local DB already has data, skipping.");
    return;
  }

  // Connect to cloud
  const cloud = createAuthenticatedClient(cloudUrl, cloudDeployKey);

  // Pull data from cloud
  const data = (await cloud.query(api.sync.exportAll, {})) as {
    sessions: unknown[];
    logs: unknown[];
    variables: unknown[];
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
