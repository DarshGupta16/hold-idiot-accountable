import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { config } from "@/lib/backend/config";
import crypto from "crypto";

// Simple in-memory rate limiter: IP -> { count, expires }
const rateLimit = new Map<string, { count: number; expires: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting Logic
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0] : "unknown";
    const now = Date.now();
    const record = rateLimit.get(ip);

    if (record) {
      if (now > record.expires) {
        rateLimit.delete(ip);
      } else if (record.count >= MAX_ATTEMPTS) {
        console.warn(`[Auth] Rate limit exceeded for IP: ${ip}`);
        return NextResponse.json(
          { error: "Too many login attempts. Please try again later." },
          { status: 429 },
        );
      }
    }

    const body = await req.json();
    const { password } = body;

    const correctPassword = config.hiaClientPassword;

    if (!correctPassword) {
      console.error("HIA_CLIENT_PASSWORD is not set in environment variables");
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 },
      );
    }

    // 2. Timing-Safe Comparison
    // Hash both passwords to ensure we compare buffers of equal length
    const inputHash = crypto
      .createHash("sha256")
      .update(password || "")
      .digest();
    const targetHash = crypto
      .createHash("sha256")
      .update(correctPassword)
      .digest();

    if (!crypto.timingSafeEqual(inputHash, targetHash)) {
      // Increment failure count
      const current = rateLimit.get(ip) || {
        count: 0,
        expires: now + RATE_LIMIT_WINDOW,
      };
      rateLimit.set(ip, {
        count: current.count + 1,
        expires: current.expires,
      });

      return NextResponse.json(
        { error: "Invalid access key" },
        { status: 401 },
      );
    }

    // Reset rate limit on success
    if (record) rateLimit.delete(ip);

    // 3. Create session token (Use dedicated secret if available)
    const secretKey = config.hiaJwtSecret || config.hiaClientPassword || "";
    const secret = new TextEncoder().encode(secretKey);
    const alg = "HS256";

    const jwt = await new SignJWT({ "urn:hia:claim": true })
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setExpirationTime("30d") // Long session, purely device access
      .sign(secret);

    const response = NextResponse.json({ success: true });

    response.cookies.set("hia_session", jwt, {
      httpOnly: true,
      secure: config.isProd,
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
