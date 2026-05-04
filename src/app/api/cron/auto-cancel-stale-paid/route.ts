import { NextResponse } from "next/server";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";
import { CRON_JOBS } from "@/lib/cron-jobs";

// GET /api/cron/auto-cancel-stale-paid
// Annuleert PAID-bundles die 14 dagen zonder verzending zijn blijven hangen.
// Volledige refund naar koper, items terug op de markt, autoExpiredAt-marker
// zodat admin dit later kan onderscheiden van mutual-akkoord-cancels (bv. om
// repeat-offender-sellers te suspendsen).
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging(
    "auto-cancel-stale-paid",
    async (run) => {
      const r = await CRON_JOBS["auto-cancel-stale-paid"]();
      run.setItemsProcessed(r.itemsProcessed);
      return r.result;
    },
    trigger,
  );

  return NextResponse.json(result);
}
