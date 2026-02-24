import { describe, it, expect } from "bun:test";
import { NextRequest } from "next/server";
import { POST as acknowledge } from "@/app/api/client/acknowledge/route";

export function runAcknowledgeApiSuite(mockLocal: any) {
  describe("POST /api/client/acknowledge", () => {
    it("updates metadata", async () => {
      mockLocal.query.mockResolvedValue([{ _id: "l1", metadata: {} }]);
      const req = new NextRequest("http://localhost/ack", { method: "POST" });
      const res = await acknowledge(req);
      expect(res.status).toBe(200);
      expect(mockLocal.mutation).toHaveBeenCalled();
    });
  });
}
