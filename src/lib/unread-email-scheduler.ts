// In-process scheduler voor de chat-ongelezen-mails (Fase 16) — spiegel van
// expire-claims-scheduler. Primaire trigger omdat de externe scheduler voor
// /api/cron/* in productie (nog) niet is ingesteld; de cron-route blijft als
// safety-net + handmatige "Run nu" vanuit het admin-panel.
//
// Hosting-aanname: single-instance Node-container (Railway). Parallelle runs
// zijn hoe dan ook veilig: de episode-dedupe via EmailLog voorkomt dubbele
// mails (worst case bij een race één dubbele mail, geen dataschade).
//
// HMR-resistance: interval-handle op globalThis zodat dev-reloads niet
// leiden tot N parallelle intervals.

const TICK_MS = 5 * 60_000;

interface SchedulerHandle {
  intervalId: NodeJS.Timeout;
  startedAt: Date;
}

declare global {
  // eslint-disable-next-line no-var
  var __unreadEmailScheduler: SchedulerHandle | undefined;
}

async function tick() {
  try {
    const { sendUnreadChatEmails } = await import("@/lib/email/unread-chat-emails");
    const result = await sendUnreadChatEmails();
    if (result.emailsSent > 0) {
      console.log(`[email-unread] in-process tick: ${result.emailsSent} chat-mails verstuurd`);
    }
  } catch (err) {
    // Niet fataal — volgende tick probeert opnieuw.
    console.error("[email-unread] in-process tick failed:", err);
  }
}

export function startUnreadEmailScheduler(reason: string) {
  if (globalThis.__unreadEmailScheduler) {
    clearInterval(globalThis.__unreadEmailScheduler.intervalId);
  }

  // Eerste tick na 15s — na boot eventuele backlog verwerken zonder de
  // boot-fase te vertragen.
  setTimeout(() => tick(), 15_000);

  const intervalId = setInterval(tick, TICK_MS);
  globalThis.__unreadEmailScheduler = {
    intervalId,
    startedAt: new Date(),
  };
  console.log(
    `[email-unread] in-process scheduler started (reason="${reason}", tick=${TICK_MS}ms)`,
  );
}
