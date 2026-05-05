import { NextResponse } from "next/server";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";
import { CRON_JOBS } from "@/lib/cron-jobs";

// GET /api/cron/prune-bid-ips
// Wekelijks — anonimiseert AuctionBid.bidderIp ouder dan 90 dagen voor
// privacy/retentie (Fase 29). Bid-rij blijft intact, alleen IP wordt genull't.
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging(
    "prune-bid-ips",
    async (run) => {
      const r = await CRON_JOBS["prune-bid-ips"]();
      run.setItemsProcessed(r.itemsProcessed);
      return r.result;
    },
    trigger,
  );

  return NextResponse.json(result);
}
