import { NextResponse } from "next/server";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";
import { CRON_JOBS } from "@/lib/cron-jobs";
import { scheduleNextClaimsaleActivation } from "@/lib/claimsale-activator-scheduler";

// GET /api/cron/claimsale-activate
// Flipt SCHEDULED-claimsales waarvan startTime is bereikt naar LIVE.
// Idempotent — race-safe via conditional updateMany op status="SCHEDULED".
//
// De in-process claimsale-activator-scheduler doet de precision-firing
// (sub-seconde-nauwkeurig). Deze cron is de safety-net (elke minuut) en
// bumpt de scheduler voor synchronisatie na elke run.
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging(
    "claimsale-activate",
    async (run) => {
      const r = await CRON_JOBS["claimsale-activate"]();
      run.setItemsProcessed(r.itemsProcessed);
      return r.result;
    },
    trigger
  );

  await scheduleNextClaimsaleActivation("post-cron").catch((err) =>
    console.error("[claimsale-activate cron] scheduler bump failed", err)
  );

  return NextResponse.json(result);
}
