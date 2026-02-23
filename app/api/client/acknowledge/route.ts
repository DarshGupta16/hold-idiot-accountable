import { NextRequest, NextResponse } from "next/server";
import { getLocalClient } from "@/lib/backend/convex";
import { api } from "@/convex/_generated/api";
import { verifySession } from "@/lib/backend/auth";
import { replicateToCloud } from "@/lib/backend/sync";
import { Log } from "@/lib/backend/schema";

export async function POST(req: NextRequest) {
  const isAuthenticated = await verifySession(req);
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convex = getLocalClient();

  try {
    const unacknowledged = await convex.query(api.logs.getUnacknowledgedAlerts);
    console.log(
      `[Acknowledge] Found ${unacknowledged.length} unacknowledged logs.`,
    );

    // 2. Update them
    await Promise.all(
      unacknowledged.map((record: Log) => {
        const metadata = {
          ...(record.metadata as Record<string, unknown> || {}),
          acknowledged: true,
        };
        const p1 = convex.mutation(api.logs.updateMetadata, {
          id: record._id,
          metadata,
        });
        const p2 = replicateToCloud("logs", "updateMetadata", {
          id: record._id, // This ID might not exist on cloud, but sync handles it
          metadata,
        });
        return Promise.all([p1, p2]);
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
