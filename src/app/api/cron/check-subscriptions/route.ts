import { NextResponse } from "next/server";
import { checkAndDowngradeExpired } from "@/actions/subscription";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";

// GET /api/cron/check-subscriptions
// Call this hourly to downgrade expired subscriptions
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging("check-subscriptions", async (run) => {
    const r = await checkAndDowngradeExpired();
    run.setItemsProcessed(r.downgraded);
    return r;
  }, trigger);

  return NextResponse.json({
    success: true,
    downgraded: result.downgraded,
    timestamp: new Date().toISOString(),
  });
}
