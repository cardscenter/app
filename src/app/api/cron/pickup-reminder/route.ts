import { NextResponse } from "next/server";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";
import { CRON_JOBS } from "@/lib/cron-jobs";

// GET /api/cron/pickup-reminder
// 24-uur reminder voor ACCEPTED ophaalmomenten.
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging("pickup-reminder", async (run) => {
    const r = await CRON_JOBS["pickup-reminder"]();
    run.setItemsProcessed(r.itemsProcessed);
    return r.result;
  }, trigger);

  return NextResponse.json(result);
}
