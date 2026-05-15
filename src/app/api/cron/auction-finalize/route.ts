import { NextResponse } from "next/server";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";
import { CRON_JOBS } from "@/lib/cron-jobs";
import { scheduleNextAuctionFinalize } from "@/lib/auction-scheduler";

// GET /api/cron/auction-finalize
// Sluit ACTIVE veilingen waarvan endTime is verstreken. Idempotent —
// finalizeAuction's status-check beschermt tegen dubbele aanroepen vanuit
// de page-view trigger of client-side countdown.
//
// Sinds de in-process auction-scheduler (src/lib/auction-scheduler.ts) is
// deze cron de safety-net (5 min) — de scheduler doet de precision-firing.
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging("auction-finalize", async (run) => {
    const r = await CRON_JOBS["auction-finalize"]();
    run.setItemsProcessed(r.itemsProcessed);
    return r.result;
  }, trigger);

  // Synchroniseer de scheduler na elke cron-run zodat 'ie weet wat er nog
  // open staat. Belangrijk na een cold-boot waar de scheduler nog niet
  // gedraaid heeft, of als 'ie z'n timer kwijt is door een crash.
  await scheduleNextAuctionFinalize("post-cron").catch((err) =>
    console.error("[auction-finalize cron] scheduler bump failed", err)
  );

  return NextResponse.json(result);
}
