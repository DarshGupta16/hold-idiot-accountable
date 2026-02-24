import { describe, it, expect } from "bun:test";
import { getActiveSession, ensureNoActiveSession } from "@/lib/backend/invariants";

export function runInvariantsSuite(mockLocal: any) {
  describe("Invariants", () => {
    it("getActiveSession returns session", async () => {
      mockLocal.query.mockResolvedValue({ _id: "s1", _creationTime: Date.now() });
      const s = await getActiveSession();
      expect(s).toEqual(expect.objectContaining({ _id: "s1" }) as any);
    });

    it("ensureNoActiveSession throws if exists", async () => {
      mockLocal.query.mockResolvedValue({ _id: "s1", _creationTime: Date.now() });
      expect(ensureNoActiveSession()).rejects.toThrow();
    });
  });
}
