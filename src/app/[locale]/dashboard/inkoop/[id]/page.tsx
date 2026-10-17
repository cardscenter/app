import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { BuybackRequestDetail } from "@/components/buyback/buyback-request-detail";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { maskStoredIban } from "@/lib/iban-crypto";
import { getBulkPricing, bulkRowName } from "@/lib/buyback-pricing-db";

export const dynamic = "force-dynamic";

export default async function BuybackDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=/dashboard/inkoop/${id}`);
  }

  const t = await getTranslations("buyback");

  const request = await prisma.buybackRequest.findUnique({
    where: { id },
    include: { items: true, bulkItems: true, returnPayment: { select: { status: true, checkoutUrl: true } } },
  });

  if (!request || request.userId !== session.user.id) {
    notFound();
  }
  // Fase 6: IBAN staat versleuteld in de DB; de verkoper ziet alleen de gemaskeerde vorm.
  const safeRequest = { ...request, iban: maskStoredIban(request.iban) };
  const pricing = await getBulkPricing({ includeDisabled: true });
  const categoryLabels = Object.fromEntries(pricing.map((p) => [p.key, bulkRowName(p, locale)]));

  return (
    <div>
      <Link
        href="/dashboard/inkoop"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToOverview")}
      </Link>
      <BuybackRequestDetail request={JSON.parse(JSON.stringify(safeRequest))} categoryLabels={categoryLabels} />
    </div>
  );
}
