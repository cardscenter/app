import { NextResponse } from "next/server";
import { autoConfirmDeliveries } from "@/actions/purchase";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";

// GET /api/cron/auto-confirm
// Call this daily to auto-confirm deliveries older than 30 days
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging("auto-confirm", async (run) => {
    const r = await autoConfirmDeliveries();
    run.setItemsProcessed(r.confirmed);
    return r;
  }, trigger);

  return NextResponse.json({
    success: true,
    confirmed: result.confirmed,
    timestamp: new Date().toISOString(),
  });
}
