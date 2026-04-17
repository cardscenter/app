import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { CollectionCalculator } from "@/components/buyback/collection-calculator";

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
      <CollectionCalculator />
    </div>
  );
}
