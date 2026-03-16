import { NextRequest, NextResponse } from "next/server";
import { getLocalClient, getCloudClient } from "@/lib/backend/convex";
import { internal } from "@/convex/_generated/api";
import { verifySession } from "@/lib/backend/auth";
import { APP_UPDATE_VAR_KEY } from "@/lib/backend/variables";
import { asPublic } from "@/lib/backend/types";

export async function POST(req: NextRequest) {
  const isAuthenticated = await verifySession(req);
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const local = getLocalClient();
  const cloud = getCloudClient();

  try {
    let current;
    if (cloud) {
      current = await cloud.query(asPublic(internal.variables.getByKey), { key: APP_UPDATE_VAR_KEY });
    } else {
      current = await local.query(asPublic(internal.variables.getByKey), { key: APP_UPDATE_VAR_KEY });
    }

    if (!current || !current.value) {
      return NextResponse.json({ success: true, message: "No update to acknowledge" });
    }

    const updatedValue = {
      ...(current.value as object),
      seen: true,
    };

    if (cloud) {
      await cloud.mutation(asPublic(internal.variables.upsert), {
        key: APP_UPDATE_VAR_KEY,
        value: updatedValue,
      });
      console.log(`[UpdateAck] Acknowledged update in cloud DB: ${APP_UPDATE_VAR_KEY}`);
    }

    await local.mutation(asPublic(internal.variables.upsert), {
      key: APP_UPDATE_VAR_KEY,
      value: updatedValue,
    });
    console.log(`[UpdateAck] Acknowledged update in local DB: ${APP_UPDATE_VAR_KEY}`);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Failed to acknowledge update:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
