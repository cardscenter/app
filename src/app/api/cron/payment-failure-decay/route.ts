import { NextResponse } from "next/server";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";
import { CRON_JOBS } from "@/lib/cron-jobs";

// GET /api/cron/payment-failure-decay
// Wekelijks — verzacht User.paymentFailureCount met 1 voor users wiens
// laatste wanbetaling >365 dagen geleden was. Suspend wordt niet automatisch
// opgeheven (Fase 29).
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging(
    "payment-failure-decay",
    async (run) => {
      const r = await CRON_JOBS["payment-failure-decay"]();
      run.setItemsProcessed(r.itemsProcessed);
      return r.result;
    },
    trigger,
  );

  return NextResponse.json(result);
}
