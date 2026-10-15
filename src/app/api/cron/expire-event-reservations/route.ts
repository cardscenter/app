import { NextResponse } from "next/server";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";
import { CRON_JOBS } from "@/lib/cron-jobs";

// GET /api/cron/expire-event-reservations
// Winkel-events (Community Hub, Fase 3). Draait primair in-process via de
// event-maintenance-scheduler; deze route is safety-net + "Run nu".
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging("expire-event-reservations", async (run) => {
    const r = await CRON_JOBS["expire-event-reservations"]();
    run.setItemsProcessed(r.itemsProcessed);
    return r.result;
  }, trigger);

  return NextResponse.json(result);
}
