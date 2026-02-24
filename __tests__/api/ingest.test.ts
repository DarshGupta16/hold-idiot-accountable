import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/webhooks/ingest/route';
import { NextRequest } from 'next/server';
import { verifyHomelabKey } from '@/lib/backend/auth';
import {
  processHeartbeat,
  processSessionStart,
  processBreakStart,
  processBreakStop,
} from "@/lib/backend/derivation";

vi.mock("@/lib/backend/auth", () => ({
  verifyHomelabKey: vi.fn(),
}));

vi.mock("@/lib/backend/derivation", () => ({
  processHeartbeat: vi.fn(),
  processSessionStart: vi.fn(),
  processBreakStart: vi.fn(),
  processBreakStop: vi.fn(),
  processSessionStop: vi.fn(),
  processBlocklistEvent: vi.fn(),
}));

describe("POST /api/webhooks/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthorized", async () => {
    (verifyHomelabKey as any).mockResolvedValue(false);
    const req = new NextRequest("http://localhost/api/webhooks/ingest", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("dispatches heartbeat event", async () => {
    (verifyHomelabKey as any).mockResolvedValue(true);
    const payload = {
      event_type: "HEARTBEAT",
      timestamp: new Date().toISOString(),
      machine_id: "mac1",
    };
    
    const req = new NextRequest("http://localhost/api/webhooks/ingest", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.processed_event).toBe("HEARTBEAT");
    expect(processHeartbeat).toHaveBeenCalledWith(expect.objectContaining(payload));
  });

  it("dispatches break start event", async () => {
    (verifyHomelabKey as any).mockResolvedValue(true);
    const payload = {
      event_type: "BREAK_START",
      timestamp: new Date().toISOString(),
      duration_sec: 600,
      next_session: {
        subject: "Post-break study",
        planned_duration_sec: 1800,
        blocklist: [],
      },
    };

    const req = new NextRequest("http://localhost/api/webhooks/ingest", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(processBreakStart).toHaveBeenCalledWith(expect.objectContaining(payload));
  });

  it("dispatches break stop event", async () => {
    (verifyHomelabKey as any).mockResolvedValue(true);
    const payload = {
      event_type: "BREAK_STOP",
      timestamp: new Date().toISOString(),
      reason: "Manual interruption",
    };

    const req = new NextRequest("http://localhost/api/webhooks/ingest", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(processBreakStop).toHaveBeenCalledWith(expect.objectContaining(payload));
  });

  it("returns 409 on invariant violation", async () => {
    (verifyHomelabKey as any).mockResolvedValue(true);
    (processSessionStart as any).mockRejectedValue(new Error('Invariant Violation: ...'));

    const payload = {
      event_type: 'SESSION_START',
      timestamp: new Date().toISOString(),
      planned_duration_sec: 3600,
      subject: 'Test',
    };

    const req = new NextRequest('http://localhost/api/webhooks/ingest', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const res = await POST(req);
    
    expect(res.status).toBe(409);
  });
});
