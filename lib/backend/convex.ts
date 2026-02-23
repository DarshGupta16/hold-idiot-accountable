import { ConvexHttpClient } from "convex/browser";
import { config } from "@/lib/backend/config";

let localClient: ConvexHttpClient | null = null;
let cloudClient: ConvexHttpClient | null = null;

/**
 * Returns a Convex HTTP client for the local backend.
 * Uses the admin key for full access.
 */
export function getLocalClient(): ConvexHttpClient {
  if (!localClient) {
    const convexUrl = config.convexUrl;
    const adminKey = config.convexAdminKey;

    if (!adminKey) {
      console.warn("[Convex] CONVEX_ADMIN_KEY is not set. Local client may be unauthenticated.");
    }

    // Custom fetch to inject the admin key
    const customFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const headers = new Headers(init?.headers);
      if (adminKey) {
        headers.set("Authorization", `Convex ${adminKey}`);
      }

      return fetch(input, {
        ...init,
        headers,
      });
    };

    localClient = new ConvexHttpClient(convexUrl, {
      fetch: customFetch as any,
    });
  }
  return localClient;
}

/**
 * Returns a Convex HTTP client for the cloud backend (backup).
 * Returns null if CONVEX_CLOUD_URL is not configured.
 */
export function getCloudClient(): ConvexHttpClient | null {
  if (!cloudClient) {
    const cloudUrl = config.convexCloudUrl;
    const deployKey = config.convexCloudDeployKey;

    if (!cloudUrl) {
      return null;
    }

    // Custom fetch to inject the cloud deploy key
    const customFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const headers = new Headers(init?.headers);
      if (deployKey) {
        headers.set("Authorization", `Convex ${deployKey}`);
      }

      return fetch(input, {
        ...init,
        headers,
      });
    };

    cloudClient = new ConvexHttpClient(cloudUrl, {
      fetch: customFetch as any,
    });
  }
  return cloudClient;
}
