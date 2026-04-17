import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { BulkCalculator } from "@/components/buyback/bulk-calculator";

export default async function BulkCalculatorPage({
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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("bulkTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("bulkDesc")}</p>
      </div>
      <BulkCalculator />
    </div>
  );
}
