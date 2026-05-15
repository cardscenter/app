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
    select: { accountType: true },
  });
  if (me?.accountType !== "ADMIN") {
    throw new Error("Forbidden");
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
