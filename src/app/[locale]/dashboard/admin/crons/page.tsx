import { getCronStatus } from "@/actions/admin/crons";
import { CronRunNowButton } from "@/components/admin/cron-run-now-button";
import { getSchedulerState } from "@/lib/auction-scheduler";
import { CheckCircle2, AlertCircle, Loader2, Clock, AlertTriangle, Calendar, Zap } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const cls = {
    SUCCESS: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    FAILED: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    RUNNING: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  }[status] ?? "bg-muted text-muted-foreground";
  const Icon = status === "SUCCESS" ? CheckCircle2 : status === "FAILED" ? AlertCircle : status === "RUNNING" ? Loader2 : Clock;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      <Icon className={`h-3 w-3 ${status === "RUNNING" ? "animate-spin" : ""}`} />
      {status}
    </span>
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
      <div>
        <h1 className="text-2xl font-bold">Crons</h1>
        <p className="text-sm text-muted-foreground">
          Status van geplande taken. &quot;Run nu&quot; voert de job direct uit en logt het resultaat.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <h2 className="text-base font-semibold">Auction-end scheduler</h2>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              scheduler.hasTimer
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {scheduler.hasTimer ? "Actief" : "Idle"}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
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
                  <tr key={i} className="border-t">
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
      </div>

      <div className="space-y-3">
        {jobs.map((job) => (
          <div key={job.name} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-sm font-semibold">{job.name}</code>
                  {job.latest && <StatusBadge status={job.latest.status} />}
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {job.schedule}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{job.description}</p>
                {job.runWarning && (
                  <p className="mt-2 inline-flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
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
                        <p className="rounded bg-rose-50 p-2 text-[11px] text-rose-700 dark:bg-rose-950/30">
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
                      <tr key={r.id} className="border-t">
                        <td className="py-1 tabular-nums">{new Date(r.startedAt).toLocaleString("nl-NL")}</td>
                        <td className="py-1"><StatusBadge status={r.status} /></td>
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
