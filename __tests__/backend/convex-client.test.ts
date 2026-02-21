import { describe, it, expect, mock, beforeEach } from "bun:test";

class MockConvexHttpClient {
  url: string;
  options: any;
  constructor(url: string, options: any) {
    this.url = url;
    this.options = options;
  }
}

mock.module("convex/browser", () => ({
  ConvexHttpClient: MockConvexHttpClient,
}));

mock.module("@/lib/backend/config", () => ({
  config: {
    convexUrl: "http://local-test",
    convexAdminKey: "admin-key",
    convexCloudUrl: "http://cloud-test",
    convexCloudDeployKey: "deploy-key",
  },
}));

describe("convex-client", () => {
  beforeEach(() => {
    // @ts-ignore
    delete require.cache[require.resolve("@/lib/backend/convex")];
  });

  it("getLocalClient() returns a ConvexHttpClient with correct config", async () => {
    const { getLocalClient } = await import("@/lib/backend/convex");
    const client = getLocalClient() as any;
    expect(client.url).toBe("http://local-test");
    expect(client).toBeDefined();
  });

  it("getCloudClient() returns a client when cloud URL is set", async () => {
    const { getCloudClient } = await import("@/lib/backend/convex");
    const client = getCloudClient() as any;
    expect(client.url).toBe("http://cloud-test");
    expect(client).not.toBeNull();
  });

  it("getCloudClient() returns null when cloud URL is missing", async () => {
    mock.module("@/lib/backend/config", () => ({
      config: {
        convexUrl: "http://local-test",
        convexAdminKey: "admin-key",
        convexCloudUrl: "",
        convexCloudDeployKey: "",
      },
    }));
    
    const { getCloudClient: getCloudClientReloaded } = await import("@/lib/backend/convex");
    const client = getCloudClientReloaded();
    expect(client).toBeNull();
  });
});
