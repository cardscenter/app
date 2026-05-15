import { useTranslations } from "next-intl";
import {
  CreditCard,
  Lock,
  PackageCheck,
  Banknote,
  ShieldCheck,
  Scale,
  HeadphonesIcon,
  Globe2,
} from "lucide-react";
import { AnimatedSection } from "@/components/home/animated-section";

const STEPS = [
  { Icon: CreditCard, titleKey: "buyerProtectionStep1Title", descKey: "buyerProtectionStep1Desc" },
  { Icon: Lock, titleKey: "buyerProtectionStep2Title", descKey: "buyerProtectionStep2Desc" },
  { Icon: PackageCheck, titleKey: "buyerProtectionStep3Title", descKey: "buyerProtectionStep3Desc" },
  { Icon: Banknote, titleKey: "buyerProtectionStep4Title", descKey: "buyerProtectionStep4Desc" },
] as const;

const STATS = [
  { valueKey: "buyerProtectionStat1Value", labelKey: "buyerProtectionStat1Label" },
  { valueKey: "buyerProtectionStat2Value", labelKey: "buyerProtectionStat2Label" },
  { valueKey: "buyerProtectionStat3Value", labelKey: "buyerProtectionStat3Label" },
] as const;

const GUARANTEES = [
  { Icon: ShieldCheck, titleKey: "buyerProtectionGuarantee1Title", descKey: "buyerProtectionGuarantee1Desc" },
  { Icon: Scale, titleKey: "buyerProtectionGuarantee2Title", descKey: "buyerProtectionGuarantee2Desc" },
  { Icon: HeadphonesIcon, titleKey: "buyerProtectionGuarantee3Title", descKey: "buyerProtectionGuarantee3Desc" },
  { Icon: Globe2, titleKey: "buyerProtectionGuarantee4Title", descKey: "buyerProtectionGuarantee4Desc" },
] as const;

export function BuyerProtectionSection({ bgClass = "bg-card" }: { bgClass?: string }) {
  const t = useTranslations("home");

  return (
    <section className={`py-16 lg:py-24 ${bgClass}`}>
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10">
        <AnimatedSection>
          {/* Header */}
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30">
              <ShieldCheck className="size-3" />
              {t("buyerProtectionEyebrow")}
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {t("buyerProtectionTitle")}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("buyerProtectionSubtitle")}
            </p>
          </div>

          {/* Stat pills */}
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
            {STATS.map((stat) => (
              <div
                key={stat.valueKey}
                className="rounded-xl border border-border bg-background px-5 py-4 text-center"
              >
                <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {t(stat.valueKey)}
                </div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(stat.labelKey)}
                </div>
              </div>
            ))}
          </div>

          {/* 4-step escrow flow */}
          <div className="mt-14">
            <div className="mx-auto max-w-3xl text-center">
              <h3 className="text-lg font-semibold text-foreground sm:text-xl">
                {t("buyerProtectionFlowTitle")}
              </h3>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, idx) => (
                <div key={step.titleKey} className="relative">
                  {/* Connector line (hidden on last step + mobile) */}
                  {idx < STEPS.length - 1 && (
                    <div
                      aria-hidden
                      className="absolute left-1/2 top-7 hidden h-px w-full bg-gradient-to-r from-border via-border to-transparent lg:block"
                    />
                  )}
                  <div className="relative flex flex-col items-center text-center">
                    <div className="relative z-10 flex size-14 items-center justify-center rounded-full border border-border bg-background shadow-card">
                      <step.Icon className="size-6 text-foreground" />
                      <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background">
                        {idx + 1}
                      </span>
                    </div>
                    <h4 className="mt-4 text-base font-semibold text-foreground">
                      {t(step.titleKey)}
                    </h4>
                    <p className="mt-1.5 max-w-[220px] text-sm leading-relaxed text-muted-foreground">
                      {t(step.descKey)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Guarantees */}
          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GUARANTEES.map((g) => (
              <div
                key={g.titleKey}
                className="rounded-xl border border-border bg-background p-5"
              >
                <div className="inline-flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <g.Icon className="size-4" />
                </div>
                <h4 className="mt-3 text-sm font-semibold text-foreground">{t(g.titleKey)}</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t(g.descKey)}</p>
              </div>
            ))}
          </div>

          {/* Footnote */}
          <p className="mt-10 text-center text-xs text-muted-foreground">
            {t("buyerProtectionFootnote")}
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
