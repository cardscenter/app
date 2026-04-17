import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { BuybackRequestDetail } from "@/components/buyback/buyback-request-detail";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

export default async function BuybackDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/auth/login", locale });
    return null;
  }

  const t = await getTranslations("buyback");

  const request = await prisma.buybackRequest.findUnique({
    where: { id },
    include: { items: true, bulkItems: true },
  });

  if (!request || request.userId !== session.user.id) {
    notFound();
  }

  return (
    <div>
      <Link
        href="/dashboard/inkoop"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToOverview")}
      </Link>
      <BuybackRequestDetail request={JSON.parse(JSON.stringify(request))} />
    </div>
  );
}
