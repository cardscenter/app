import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { AdminBuybackList } from "@/components/buyback/admin-buyback-list";

export default async function AdminBuybackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/auth/login", locale });
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });

  if (user?.accountType !== "ADMIN") {
    redirect({ href: "/dashboard", locale });
    return null;
  }

  const t = await getTranslations("buyback");

  const requests = await prisma.buybackRequest.findMany({
    include: {
      user: { select: { displayName: true, email: true } },
      items: true,
      bulkItems: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{t("adminTitle")}</h1>
      <AdminBuybackList requests={JSON.parse(JSON.stringify(requests))} />
    </div>
  );
}
