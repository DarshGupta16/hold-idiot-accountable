import { describe, it, expect } from "bun:test";
import { NextRequest } from "next/server";
import { POST as ingest } from "@/app/api/webhooks/ingest/route";

export function runIngestApiSuite() {
  describe("POST /api/webhooks/ingest", () => {
    it("dispatches", async () => {
      const payload = { event_type: "HEARTBEAT", timestamp: new Date().toISOString(), machine_id: "m1" };
      const req = new NextRequest("http://localhost/ingest", { method: "POST", body: JSON.stringify(payload) });
      const res = await ingest(req);
      expect(res.status).toBe(200);
    });
  });
}
