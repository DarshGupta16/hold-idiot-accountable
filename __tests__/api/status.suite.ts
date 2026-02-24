import { describe, it, expect } from "bun:test";
import { NextRequest } from "next/server";
import { GET as getStatus } from "@/app/api/client/status/route";

export function runStatusApiSuite(mockLocal: any, mockAuth: any) {
  describe("GET /api/client/status", () => {
    it("returns 401 when unauthorized", async () => {
      mockAuth.verifySession.mockResolvedValue(false);
      mockAuth.verifyHomelabKey.mockResolvedValue(false);

      const req = new NextRequest("http://localhost/api/client/status");
      const res = await getStatus(req);

      expect(res.status).toBe(401);
    });

    it("returns data when authorized", async () => {
      mockAuth.verifySession.mockResolvedValue(true);
      mockLocal.query.mockResolvedValueOnce({ _id: "s1", _creationTime: Date.now(), started_at: "...", planned_duration_sec: 100 }); // activeSession
      mockLocal.query.mockResolvedValueOnce({ value: { timestamp: "..." } }); // heartbeat
      mockLocal.query.mockResolvedValueOnce(null); // summary
      mockLocal.query.mockResolvedValueOnce(null); // blocklist
      mockLocal.query.mockResolvedValueOnce(null); // break
      mockLocal.query.mockResolvedValueOnce([]); // logs
      
      const req = new NextRequest("http://localhost/api/client/status");
      const res = await getStatus(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.activeSession.id).toBe("s1");
    });
  });
}
