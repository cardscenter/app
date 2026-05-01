import { NextResponse } from "next/server";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";
import { CRON_JOBS } from "@/lib/cron-jobs";

// GET /api/cron/bundle-offer-payment-deadline
// Verlopen ACCEPTED-AWAITING_PAYMENT bundle-voorstellen (PLATFORM-mode):
// paymentStatus → PAYMENT_FAILED, listings RESERVED → ACTIVE, PENDING bundle weg.
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging("bundle-offer-payment-deadline", async (run) => {
    const r = await CRON_JOBS["bundle-offer-payment-deadline"]();
    run.setItemsProcessed(r.itemsProcessed);
    return r.result;
  }, trigger);

  return NextResponse.json(result);
}
