import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Authorize a cron-route call. Two paths:
 *  1. External scheduler: `Authorization: Bearer <CRON_SECRET>` → returns "cron"
 *  2. Admin manual run: signed-in admin session → returns adminId
 * Returns null if neither authorizes.
 */
export async function resolveCronTrigger(request: Request): Promise<string | null> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return "cron";
  }

  // No CRON_SECRET configured? In dev that's the case — allow anyway, mark as "cron".
  if (!cronSecret) {
    return "cron";
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
