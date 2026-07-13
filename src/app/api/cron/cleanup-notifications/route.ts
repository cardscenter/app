import { NextResponse } from "next/server";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";
import { CRON_JOBS } from "@/lib/cron-jobs";

// GET /api/cron/cleanup-notifications
// Meldingen-retentie (Fase 44): houdt per gebruiker max 250 meldingen aan
// (= 10 pagina's à 25 op /dashboard/meldingen); alles daarboven wordt
// oudste-eerst verwijderd. Draait primair in-process via de
// order-maintenance-scheduler; deze route is safety-net + "Run nu".
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging("cleanup-notifications", async (run) => {
    const r = await CRON_JOBS["cleanup-notifications"]();
    run.setItemsProcessed(r.itemsProcessed);
    return r.result;
  }, trigger);

  return NextResponse.json(result);
}
