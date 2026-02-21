import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";

describe("config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Bun's equivalent of resetting modules is manually clearing require.cache
    // @ts-ignore
    delete require.cache[require.resolve("@/lib/backend/config")];
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("reads environment variables correctly", async () => {
    process.env.CONVEX_URL = "http://test-url";
    process.env.CONVEX_ADMIN_KEY = "test-admin-key";
    
    const { config } = await import("@/lib/backend/config");
    
    expect(config.convexUrl).toBe("http://test-url");
    expect(config.convexAdminKey).toBe("test-admin-key");
  });

  it("applies default value for CONVEX_URL", async () => {
    delete process.env.CONVEX_URL;
    
    const { config } = await import("@/lib/backend/config");
    
    expect(config.convexUrl).toBe("http://127.0.0.1:3210");
  });

  it("logs warning when CONVEX_ADMIN_KEY is missing on server", async () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    delete process.env.CONVEX_ADMIN_KEY;
    
    // Simulate server-side
    const originalWindow = global.window;
    // @ts-ignore
    delete global.window;
    
    await import("@/lib/backend/config");
    
    expect(warnSpy).toHaveBeenCalled();
    
    global.window = originalWindow;
    warnSpy.mockRestore();
  });
});
