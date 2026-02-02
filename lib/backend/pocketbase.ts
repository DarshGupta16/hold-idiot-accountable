import PocketBase from "pocketbase";
import { config } from "./config";

// No singleton for server-side to ensure isolation per request
export function getPocketBase() {
  const pb = new PocketBase(config.pocketbaseUrl);
  // Disable auto-cancellation for server-side requests to prevent aborted fetch errors
  pb.autoCancellation(false);
  return pb;
}

/**
 * Returns a PocketBase instance authenticated as the admin.
 * Use this for backend operations that require elevated privileges.
 */
export async function getAuthenticatedPocketBase() {
  const client = getPocketBase();

  if (!config.adminEmail || !config.adminPassword) {
    throw new Error("POCKETBASE_ADMIN credentials are not defined in config.");
  }

  try {
    await client.admins.authWithPassword(
      config.adminEmail,
      config.adminPassword,
    );
  } catch (e) {
    console.error("Failed to authenticate PocketBase admin:", e);
    throw new Error("Failed to authenticate PocketBase admin");
  }

  return client;
}
