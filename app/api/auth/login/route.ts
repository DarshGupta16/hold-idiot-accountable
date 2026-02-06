import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { config } from "@/lib/backend/config";

export async function POST(req: NextRequest) {
  try {
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

    if (password !== correctPassword) {
      return NextResponse.json(
        { error: "Invalid access key" },
        { status: 401 },
      );
    }

    // Create session token
    const secret = new TextEncoder().encode(config.hiaClientPassword || ""); // Use the password itself as secret for now, or better HIA_JWT_SECRET if available.
    // Plan didn't specify separate secret, but good practice. using password for simplicity given strict "shared secret" model.
    // Actually, let's look for a better secret if possible, or fallback.
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
