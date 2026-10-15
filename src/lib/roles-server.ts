import "server-only";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStaff, type Role, effectiveRole } from "./roles";

/**
 * Guard voor staff-acties (Community Hub, Fase 2): check-in, keuken, bulk.
 * Leest de rol vers uit de DB (niet uit de JWT), zodat een intrekking door
 * een admin direct geldt. Werpt bij geen toegang (zelfde stijl als requireAdmin).
 */
export async function requireStaff(): Promise<{ userId: string; role: Role }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, accountType: true, deletedAt: true },
  });
  if (!me || me.deletedAt || !isStaff(me)) throw new Error("Forbidden");
  return { userId: session.user.id, role: effectiveRole(me) };
}
