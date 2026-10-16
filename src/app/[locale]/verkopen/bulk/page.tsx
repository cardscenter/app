import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BulkCalculator } from "@/components/buyback/bulk-calculator";
import { PageContainer } from "@/components/layout/page-container";
import { getBulkPricing, bulkRowName } from "@/lib/buyback-pricing-db";
import { decryptIban } from "@/lib/iban-crypto";
import { formatIbanForDisplay } from "@/lib/validations/iban";

export const dynamic = "force-dynamic";

export default async function BulkCalculatorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=/verkopen/bulk`);
  }

  const t = await getTranslations("buyback");
  // Fase 6: tarieven uit de beheerbare tabel; IBAN uit het profiel vooraf invullen.
  const [pricing, user] = await Promise.all([
    getBulkPricing(),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { iban: true, accountHolderName: true } }),
  ]);
  const plainIban = decryptIban(user?.iban);

  return (
    <PageContainer width="default" className="py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("bulkTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("bulkDesc")}</p>
      </div>
      <BulkCalculator
        pricing={pricing.map((p) => ({ key: p.key, label: bulkRowName(p, locale), tooltip: p.description, price: p.price, group: p.group, weightGrams: p.weightGrams }))}
        defaultIban={plainIban ? formatIbanForDisplay(plainIban) : ""}
        defaultAccountHolder={user?.accountHolderName ?? ""}
      />
    </PageContainer>
  );
}
