import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { WebhookEventSchema, EventType } from "@/lib/backend/types";
import {
  processHeartbeat,
  processSessionStart,
  processSessionStop,
  processBlocklistEvent,
  processBreakStart,
  processBreakStop,
} from "@/lib/backend/derivation";
import { verifyHomelabKey } from "@/lib/backend/auth";

// Rate Limiter for Failed Webhook Auth
// IP -> { count, expires }
const failedAuthRateLimit = new Map<string, { count: number; expires: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_FAILED_ATTEMPTS = 10;

export async function POST(req: NextRequest) {
  // 1. Rate Limit Check (Failed Auth Only)
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0] : "unknown";
  const now = Date.now();
  const limitRecord = failedAuthRateLimit.get(ip);

  if (limitRecord) {
    if (now > limitRecord.expires) {
      failedAuthRateLimit.delete(ip);
    } else if (limitRecord.count >= MAX_FAILED_ATTEMPTS) {
      console.warn(`[Webhook] Rate limit exceeded for IP: ${ip}`);
      return NextResponse.json({ error: "Too many failed attempts" }, { status: 429 });
    }
  }

  // 2. Authorization Check (Centralized verifyHomelabKey)
  const isAuthenticated = await verifyHomelabKey(req);

  if (!isAuthenticated) {
    // Record failed attempt
    const current = failedAuthRateLimit.get(ip) || {
      count: 0,
      expires: now + RATE_LIMIT_WINDOW,
    };
    failedAuthRateLimit.set(ip, {
      count: current.count + 1,
      expires: current.expires,
    });

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Clear failure record on success (optional, but good for legitimate IPs that typo'd)
  if (limitRecord) failedAuthRateLimit.delete(ip);

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
      case EventType.BREAK_START:
        await processBreakStart(event);
        break;
      case EventType.BREAK_STOP:
        await processBreakStop(event);
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
