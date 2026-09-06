import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/layout/page-container";
import { SellHero, RATE_LABEL, BONUS_LABEL } from "@/components/buyback/landing/sell-hero";
import {
  SellHowItWorks,
  SellSinglesPricing,
  SellBulkPricing,
} from "@/components/buyback/landing/sell-pricing";
import {
  SellConditions,
  SellShipping,
  SellPayout,
  SellCtaBand,
} from "@/components/buyback/landing/sell-info";
import { BuybackFaq } from "@/components/buyback/buyback-faq";
import { BULK_FAQ_ITEMS } from "@/components/buyback/bulk-faq";
import { COLLECTION_FAQ_ITEMS } from "@/components/buyback/collection-faq-items";

// Publieke landingspagina van de inkoopservice: verkopen AAN Cards Center
// (losse kaarten via de collectie-calculator, bulk via vaste tarieven).
// Niet te verwarren met /dashboard/verkopen (eigen marktplaats-verkopen).
// De calculators zelf (/verkopen/losse-kaarten, /verkopen/bulk) zijn
// login-gated; deze pagina is bewust volledig openbaar zodat bezoekers de
// tarieven en spelregels kennen vóór ze een account aanmaken.

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "buyback" });
  return {
    title: `${t("landing.metaTitle")} — Cards Center`,
    description: t("landing.metaDescription", { rate: RATE_LABEL, bonus: BONUS_LABEL }),
  };
}

export default async function VerkopenPage() {
  const t = await getTranslations("buyback");

  return (
    <PageContainer width="default" className="py-10 lg:py-14">
      <div className="space-y-16 lg:space-y-20">
        <SellHero />
        <SellHowItWorks />
        <SellSinglesPricing />
        <SellBulkPricing />
        <SellConditions />
        <SellShipping />
        <SellPayout />

        {/* FAQ — bewust hardcoded NL (support-copy), ook op /en. */}
        <section>
          <h2 className="text-2xl font-bold text-foreground">{t("landing.faqTitle")}</h2>
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <BuybackFaq title={t("landing.faqSingles")} items={COLLECTION_FAQ_ITEMS} headingLevel="h3" />
            <BuybackFaq title={t("landing.faqBulk")} items={BULK_FAQ_ITEMS} headingLevel="h3" />
          </div>
        </section>

        <SellCtaBand />
      </div>
    </PageContainer>
  );
}
