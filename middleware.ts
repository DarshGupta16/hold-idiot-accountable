import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip if it's the login page itself to avoid infinite loops
  if (pathname === "/login") {
    return NextResponse.next();
  }

  // 2. Check for the session cookie
  const cookie = request.cookies.get("hia_session");

  if (!cookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const secretKey = process.env.HIA_JWT_SECRET || process.env.HIA_CLIENT_PASSWORD || "";
    const secret = new TextEncoder().encode(secretKey);
    await jwtVerify(cookie.value, secret);
    return NextResponse.next();
  } catch (error) {
    console.warn("[Middleware] Invalid or expired session:", error);
    // Delete the invalid cookie and redirect to login
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("hia_session");
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes (they handle their own auth and return 401/403)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, manifest.json, etc. (public assets)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons|apple-touch-icon.png|sw.js|workbox-.*\\.js|.well-known).*)",
  ],
};
