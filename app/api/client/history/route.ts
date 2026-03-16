import { NextRequest, NextResponse } from "next/server";
import { getLocalClient } from "@/lib/backend/convex";
import { internal } from "@/convex/_generated/api";
import { verifySession } from "@/lib/backend/auth";
import { asPublic } from "@/lib/backend/types";

/**
 * Helper to map Convex document to existing frontend shape
 */
function mapConvexDoc<T extends { _id: any; _creationTime: number }>(doc: T | null) {
  if (!doc) return null;
  const { _id, _creationTime, ...rest } = doc;
  return {
    ...rest,
    id: String(_id),
    created_at: new Date(_creationTime).toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const isAuthenticated = await verifySession(req);
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const numItems = parseInt(searchParams.get("perPage") || "10", 10);
  const cursor = searchParams.get("cursor");

  const convex = getLocalClient();

  try {
    const result = await convex.query(asPublic(internal.studySessions.list), {
      paginationOpts: { numItems, cursor },
    });

    // Convex pagination returns { page, isDone, continueCursor }
    // mapping to something frontend can use:
    return NextResponse.json({
      items: result.page.map(mapConvexDoc),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    });
  } catch (e) {
    console.error("Error fetching history:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
