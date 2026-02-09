import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { config as appConfig } from "@/lib/backend/config";

/**
 * Middleware Proxy
 * Handles authentication for protected routes via session cookies.
 * Skips public paths, static assets, and API webhooks.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Public Path Exclusion
  if (
    pathname.startsWith("/api/webhooks") || // Protected by API Key, not cookie
    pathname.startsWith("/api/auth") || // Auth endpoints
    pathname.startsWith("/_next") || // Next.js internals
    pathname === "/favicon.ico" ||
    pathname === "/login"
  ) {
    return NextResponse.next();
  }

  // 2. Session Check (Allow status API if homelab key is present)
  const cookie = req.cookies.get("hia_session");
  const hasHomelabKey = req.headers.has("x-hia-access-key");

  if (!cookie && !(pathname === "/api/client/status" && hasHomelabKey)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    // 3. Verify Signature
    // Only verify if we actually have a cookie (we might be here via homelab key)
    if (cookie) {
      const secretKey = appConfig.hiaJwtSecret || appConfig.hiaClientPassword || "";
      const secret = new TextEncoder().encode(secretKey);
      await jwtVerify(cookie.value, secret);
    }

    return NextResponse.next();
  } catch (_err) {
    // Invalid/Expired Token
    const response =
      pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        : NextResponse.redirect(new URL("/login", req.url));

    response.cookies.delete("hia_session");
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/webhooks
     * - _next/static
     * - _next/image
     * - favicon.ico
     */
    "/((?!api/webhooks|_next/static|_next/image|favicon.ico).*)",
  ],
};
