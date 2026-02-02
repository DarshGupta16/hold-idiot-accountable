import { NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Verifies the HIA session cookie to ensure the request is authenticated.
 * This is a server-side check to complement the middleware.
 */
export async function verifySession(req: NextRequest): Promise<boolean> {
  const cookie = req.cookies.get("hia_session");

  if (!cookie) {
    return false;
  }

  try {
    const secret = new TextEncoder().encode(process.env.HIA_CLIENT_PASSWORD);
    await jwtVerify(cookie.value, secret);
    return true;
  } catch (err) {
    return false;
  }
}
