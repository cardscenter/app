import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { CollectionCalculator } from "@/components/buyback/collection-calculator";
import { AlertTriangle } from "lucide-react";

export default async function CollectionCalculatorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect({ href: "/auth/login", locale });
    return null;
  }

  const t = await getTranslations("buyback");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("collectionTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("collectionDesc")}</p>
      </div>

      {/* Pricing disclaimer — onze Marktprijs-berekening is geautomatiseerd
          maar niet bindend; admins controleren prijzen na ontvangst. */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border-l-4 border-amber-400 bg-amber-50/70 p-4 text-sm dark:border-amber-500 dark:bg-amber-950/30">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
        <div className="text-amber-900 dark:text-amber-100">
          <p className="font-medium">{t("pricingDisclaimerTitle")}</p>
          <p className="mt-1 text-amber-800/90 dark:text-amber-200/90">{t("pricingDisclaimerBody")}</p>
        </div>
      </div>

      <CollectionCalculator />
    </div>
  );
}
