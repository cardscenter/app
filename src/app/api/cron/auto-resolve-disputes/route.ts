import { NextResponse } from "next/server";
import { autoResolveDisputes } from "@/actions/dispute";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";

// GET /api/cron/auto-resolve-disputes
// Call this daily to auto-resolve expired disputes
export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCronLogging("auto-resolve-disputes", async (run) => {
    const r = await autoResolveDisputes();
    run.setItemsProcessed(r.resolved);
    return r;
  }, trigger);

  return NextResponse.json({
    success: true,
    resolved: result.resolved,
    timestamp: new Date().toISOString(),
  });
}
