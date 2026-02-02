import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { WebhookEventSchema, EventType } from "@/lib/backend/types";
import {
  processHeartbeat,
  processSessionStart,
  processSessionStop,
  processBlocklistEvent,
} from "@/lib/backend/derivation";

export async function POST(req: NextRequest) {
  // 1. Authorization Check
  const authKey = req.headers.get("x-hia-access-key");
  if (authKey !== process.env.HIA_HOMELAB_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Body Parsing & Validation
    const body = await req.json();
    const event = WebhookEventSchema.parse(body);

    // 3. Logic Dispatch
    switch (event.event_type) {
      case EventType.HEARTBEAT:
        await processHeartbeat(event);
        break;
      case EventType.SESSION_START:
        await processSessionStart(event);
        break;
      case EventType.SESSION_STOP:
        await processSessionStop(event);
        break;
      case EventType.BLOCKLIST_EVENT:
        await processBlocklistEvent(event);
        break;
    }

    return NextResponse.json({
      success: true,
      processed_event: event.event_type,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation Error", details: error.issues },
        { status: 400 },
      );
    }

    // Invariant violations or other logic errors
    if (error instanceof Error && error.message.includes("Invariant")) {
      return NextResponse.json({ error: error.message }, { status: 409 }); // Conflict
    }

    console.error("Webhook Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
