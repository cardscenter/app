import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { BulkCalculator } from "@/components/buyback/bulk-calculator";
import { PageContainer } from "@/components/layout/page-container";

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
    <PageContainer width="default" className="py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("bulkTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("bulkDesc")}</p>
      </div>
      <BulkCalculator />
    </PageContainer>
  );
}
