import { NextResponse } from "next/server";
import { autoConfirmDeliveries } from "@/actions/purchase";

// GET /api/cron/auto-confirm
// Call this daily to auto-confirm deliveries older than 30 days
export async function GET(request: Request) {
  // Simple auth: check for a secret header (set CRON_SECRET in env)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await autoConfirmDeliveries();

  return NextResponse.json({
    success: true,
    confirmed: result.confirmed,
    timestamp: new Date().toISOString(),
  });
}
