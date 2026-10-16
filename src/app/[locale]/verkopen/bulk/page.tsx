import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BulkCalculator } from "@/components/buyback/bulk-calculator";
import { CenteredHero } from "@/components/ploy/centered-hero";
import { getBulkPricing, bulkRowName } from "@/lib/buyback-pricing-db";
import { decryptIban } from "@/lib/iban-crypto";
import { formatIbanForDisplay } from "@/lib/validations/iban";

export const dynamic = "force-dynamic";

/** Bulk-calculator (design-pass Fase D): compacte hero boven de bestaande stappen. */
export default async function BulkCalculatorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=/verkopen/bulk`);
  }

  const t = await getTranslations("buyback");
  // Fase 6: tarieven uit de beheerbare tabel; IBAN uit het profiel vooraf invullen.
  const [pricing, user] = await Promise.all([getBulkPricing(), prisma.user.findUnique({ where: { id: session.user.id }, select: { iban: true, accountHolderName: true } })]);
  const plainIban = decryptIban(user?.iban);

  return (
    <div className="cc-landing overflow-clip">
      <CenteredHero title={t("bulkTitle")} description={t("bulkDesc")} size={3} className="pb-8 lg:pb-10" />
      <section className="flex justify-center px-4 pb-16 sm:px-5 lg:px-6 lg:pb-24">
        <div className="w-full max-w-6xl">
          <BulkCalculator
            pricing={pricing.map((p) => ({ key: p.key, label: bulkRowName(p, locale), tooltip: p.description, price: p.price, group: p.group, weightGrams: p.weightGrams }))}
            defaultIban={plainIban ? formatIbanForDisplay(plainIban) : ""}
            defaultAccountHolder={user?.accountHolderName ?? ""}
          />
        </div>
      </section>
    </div>
  );
}
