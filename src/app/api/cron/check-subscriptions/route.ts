import { NextResponse } from "next/server";
import { checkAndDowngradeExpired } from "@/actions/subscription";

// GET /api/cron/check-subscriptions
// Call this hourly to downgrade expired subscriptions
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkAndDowngradeExpired();

  return NextResponse.json({
    success: true,
    downgraded: result.downgraded,
    timestamp: new Date().toISOString(),
  });
}
