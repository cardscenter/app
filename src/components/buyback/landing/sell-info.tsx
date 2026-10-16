import { getLocale, getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";
import { RETURN_FEE_EUR } from "@/lib/buyback-status";
import { formatCurrency } from "@/lib/format";
import { PLATFORM } from "@/lib/platform-config";
import { FeatureRows } from "@/components/ploy/feature-rows";
import { Panel } from "@/components/ploy/panel";
import { Pill } from "@/components/ploy/pill";
import { PunchCard } from "@/components/ploy/punch-card";
import { DisplayHeading } from "@/components/ploy/display-heading";
import { CtaButton } from "@/components/ploy/cta-button";
import { TileQuad } from "@/components/ploy/tile-quad";
import { ClosingCta } from "@/components/ploy/closing-cta";
import { currencyLocale } from "./sell-hero";

// Voorwaarden als genummerde rijen, verzenden & verpakken als groen paneel,
// uitbetaling als tegels en het slotpaneel.

export async function SellConditions() {
  const t = await getTranslations("buyback");
  const conditions = [
    t("conditionNM"),
    t("conditionCentering"),
    t("conditionEnglish"),
    t("conditionOriginal"),
    t("conditionPricing"),
    t("conditionMaxPrice"),
    t("conditionEra"),
    t("conditionMinCollection"),
    t("conditionMinBulk"),
    t("conditionPayout"),
  ];
  return (
    <>
      <FeatureRows id="voorwaarden" title={t("conditions")} intro={t("landing.conditionsSubtitle")} rows={conditions.map((c, i) => ({ number: String(i + 1).padStart(2, "0"), text: c }))} className="pb-6 lg:pb-8" />
      <section className="flex justify-center px-4 pb-12 sm:px-5 lg:px-6 lg:pb-16">
        <div className="flex w-full max-w-6xl flex-wrap gap-3">
          <CtaButton href="/verkopen/voorwaarden-losse-kaarten" variant="light">
            {t("landing.termsSinglesLink")}
          </CtaButton>
          <CtaButton href="/verkopen/voorwaarden-bulk" variant="light">
            {t("landing.termsBulkLink")}
          </CtaButton>
        </div>
      </section>
    </>
  );
}

export async function SellShipping() {
  const t = await getTranslations("buyback");
  const bullets = [t("landing.shippingBullet1"), t("landing.shippingBullet2"), t("landing.shippingBullet3"), t("landing.shippingBullet4"), t("landing.shippingBullet5")];
  const a = PLATFORM.address;
  return (
    <Panel color="green" id="verzenden">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <Pill color="green">{t("landing.shippingTitle")}</Pill>
          <DisplayHeading tag="h2" size={3} text={t("landing.shippingHeading")} className="mt-5 max-w-[26rem]" />
          <p className="cc-prose mt-5 max-w-[30rem] text-base">{t("landing.shippingIntro")}</p>
          <ol className="mt-6 space-y-3">
            {bullets.map((b, i) => (
              <li key={b} className="flex items-start gap-3 text-base text-[var(--foreground)]">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-xs font-bold text-white">{i + 1}</span>
                <span className="pt-0.5">{b}</span>
              </li>
            ))}
          </ol>
          <div className="mt-7">
            <CtaButton href="/verkopen/verpakken" variant="dark">
              {t("landing.shippingFullGuide")}
            </CtaButton>
          </div>
        </div>
        <PunchCard className="self-start bg-white p-6 sm:p-8" dot="var(--border)">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]/50">
            <MapPin className="size-3.5" />
            {t("landing.shippingAddressLabel")}
          </div>
          <address className="mt-4 not-italic text-lg leading-snug text-[var(--foreground)]">
            <p className="font-semibold">{PLATFORM.legalName}</p>
            <p>
              {a.street} {a.houseNumber}
            </p>
            <p>
              {a.postalCode} {a.city}
            </p>
            <p>{a.country}</p>
          </address>
          <p className="cc-prose mt-5 text-sm">{t("landing.shippingCostNote")}</p>
        </PunchCard>
      </div>
    </Panel>
  );
}

export async function SellPayout() {
  const t = await getTranslations("buyback");
  const locale = await getLocale();
  const fmt = (n: number) => formatCurrency(n, currencyLocale(locale));
  return (
    <>
      <section className="flex justify-center px-4 pb-6 pt-12 sm:px-5 lg:px-6 lg:pt-16" id="uitbetaling">
        <div className="w-full max-w-6xl">
          <DisplayHeading tag="h2" size={3} text={t("landing.payoutTitle")} className="max-w-[30rem]" />
          <p className="cc-prose mt-4 max-w-[36rem] text-base">{t("landing.payoutIntro")}</p>
        </div>
      </section>
      <TileQuad
        items={[
          { title: t("landing.payoutBankTitle"), text: t("landing.payoutBankDesc"), color: "green", animation: "waves" },
          { title: t("landing.payoutReturnTitle"), text: t("landing.payoutReturnDesc", { fee: fmt(RETURN_FEE_EUR) }), color: "ink", animation: "pulse" },
        ]}
        className="pb-4"
      />
      <section className="flex justify-center px-4 pb-12 sm:px-5 lg:px-6 lg:pb-16">
        <p className="cc-prose w-full max-w-6xl text-sm">{t("landing.payoutTiming")}</p>
      </section>
    </>
  );
}

export async function SellCtaBand() {
  const t = await getTranslations("buyback");
  return (
    <ClosingCta color="yellow" title={t("landing.ctaBandTitle")} text={t("landing.ctaBandDesc")}>
      <CtaButton href="/verkopen/losse-kaarten" variant="red">
        {t("landing.ctaSingles")}
      </CtaButton>
      <CtaButton href="/verkopen/bulk" variant="dark">
        {t("landing.ctaBulk")}
      </CtaButton>
    </ClosingCta>
  );
}
