import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { AdminVerificationList } from "@/components/dashboard/admin-verification-list";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";

export default async function AdminVerificationsPage() {
  const t = await getTranslations("verification");

  const pendingRequests = await prisma.verificationRequest.findMany({
    where: { status: "PENDING" },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          createdAt: true,
          // Fase 32: adres-velden meeleveren zodat admin profiel-adres ziet bij ADDRESS-type
          street: true,
          houseNumber: true,
          postalCode: true,
          city: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={t("adminTitle")} subtitle={t("adminDescription")} />
      <AdminVerificationList requests={pendingRequests} />
    </div>
  );
}
