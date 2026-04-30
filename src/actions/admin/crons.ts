"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { withCronLogging } from "@/lib/cron-logging";
import { CRON_JOBS, CRON_JOB_NAMES, CRON_JOB_META, type CronJobName } from "@/lib/cron-jobs";
import { revalidatePath } from "next/cache";

export async function runCronManually(jobName: string) {
  const { adminId } = await requireAdmin();

  if (!CRON_JOB_NAMES.includes(jobName as CronJobName)) {
    return { error: `Onbekende job: ${jobName}` };
  }

  const meta = CRON_JOB_META[jobName as CronJobName];
  if (!meta.allowManualRun) {
    return { error: `Manual run niet toegestaan voor "${jobName}". ${meta.runWarning ?? ""}`.trim() };
  }

  const runner = CRON_JOBS[jobName as CronJobName];

  try {
    const summary = await withCronLogging(jobName, async (run) => {
      const r = await runner();
      run.setItemsProcessed(r.itemsProcessed);
      return r.result;
    }, adminId);

    await logAdminAction({
      adminId,
      action: "RUN_CRON_MANUALLY",
      targetType: "CRON",
      targetId: jobName,
      metadata: { result: summary },
    });

    revalidatePath("/dashboard/admin/crons");
    return { success: true, summary };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Onbekende fout" };
  }
}

export async function getCronStatus() {
  await requireAdmin();

  // For each known job, fetch the latest run + last 10 runs + static metadata.
  const jobs = await Promise.all(
    CRON_JOB_NAMES.map(async (name) => {
      const [latest, runs] = await Promise.all([
        prisma.cronRun.findFirst({
          where: { jobName: name },
          orderBy: { startedAt: "desc" },
        }),
        prisma.cronRun.findMany({
          where: { jobName: name },
          orderBy: { startedAt: "desc" },
          take: 10,
        }),
      ]);
      const meta = CRON_JOB_META[name];
      return {
        name,
        description: meta.description,
        schedule: meta.schedule,
        allowManualRun: meta.allowManualRun,
        runWarning: meta.runWarning ?? null,
        latest: latest ? {
          id: latest.id,
          status: latest.status,
          startedAt: latest.startedAt.toISOString(),
          finishedAt: latest.finishedAt?.toISOString() ?? null,
          durationMs: latest.finishedAt ? latest.finishedAt.getTime() - latest.startedAt.getTime() : null,
          itemsProcessed: latest.itemsProcessed,
          errorMessage: latest.errorMessage,
          triggeredBy: latest.triggeredBy,
        } : null,
        recentRuns: runs.map((r) => ({
          id: r.id,
          status: r.status,
          startedAt: r.startedAt.toISOString(),
          finishedAt: r.finishedAt?.toISOString() ?? null,
          itemsProcessed: r.itemsProcessed,
          triggeredBy: r.triggeredBy,
        })),
      };
    })
  );

  return jobs;
}
