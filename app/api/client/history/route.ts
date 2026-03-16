import { NextRequest, NextResponse } from "next/server";
import { getLocalClient } from "@/lib/backend/convex";
import { internal } from "@/convex/_generated/api";
import { verifySession } from "@/lib/backend/auth";
import { asPublic } from "@/lib/backend/types";
...
    const result = await convex.query(asPublic(internal.studySessions.list), {
      paginationOpts: { numItems, cursor },
    });

    // Convex pagination returns { page, isDone, continueCursor }
    // pocketbase returns { page, perPage, totalItems, totalPages, items }
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
