import { NextResponse } from "next/server";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";
import { CRON_JOBS } from "@/lib/cron-jobs";

// GET /api/cron/auction-finalize
// Sluit ACTIVE veilingen waarvan endTime is verstreken. Idempotent —
// finalizeAuction's status-check beschermt tegen dubbele aanroepen vanuit
// de page-view trigger of client-side countdown.
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging("auction-finalize", async (run) => {
    const r = await CRON_JOBS["auction-finalize"]();
    run.setItemsProcessed(r.itemsProcessed);
    return r.result;
  }, trigger);

  return NextResponse.json(result);
}
