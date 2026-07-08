"use client";

import { useTransition, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { runCronManually } from "@/actions/admin/crons";
import { Play, Lock, Loader2 } from "lucide-react";

export function CronRunNowButton({
  jobName,
  allowManualRun,
  runWarning,
  isRunning = false,
}: {
  jobName: string;
  allowManualRun: boolean;
  runWarning: string | null;
  /** Laatste run staat op RUNNING — knop disabled tot 'ie klaar is. */
  isRunning?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (!allowManualRun) {
    return (
      <div className="space-y-1">
        <span
          title={runWarning ?? "Deze cron mag alleen door de scheduler gedraaid worden."}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <Lock className="h-3 w-3" />
          Alleen scheduler
        </span>
      </div>
    );
  }

  if (isRunning) {
    return (
      <div className="space-y-1">
        <span
          title="Deze job draait op dit moment — wacht tot de run klaar is."
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          Draait nu…
        </span>
      </div>
    );
  }

  function run() {
    const prompt = runWarning
      ? `${runWarning}\n\nWeet je zeker dat je "${jobName}" nu wilt uitvoeren?`
      : `Cron "${jobName}" nu uitvoeren?`;
    if (!confirm(prompt)) return;
    setError(null);
    startTransition(async () => {
      const res = await runCronManually(jobName);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <button
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        <Play className="h-3 w-3" />
        {pending ? "Bezig…" : "Run nu"}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
