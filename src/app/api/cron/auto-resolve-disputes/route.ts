import { NextResponse } from "next/server";
import { autoResolveDisputes } from "@/actions/dispute";

// GET /api/cron/auto-resolve-disputes
// Call this daily to auto-resolve expired disputes
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await autoResolveDisputes();

  return NextResponse.json({
    success: true,
    resolved: result.resolved,
    timestamp: new Date().toISOString(),
  });
}
