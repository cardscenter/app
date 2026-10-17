import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const isProduction = process.env.NODE_ENV === "production";
let warnedMissingSecret = false;

/**
 * Authorize a cron-route call. Two paths:
 *  1. External scheduler: `Authorization: Bearer <CRON_SECRET>` → returns "cron"
 *  2. Admin manual run: signed-in admin session → returns adminId
 * Returns null if neither authorizes.
 *
 * Zonder CRON_SECRET: in dev open (lokale curl-tests), in productie DICHT —
 * anders zou elke /api/cron/*-route (incl. het destructieve
 * cleanup-archived-chats) publiek aanroepbaar zijn. De in-process schedulers
 * roepen CRON_JOBS direct aan en hebben het secret niet nodig.
 */
export async function resolveCronTrigger(request: Request): Promise<string | null> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return "cron";
  }

  if (!cronSecret) {
    if (!isProduction) return "cron";
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;

      console.error(
        "[cron-auth] CRON_SECRET ontbreekt in productie — /api/cron/* weigert externe calls (admin-sessie werkt nog).",
      );
    }
  }

  // Admin manual run via UI
  const session = await auth();
  if (session?.user?.id) {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { accountType: true },
    });
    if (me?.accountType === "ADMIN") {
      return session.user.id;
    }
  }

  return null;
}
