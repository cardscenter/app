import { NextResponse } from "next/server";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";
import { CRON_JOBS } from "@/lib/cron-jobs";

// GET /api/cron/expire-food-payments
// Eten bestellen (Community Hub, Fase 4). Draait primair in-process via de
// event-maintenance-scheduler; deze route is safety-net + "Run nu".
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging("expire-food-payments", async (run) => {
    const r = await CRON_JOBS["expire-food-payments"]();
    run.setItemsProcessed(r.itemsProcessed);
    return r.result;
  }, trigger);

  return NextResponse.json(result);
}
