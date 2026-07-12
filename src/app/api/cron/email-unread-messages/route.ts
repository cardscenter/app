import { NextResponse } from "next/server";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";
import { CRON_JOBS } from "@/lib/cron-jobs";

// GET /api/cron/email-unread-messages (Fase 16)
// Mailt ontvangers van chatberichten die na 15 min nog ongelezen zijn.
// Episode-dedupe via EmailLog (max 1 mail per ongelezen-episode) — meermaals
// draaien is veilig. De in-process unread-email-scheduler (5 min tick) is de
// primaire trigger; deze route is safety-net + handmatige run via admin-panel.
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging(
    "email-unread-messages",
    async (run) => {
      const r = await CRON_JOBS["email-unread-messages"]();
      run.setItemsProcessed(r.itemsProcessed);
      return r.result;
    },
    trigger,
  );

  return NextResponse.json(result);
}
