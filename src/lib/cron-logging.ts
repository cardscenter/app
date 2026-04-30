import { prisma } from "@/lib/prisma";

export type CronRunHandle = {
  id: string;
  setItemsProcessed: (n: number) => void;
};

export async function withCronLogging<T>(
  jobName: string,
  fn: (run: CronRunHandle) => Promise<T>,
  triggeredBy: string = "cron"
): Promise<T> {
  const record = await prisma.cronRun.create({
    data: {
      jobName,
      status: "RUNNING",
      triggeredBy,
    },
  });

  let itemsProcessed = 0;
  const handle: CronRunHandle = {
    id: record.id,
    setItemsProcessed: (n: number) => {
      itemsProcessed = n;
    },
  };

  try {
    const result = await fn(handle);
    await prisma.cronRun.update({
      where: { id: record.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        itemsProcessed,
      },
    });
    return result;
  } catch (error) {
    await prisma.cronRun.update({
      where: { id: record.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        itemsProcessed,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
