import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptIban } from "@/lib/iban-crypto";
import { formatIbanForDisplay } from "@/lib/validations/iban";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { CollectionCalculator } from "@/components/buyback/collection-calculator";
import { CenteredHero } from "@/components/ploy/centered-hero";

/** Collectie-calculator (design-pass Fase D): compacte hero + gele disclaimer boven de stappen. */
export default async function CollectionCalculatorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=/verkopen/losse-kaarten`);
  }

  const t = await getTranslations("buyback");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { iban: true, accountHolderName: true } });
  const plainIban = decryptIban(user?.iban);

  return (
    <div className="cc-landing overflow-clip">
      <CenteredHero eyebrow={t("landing.singlesCardTitle")} eyebrowColor="pink" title={t("collectionTitle")} description={t("collectionDesc")} size={3} className="pb-8 lg:pb-10" />
      <section className="flex justify-center px-4 pb-16 sm:px-5 lg:px-6 lg:pb-24">
        <div className="w-full max-w-6xl">
          {/* Pricing disclaimer — onze Marktprijs-berekening is geautomatiseerd
              maar niet bindend; admins controleren prijzen na ontvangst. */}
          <div className="mb-6 flex items-start gap-3 rounded-[12px] bg-[var(--pastel-yellow)] p-4 text-sm text-[var(--foreground)]">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">{t("pricingDisclaimerTitle")}</p>
              <p className="mt-1 text-[var(--foreground)]/75">{t("pricingDisclaimerBody")}</p>
            </div>
          </div>
          <CollectionCalculator defaultIban={plainIban ? formatIbanForDisplay(plainIban) : ""} defaultAccountHolder={user?.accountHolderName ?? ""} />
        </div>
      </section>
    </div>
  );
}
