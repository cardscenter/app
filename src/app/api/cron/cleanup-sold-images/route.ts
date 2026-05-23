import { NextResponse } from "next/server";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";
import { CRON_JOBS } from "@/lib/cron-jobs";

// GET /api/cron/cleanup-sold-images
// Verwijdert 30 dagen na voltooide verkoop de geüploade foto-bestanden van die
// verkoop (R2/schijf) en maakt de DB-foto-velden leeg. Tekstdata blijft.
// Slaat bestellingen met lopend geschil/ticket over. Idempotent.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging(
    "cleanup-sold-images",
    async (run) => {
      const r = await CRON_JOBS["cleanup-sold-images"]();
      run.setItemsProcessed(r.itemsProcessed);
      return r.result;
    },
    trigger,
  );

  return NextResponse.json(result);
}
