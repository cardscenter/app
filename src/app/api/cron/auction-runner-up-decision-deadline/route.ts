import { NextResponse } from "next/server";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";
import { CRON_JOBS } from "@/lib/cron-jobs";

// GET /api/cron/auction-runner-up-decision-deadline
// Hourly cron — flips AwaitingDecision-offers waarvan het 72u-window verlopen is
// naar EXPIRED en triggert de volgende kandidaat (of finaliseert PAYMENT_FAILED).
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging(
    "auction-runner-up-decision-deadline",
    async (run) => {
      const r = await CRON_JOBS["auction-runner-up-decision-deadline"]();
      run.setItemsProcessed(r.itemsProcessed);
      return r.result;
    },
    trigger,
  );

  return NextResponse.json(result);
}
