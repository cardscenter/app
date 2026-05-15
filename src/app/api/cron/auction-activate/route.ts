import { NextResponse } from "next/server";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";
import { CRON_JOBS } from "@/lib/cron-jobs";
import { scheduleNextAuctionActivation } from "@/lib/auction-activator-scheduler";

// GET /api/cron/auction-activate
// Flipt SCHEDULED-veilingen waarvan startTime is bereikt naar ACTIVE.
// Idempotent — race-safe via conditional updateMany op status="SCHEDULED".
//
// De in-process auction-activator-scheduler doet de precision-firing
// (sub-seconde-nauwkeurig). Deze cron is de safety-net (5 min) en bumpt
// de scheduler voor synchronisatie na elke run.
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging("auction-activate", async (run) => {
    const r = await CRON_JOBS["auction-activate"]();
    run.setItemsProcessed(r.itemsProcessed);
    return r.result;
  }, trigger);

  await scheduleNextAuctionActivation("post-cron").catch((err) =>
    console.error("[auction-activate cron] scheduler bump failed", err)
  );

  return NextResponse.json(result);
}
