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
    // 1. Fetch recent unacknowledged logs (missed heartbeats, breaches, warnings)
    const records = await pb.collection("logs").getList(1, 100, {
      filter: `type = "missed_heartbeat" || type = "breach" || type = "warn"`,
      sort: "-created",
    });

    // Filter in memory for safety
    const unacknowledged = records.items.filter(
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
