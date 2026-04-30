import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { AdminVerificationList } from "@/components/dashboard/admin-verification-list";

export default async function AdminVerificationsPage() {
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
      <h1 className="text-2xl font-bold text-foreground">{t("adminTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("adminDescription")}</p>
      <AdminVerificationList requests={pendingRequests} />
    </div>
  );
}
