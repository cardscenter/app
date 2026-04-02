import { NextResponse } from "next/server";
import { expireClaimedItems } from "@/actions/claimsale";

// GET /api/cron/expire-claims
// Run every minute to expire claims older than 15 minutes
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await expireClaimedItems();

  return NextResponse.json({
    success: true,
    expired: result.expired,
    timestamp: new Date().toISOString(),
  });
}
