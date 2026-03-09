import { NextRequest, NextResponse } from "next/server";
import { getLocalClient, getCloudClient } from "@/lib/backend/convex";
import { api } from "@/convex/_generated/api";
import { verifySession } from "@/lib/backend/auth";
import { APP_UPDATE_VAR_KEY } from "@/lib/backend/variables";

export async function POST(req: NextRequest) {
  const isAuthenticated = await verifySession(req);
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const local = getLocalClient();
  const cloud = getCloudClient();

  try {
    // 1. Get the current value from cloud (or local if cloud is unavailable)
    let current;
    if (cloud) {
      current = await cloud.query(api.variables.getByKey, { key: APP_UPDATE_VAR_KEY });
    } else {
      current = await local.query(api.variables.getByKey, { key: APP_UPDATE_VAR_KEY });
    }

    if (!current) {
      return NextResponse.json({ error: "No update found" }, { status: 404 });
    }

    const updatedValue = {
      ...current.value,
      seen: true,
      isNew: false, // Once acknowledged, it's no longer "new"
    };

    // 2. Update cloud first (if available) - source of truth
    if (cloud) {
      await cloud.mutation(api.variables.upsert, {
        key: APP_UPDATE_VAR_KEY,
        value: updatedValue,
      });
      console.log(`[UpdateAck] Acknowledged update in cloud DB: ${APP_UPDATE_VAR_KEY}`);
    }

    // 3. Update local to reflect immediately
    await local.mutation(api.variables.upsert, {
      key: APP_UPDATE_VAR_KEY,
      value: updatedValue,
    });
    console.log(`[UpdateAck] Acknowledged update in local DB: ${APP_UPDATE_VAR_KEY}`);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Failed to acknowledge update:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
