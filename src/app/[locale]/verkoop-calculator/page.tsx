import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Calculator, Package, ArrowRight, CheckCircle2 } from "lucide-react";

export default async function VerkoopCalculatorPage() {
  const t = await getTranslations("buyback");

  const steps = [
    { title: t("step1Title"), desc: t("step1Desc"), num: "1" },
    { title: t("step2Title"), desc: t("step2Desc"), num: "2" },
    { title: t("step3Title"), desc: t("step3Desc"), num: "3" },
    { title: t("step4Title"), desc: t("step4Desc"), num: "4" },
  ];

  const conditions = [
    t("conditionNM"),
    t("conditionCentering"),
    t("conditionEnglish"),
    t("conditionOriginal"),
    t("conditionPricing"),
    t("conditionMinCollection"),
    t("conditionMinBulk"),
    t("conditionPayout"),
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Two calculator options */}
      <div className="mb-12 grid gap-6 md:grid-cols-2">
        <Link
          href="/verkoop-calculator/collectie"
          className="glass group flex flex-col items-center gap-4 rounded-2xl p-8 text-center transition-all hover:ring-2 hover:ring-primary/40"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Calculator className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold">{t("collectionTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("collectionDesc")}</p>
          <span className="mt-auto flex items-center gap-2 font-medium text-primary">
            {t("startCollection")} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        <Link
          href="/verkoop-calculator/bulk"
          className="glass group flex flex-col items-center gap-4 rounded-2xl p-8 text-center transition-all hover:ring-2 hover:ring-amber-500/40"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
            <Package className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold">{t("bulkTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("bulkDesc")}</p>
          <span className="mt-auto flex items-center gap-2 font-medium text-amber-600">
            {t("startBulk")} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </div>

      {/* How it works */}
      <div className="mb-12">
        <h2 className="mb-6 text-2xl font-bold">{t("howItWorks")}</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {steps.map((step) => (
            <div key={step.num} className="glass rounded-xl p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {step.num}
              </div>
              <h3 className="mb-1 font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Conditions */}
      <div className="glass rounded-2xl p-6">
        <h2 className="mb-4 text-xl font-bold">{t("conditions")}</h2>
        <ul className="grid gap-2 md:grid-cols-2">
          {conditions.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
