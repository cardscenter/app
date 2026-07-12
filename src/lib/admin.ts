import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireAdmin(): Promise<{ adminId: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true, totpEnabled: true },
  });
  if (me?.accountType !== "ADMIN") {
    throw new Error("Forbidden");
  }
  // 2FA verplicht voor admins (Fase 16-followup). De admin-layout toont het
  // instructiescherm; deze check is defense-in-depth voor directe action-calls.
  if (!me.totpEnabled) {
    throw new Error("Stel eerst twee-factor-authenticatie in via je profiel — verplicht voor admin-accounts.");
  }
  return { adminId: session.user.id };
}

export async function requireAdminPage(): Promise<{ adminId: string }> {
  // Helper heeft geen toegang tot route-params; hardcode NL als default-locale
  // (admin-panel wordt in praktijk alleen NL gebruikt). Voor i18n-correctheid
  // zou caller-side locale-passing nodig zijn.
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/nl/login");
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });
  if (me?.accountType !== "ADMIN") {
    redirect("/nl/dashboard");
  }
  return { adminId: session.user.id };
}
