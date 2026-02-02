import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedPocketBase } from "@/lib/backend/pocketbase";
import { verifySession } from "@/lib/backend/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const isAuthenticated = await verifySession(req);
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = parseInt(searchParams.get("perPage") || "20");

  const pb = await getAuthenticatedPocketBase();

  try {
    const result = await pb
      .collection("study_sessions")
      .getList(page, perPage, {
        sort: "-created_at", // Newest first (using created_at as defined in schema)
      });

    return NextResponse.json(result);
  } catch (e) {
    console.error("Error fetching history:", e);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 },
    );
  }
}
