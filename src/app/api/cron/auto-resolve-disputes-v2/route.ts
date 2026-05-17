import { NextResponse } from "next/server";
import { autoResolveDisputesV2 } from "@/actions/dispute-v2";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";

// GET /api/cron/auto-resolve-disputes-v2 (Fase 40)
// Dispute v2 auto-resolve. Pad A: seller >14d niet gereageerd → 100% buyer
// refund + premium. Pad B: buyer >14d niet gereageerd na seller-response →
// escrow naar seller. ESCALATED-disputes worden NIET aangeraakt; die wachten
// op admin (eigen SLA-flag).
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging("auto-resolve-disputes-v2", async (run) => {
    const r = await autoResolveDisputesV2();
    run.setItemsProcessed(r.resolved);
    return r;
  }, trigger);

  return NextResponse.json({
    success: true,
    resolved: result.resolved,
    timestamp: new Date().toISOString(),
  });
}
