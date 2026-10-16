import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SellHero, SellPaths, RATE_LABEL, BONUS_LABEL } from "@/components/buyback/landing/sell-hero";
import { SellHowItWorks, SellPricingCards } from "@/components/buyback/landing/sell-pricing";
import { SellConditions, SellShipping, SellPayout, SellCtaBand } from "@/components/buyback/landing/sell-info";
import { FaqSection } from "@/components/ploy/faq-section";
import { BannerPromo } from "@/components/ploy/banner-promo";
import { BULK_FAQ_ITEMS } from "@/components/buyback/bulk-faq";
import { COLLECTION_FAQ_ITEMS } from "@/components/buyback/collection-faq-items";
import { PLATFORM } from "@/lib/platform-config";

// Publieke landingspagina van de inkoopservice: verkopen AAN Cards Center
// (losse kaarten via de collectie-calculator, bulk via vaste tarieven).
// Niet te verwarren met /dashboard/verkopen (eigen marktplaats-verkopen).
// De calculators zelf (/verkopen/losse-kaarten, /verkopen/bulk) zijn
// login-gated; deze pagina is bewust volledig openbaar zodat bezoekers de
// tarieven en spelregels kennen vóór ze een account aanmaken.
// Design-pass Fase D: hero met veegstreep, keuzetegels, stappenladder,
// datakaarten met tarieven, genummerde voorwaarden, groen verzendpaneel,
// uitbetaal-tegels, twee vragenlijsten en een geel slotpaneel.

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
    <div className="cc-landing overflow-clip">
      <SellHero />
      <SellPaths />
      <SellHowItWorks />
      <SellPricingCards />
      <SellConditions />
      <SellShipping />
      <SellPayout />

      {/* FAQ — bewust hardcoded NL (support-copy), ook op /en. */}
      <FaqSection eyebrow={t("landing.faqSingles")} eyebrowColor="pink" title={t("landing.faqTitleSingles")} items={COLLECTION_FAQ_ITEMS} />
      <FaqSection eyebrow={t("landing.faqBulk")} eyebrowColor="yellow" title={t("landing.faqTitleBulk")} items={BULK_FAQ_ITEMS} defaultOpen={null} />

      <BannerPromo
        eyebrow={t("landing.questionsEyebrow")}
        title={t("landing.questionsTitle")}
        text={t("landing.questionsText")}
        note={PLATFORM.supportEmail}
        action={
          <a href={`mailto:${PLATFORM.supportEmail}`} className="cc-pill inline-flex items-center justify-center bg-white px-6 py-4 text-sm font-semibold leading-none text-[var(--foreground)] no-underline transition-colors hover:bg-[var(--background)]">
            {t("landing.questionsCta")}
          </a>
        }
      />

      <SellCtaBand />
    </div>
  );
}
