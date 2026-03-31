import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AdminVerificationList } from "@/components/dashboard/admin-verification-list";

export default async function AdminVerificationsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });
  if (admin?.accountType !== "ADMIN") return notFound();

  const t = await getTranslations("verification");

  const pendingRequests = await prisma.verificationRequest.findMany({
    where: { status: "PENDING" },
    include: {
      user: {
        select: { id: true, displayName: true, email: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">
        {t("adminTitle")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("adminDescription")}
      </p>

      <AdminVerificationList requests={pendingRequests} />
    </div>
  );
}
