import { NextResponse } from "next/server";
import { expireClaimedItems } from "@/actions/claimsale";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";

// GET /api/cron/expire-claims
// Run every minute to expire claims older than 15 minutes
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging("expire-claims", async (run) => {
    const r = await expireClaimedItems();
    run.setItemsProcessed(r.expired);
    return r;
  }, trigger);

  return NextResponse.json({
    success: true,
    expired: result.expired,
    timestamp: new Date().toISOString(),
  });
}
