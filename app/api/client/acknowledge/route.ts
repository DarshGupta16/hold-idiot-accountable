import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedPocketBase } from "@/lib/backend/pocketbase";
import { verifySession } from "@/lib/backend/auth";

export async function POST(req: NextRequest) {
  const isAuthenticated = await verifySession(req);
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pb = await getAuthenticatedPocketBase();

  try {
    // 1. Fetch all unacknowledged missed heartbeat logs
    // We check for type 'missed_heartbeat' and acknowledged != true
    // Note: PocketBase filters on JSON fields can be tricky.
    // It's safer/simpler to fetch recent logs and filter in memory if the volume is low,
    // OR use PB's filter syntax if supported for JSON.
    // Given the "append-only" nature and potential volume, we should try a DB filter.
    // PB syntax: `metadata.acknowledged != true` might not work directly depending on version.
    // However, we can fetch all `missed_heartbeat` type logs and update them.

    // For now, let's just fetch all unacknowledged ones.
    // Since we don't have a direct index on metadata fields, we might have to fetch recent headers.
    // But wait, "I am deleting all missed heartbeat logs from the database" - implies we can just handle new ones.

    // Let's try to find records where type='missed_heartbeat'
    const records = await pb.collection("logs").getFullList({
      filter: `type = "missed_heartbeat"`,
    });

    const unacknowledged = records.filter(
      (r) => r.metadata?.acknowledged !== true,
    );

    // 2. Update them
    // We can run this in parallel
    await Promise.all(
      unacknowledged.map((record) => {
        return pb.collection("logs").update(record.id, {
          metadata: {
            ...record.metadata,
            acknowledged: true,
          },
        });
      }),
    );

    return NextResponse.json({ success: true, count: unacknowledged.length });
  } catch (e) {
    console.error("Failed to acknowledge logs:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
