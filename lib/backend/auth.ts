import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { config } from "./config";
import crypto from "crypto";

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
    // Use config for cleaner access
    const secretKey = config.hiaJwtSecret || config.hiaClientPassword || "";
    const secret = new TextEncoder().encode(secretKey);
    await jwtVerify(cookie.value, secret);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Verifies the homelab access key in the request headers.
 * Uses timing-safe comparison to prevent side-channel attacks.
 */
export async function verifyHomelabKey(req: NextRequest): Promise<boolean> {
  const authKey = req.headers.get("x-hia-access-key");
  const correctKey = config.hiaHomelabKey;

  if (!authKey || !correctKey) {
    return false;
  }

  // Hash both keys for safe comparison (ensures equal length)
  const inputHash = crypto.createHash("sha256").update(authKey).digest();
  const targetHash = crypto.createHash("sha256").update(correctKey).digest();

  try {
    return crypto.timingSafeEqual(inputHash, targetHash);
  } catch (e) {
    return false;
  }
}
