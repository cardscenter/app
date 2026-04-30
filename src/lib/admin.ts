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
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });
  if (me?.accountType !== "ADMIN") {
    redirect("/dashboard");
  }
  return { adminId: session.user.id };
}
