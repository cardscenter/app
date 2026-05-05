import { NextResponse } from "next/server";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";
import { CRON_JOBS } from "@/lib/cron-jobs";

// GET /api/cron/auction-payment-deadline
// Daily cron — handles AWAITING_PAYMENT auctions whose deadline has passed.
// Runner-up rotation as primary path, PAYMENT_FAILED + Fase 29 borg-forfait
// + strike + auto-suspend as fallback. Logic lives in CRON_JOBS registry to
// avoid duplication between scheduler and admin manual-run.
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging(
    "auction-payment-deadline",
    async (run) => {
      const r = await CRON_JOBS["auction-payment-deadline"]();
      run.setItemsProcessed(r.itemsProcessed);
      return r.result;
    },
    trigger,
  );

  return NextResponse.json(result);
}
