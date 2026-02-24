import { describe, it, expect } from "bun:test";
import { processHeartbeat, processSessionStart } from "@/lib/backend/derivation";

export function runDerivationSuite(mockLocal: any) {
  describe("Derivation", () => {
    it("processHeartbeat updates variables", async () => {
      await processHeartbeat({ timestamp: "...", machine_id: "m1", event_type: "HEARTBEAT" as any });
      expect(mockLocal.mutation).toHaveBeenCalled();
    });

    it("processSessionStart creates records", async () => {
      mockLocal.query.mockResolvedValue(null);
      await processSessionStart({
        planned_duration_sec: 100,
        subject: "test",
        blocklist: [],
        event_type: "SESSION_START" as any,
        timestamp: "..."
      });
      expect(mockLocal.mutation).toHaveBeenCalled();
    });
  });
}
