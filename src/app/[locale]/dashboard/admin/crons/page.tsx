import { getCronStatus } from "@/actions/admin/crons";
import { CronRunNowButton } from "@/components/admin/cron-run-now-button";
import { getSchedulerState } from "@/lib/auction-scheduler";
import { CheckCircle2, AlertCircle, Loader2, Clock, AlertTriangle, Calendar, Zap } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { StatusBadge, type StatusTone } from "@/components/dashboard/ui/status-badge";

const RUN_STATUS_META: Record<string, { tone: StatusTone; icon: typeof CheckCircle2 }> = {
  SUCCESS: { tone: "success", icon: CheckCircle2 },
  FAILED: { tone: "danger", icon: AlertCircle },
  RUNNING: { tone: "warning", icon: Loader2 },
};

function CronStatusPill({ status }: { status: string }) {
  const meta = RUN_STATUS_META[status] ?? { tone: "neutral" as StatusTone, icon: Clock };
  return (
    <StatusBadge tone={meta.tone} icon={meta.icon}>
      {status}
    </StatusBadge>
  );
}

function formatDuration(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export default async function AdminCronsPage() {
  const jobs = await getCronStatus();
  const scheduler = getSchedulerState();

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Crons"
        subtitle="Status van geplande taken. “Run nu” voert de job direct uit en logt het resultaat."
      />

      <DashboardSection
        title="Auction-end scheduler"
        icon={<Zap className="size-4 text-amber-500" />}
        action={
          <StatusBadge tone={scheduler.hasTimer ? "success" : "neutral"}>
            {scheduler.hasTimer ? "Actief" : "Idle"}
          </StatusBadge>
        }
      >
        <p className="text-sm text-muted-foreground">
          Sub-seconde-nauwkeurige finalize via in-process setTimeout. De cron <code>auction-finalize</code> hieronder is de
          safety-net (5 min). Generation: {scheduler.generation}.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Volgend fire-moment</span>
            <p className="font-medium tabular-nums">
              {scheduler.scheduledFor
                ? new Date(scheduler.scheduledFor).toLocaleString("nl-NL", { hour12: false })
                : "—"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Voor auction-id</span>
            <p className="font-mono text-[11px]">{scheduler.scheduledAuctionId ?? "—"}</p>
          </div>
        </div>
        {scheduler.history.length > 0 && (
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Laatste {scheduler.history.length} fires
            </summary>
            <table className="mt-2 w-full">
              <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground/70">
                <tr>
                  <th className="py-1">Gevuurd op</th>
                  <th className="py-1 text-right">Verwerkt</th>
                  <th className="py-1 text-right">Errors</th>
                  <th className="py-1 text-right">Duur</th>
                  <th className="py-1">Volgende</th>
                </tr>
              </thead>
              <tbody>
                {scheduler.history.map((h, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-1 tabular-nums">{new Date(h.firedAt).toLocaleString("nl-NL", { hour12: false })}</td>
                    <td className="py-1 text-right tabular-nums">{h.processed}</td>
                    <td className="py-1 text-right tabular-nums">{h.errors}</td>
                    <td className="py-1 text-right tabular-nums">{h.delayMs}ms</td>
                    <td className="py-1 tabular-nums">
                      {h.nextScheduledFor ? new Date(h.nextScheduledFor).toLocaleString("nl-NL", { hour12: false }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </DashboardSection>

      <div className="space-y-3">
        {jobs.map((job) => (
          <div key={job.name} className="dash-card p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-sm font-semibold">{job.name}</code>
                  {job.latest && <CronStatusPill status={job.latest.status} />}
                  <StatusBadge tone="neutral" icon={Calendar}>
                    {job.schedule}
                  </StatusBadge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{job.description}</p>
                {job.runWarning && (
                  <p className="mt-2 inline-flex items-start gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{job.runWarning}</span>
                  </p>
                )}
                {job.latest ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                    <div>
                      <span className="text-muted-foreground">Laatst gedraaid</span>
                      <p className="font-medium tabular-nums">{new Date(job.latest.startedAt).toLocaleString("nl-NL")}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duur</span>
                      <p className="font-medium tabular-nums">{formatDuration(job.latest.durationMs)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Items</span>
                      <p className="font-medium tabular-nums">{job.latest.itemsProcessed}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Trigger</span>
                      <p className="font-medium">{job.latest.triggeredBy === "cron" ? "scheduler" : `admin (${job.latest.triggeredBy?.slice(0, 8) ?? "?"})`}</p>
                    </div>
                    {job.latest.errorMessage && (
                      <div className="col-span-2 md:col-span-4">
                        <span className="text-muted-foreground">Error</span>
                        <p className="rounded-md bg-red-500/10 p-2 text-[11px] text-red-700 dark:text-red-400">
                          {job.latest.errorMessage}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Nog niet uitgevoerd.</p>
                )}
              </div>
              <CronRunNowButton
                jobName={job.name}
                allowManualRun={job.allowManualRun}
                runWarning={job.runWarning}
                isRunning={
                  job.latest?.status === "RUNNING" &&
                  // Stale-guard: RUNNING ouder dan 2u = achtergebleven rij na
                  // een container-restart — knop dan niet blokkeren.
                  Date.now() - new Date(job.latest.startedAt).getTime() < 2 * 60 * 60 * 1000
                }
              />
            </div>

            {job.recentRuns.length > 1 && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Laatste {job.recentRuns.length} runs
                </summary>
                <table className="mt-2 w-full">
                  <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    <tr>
                      <th className="py-1">Tijd</th>
                      <th className="py-1">Status</th>
                      <th className="py-1 text-right">Items</th>
                      <th className="py-1">Trigger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.recentRuns.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="py-1 tabular-nums">{new Date(r.startedAt).toLocaleString("nl-NL")}</td>
                        <td className="py-1"><CronStatusPill status={r.status} /></td>
                        <td className="py-1 text-right tabular-nums">{r.itemsProcessed}</td>
                        <td className="py-1">{r.triggeredBy === "cron" ? "scheduler" : `admin`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
