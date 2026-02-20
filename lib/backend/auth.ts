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
  } catch {
    return false;
  }
}

/**
 * Verifies the homelab access key in the request headers.
 * Uses timing-safe comparison to prevent side-channel attacks.
 */
export async function verifyHomelabKey(req: NextRequest): Promise<boolean> {
  const authKey = req.headers.get("x-hia-access-key")?.trim();
  const correctKey = config.hiaHomelabKey?.trim();

  if (!authKey || !correctKey) {
    if (!correctKey) {
      console.warn("[Auth] HIA_HOMELAB_KEY is not set in environment variables.");
    }
    return false;
  }

  // Hash both keys for safe comparison (ensures equal length)
  const inputHash = crypto.createHash("sha256").update(authKey).digest();
  const targetHash = crypto.createHash("sha256").update(correctKey).digest();

  try {
    const isValid = crypto.timingSafeEqual(inputHash, targetHash);
    if (!isValid) {
      console.warn("[Auth] Homelab key mismatch.");
    }
    return isValid;
  } catch (e) {
    console.error("[Auth] Error during timingSafeEqual:", e);
    return false;
  }
}
