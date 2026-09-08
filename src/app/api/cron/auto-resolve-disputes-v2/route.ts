import { NextResponse } from "next/server";
import { autoResolveDisputesV2 } from "@/actions/dispute-v2";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";

// GET /api/cron/auto-resolve-disputes-v2
// Geschillen auto-afhandeling. Pad A: verkoper >14d niet gereageerd → volledige
// terugbetaling koper (+ veilingkosten). Pad B: koper >14d niet gereageerd na
// verkopersreactie → vrijgave aan verkoper. Pad C: voorstel >14d onbeantwoord
// → automatisch naar de beheerder. ESCALATED wordt niet aangeraakt (SLA-flag).
// Primaire trigger = order-maintenance-scheduler (uurlijks); route = safety-net.
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging("auto-resolve-disputes-v2", async (run) => {
    const r = await autoResolveDisputesV2();
    run.setItemsProcessed(r.resolved + r.escalated);
    return r;
  }, trigger);

  return NextResponse.json({
    success: true,
    resolved: result.resolved,
    escalated: result.escalated,
    timestamp: new Date().toISOString(),
  });
}
