import { NextResponse } from "next/server";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";
import { CRON_JOBS } from "@/lib/cron-jobs";

// GET /api/cron/bundle-offer-expiry
// PENDING bundle-voorstellen >3 dagen → EXPIRED. Listings blijven ACTIVE
// (stonden nooit op RESERVED tijdens de PENDING-fase).
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging("bundle-offer-expiry", async (run) => {
    const r = await CRON_JOBS["bundle-offer-expiry"]();
    run.setItemsProcessed(r.itemsProcessed);
    return r.result;
  }, trigger);

  return NextResponse.json(result);
}
